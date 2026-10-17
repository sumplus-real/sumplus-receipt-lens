import { recoverMessageAddress } from 'viem';
import { APP, CHAIN_ID } from './config.mjs';
const DIGITS=/^(0|[1-9][0-9]*)$/;
const fields=['schema','chain','app','kind','session','provider','sequence','amountMicro','period','expectedCount','totalMicro','usageUnits','settlementRef','synthetic'];
export const lower=s=>String(s).toLowerCase();
export function uint(v,name='integer') {
 if(typeof v==='bigint') {if(v<0n||v>18446744073709551615n) throw Error(`${name}: outside u64`);return v;}
 if(typeof v!=='string'||!DIGITS.test(v)) throw Error(`${name}: canonical unsigned decimal required`);
 const n=BigInt(v);if(n>18446744073709551615n) throw Error(`${name}: outside u64`);return n;
}
export function money(v) {const n=uint(v);return `${n/1000000n}.${String(n%1000000n).padStart(6,'0')}`;}
export function canonical(body) {
 if(!body||typeof body!=='object'||Array.isArray(body)) throw Error('Statement must be an object');
 if(Object.keys(body).sort().join(',')!==[...fields].sort().join(',')) throw Error('Unexpected or missing statement fields');
 if(body.schema!=='receipt-lens/1'||body.chain!==CHAIN_ID||body.app!==APP||body.synthetic!==true) throw Error('Wrong schema, chain, app or synthetic marker');
 if(!['receipt','session-close'].includes(body.kind)) throw Error('Wrong kind');
 if(!/^synthetic-[a-z0-9-]{1,70}$/.test(body.session)||body.provider!=='synthetic-ai-provider') throw Error('Synthetic identifiers required');
 for(const k of ['sequence','amountMicro','period','expectedCount','totalMicro','usageUnits']) uint(body[k],k);
 if(uint(body.expectedCount)<1n||uint(body.expectedCount)>1000n) throw Error('Invalid expected count');
 if(body.kind==='receipt'&&(uint(body.sequence)<1n||uint(body.sequence)>uint(body.expectedCount))) throw Error('Sequence out of range');
 if(body.kind==='session-close'&&(body.sequence!=='0'||body.amountMicro!=='0'||body.usageUnits!=='0')) throw Error('Summary has receipt values');
 if(typeof body.settlementRef!=='string'||!/^synthetic:(none|unverified-[0-9]+)$/.test(body.settlementRef)) throw Error('Only synthetic references allowed');
 return 'Sumplus Receipt Lens | synthetic statement | v1\n'+JSON.stringify(Object.fromEntries(fields.map(k=>[k,body[k]])));
}
export async function verifyEntity(entity,issuer,{session,blockNumber}={}) {
 const errors=[];let body,signer;
 try {
  if(!/^0x[0-9a-f]{64}$/i.test(entity.key)) throw Error('Invalid entity key');
  if(!/^0x[0-9a-f]{40}$/i.test(entity.creator)) throw Error('Missing on-chain creator');
  const envelope=typeof entity.payload==='string'?JSON.parse(entity.payload):entity.payload;
  if(!envelope||Object.keys(envelope).sort().join(',')!=='signature,statement') throw Error('Invalid envelope');
  const candidate=envelope.statement;
  const message=canonical(candidate);
  body=candidate;
  if(session&&body.session!==session) throw Error('Wrong session');
  signer=await recoverMessageAddress({message,signature:envelope.signature});
  if(lower(signer)!==lower(entity.creator)) errors.push('SIGNATURE_CREATOR_MISMATCH');
  const a=entity.attributes||{};
  for(const [name,value] of Object.entries({app:APP,kind:body.kind,session:body.session,provider:body.provider})) if(a[name]?.type!=='str'||a[name].value!==value) errors.push(`ATTRIBUTE_${name}`);
  for(const [name,value] of Object.entries({sequence:body.sequence,amount_micro:body.amountMicro,period:body.period})) if(a[name]?.type!=='u64'||uint(a[name].value)!==uint(value)) errors.push(`ATTRIBUTE_${name}`);
  if(blockNumber!==undefined&&BigInt(entity.expiresAt)<=BigInt(blockNumber)) errors.push('EXPIRED');
 }catch(e){errors.push(`INVALID: ${e.message}`);}
 const trustedCreator=lower(entity.creator)===lower(issuer);
 return {...entity,body,signer,trustedCreator,valid:errors.length===0,trusted:trustedCreator&&errors.length===0,errors};
}
export function reconcile(rows) {
 const accepted=rows.filter(x=>x.trusted);
 const summaries=accepted.filter(x=>x.body.kind==='session-close');
 const receipts=accepted.filter(x=>x.body.kind==='receipt');
 const issues=[];const unique=new Map();
 for(const row of receipts){const seq=row.body.sequence;if(unique.has(seq)) issues.push(`Duplicate sequence ${seq}`);else unique.set(seq,row);}
 if(summaries.length!==1) issues.push(`Expected one signed close statement; found ${summaries.length}`);
 let total=0n;for(const row of unique.values()) total+=uint(row.body.amountMicro);
 if(summaries.length===1){const summary=summaries[0].body;
  for(let seq=1n;seq<=uint(summary.expectedCount);seq++) if(!unique.has(String(seq))) issues.push(`Missing sequence ${seq}`);
  for(const row of unique.values()) if(row.body.expectedCount!==summary.expectedCount||row.body.totalMicro!==summary.totalMicro) issues.push(`Summary disagreement at sequence ${row.body.sequence}`);
  if(total!==uint(summary.totalMicro)) issues.push('Amount total differs from signed close statement');
 }
 return {receipts:receipts.length,unique:unique.size,excluded:rows.length-accepted.length,issues:[...new Set(issues)],complete:issues.length===0,totalMicro:String(total),settlementVerified:false};
}
