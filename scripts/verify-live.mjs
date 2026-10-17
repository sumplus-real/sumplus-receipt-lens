import fs from 'node:fs';import assert from 'node:assert/strict';import {gte} from '@arkiv-network/sdk/query';import {u64} from '@arkiv-network/sdk/attr';
import {readSession,makeClient,makeQuery,collectPages,normalizeEntity} from '../src/arkiv.mjs';import {verifyEntity,reconcile} from '../src/receipt.mjs';import {ISSUER,ADVERSARY,SESSIONS,CHAIN_ID,EXPLORER} from '../src/config.mjs';
const evidence={checkedAt:new Date().toISOString(),chain:CHAIN_ID,synthetic:true,checks:[],transactions:[],queries:[],status:'RUNNING'};
const file='public/acceptance-evidence.json';const save=()=>fs.writeFileSync(file,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?String(v):v,2));
const check=(name,fn,detail)=>{fn();evidence.checks.push({name,pass:true,detail});save();};
const client=makeClient();
try {
 assert.equal(await client.getChainId(),CHAIN_ID);
 const seeds=JSON.parse(fs.readFileSync('public/creation-evidence.json'));assert.equal(seeds.complete,true,'Seeder did not complete');assert.equal(seeds.records.length,10);
 for(const record of seeds.records){
  const receipt=await client.getTransactionReceipt({hash:record.txHash});
  assert.equal(receipt.status,'success');assert.equal(receipt.from.toLowerCase(),(record.role==='publisher'?ISSUER:ADVERSARY).toLowerCase());
  const entity=normalizeEntity(await client.getEntity(record.entityKey));assert.equal(entity.creator.toLowerCase(),receipt.from.toLowerCase());
  evidence.transactions.push({id:record.id,entityKey:record.entityKey,txHash:record.txHash,from:receipt.from,status:receipt.status,blockNumber:String(receipt.blockNumber),gasUsed:String(receipt.gasUsed),effectiveGasPrice:String(receipt.effectiveGasPrice),executionFeeWei:String(receipt.gasUsed*receipt.effectiveGasPrice),expiresAt:entity.expiresAt,createdAt:entity.createdAt,explorer:`${EXPLORER}/tx/${record.txHash}`});save();
 }
 check('10 creation receipts and on-chain creators',()=>assert.equal(evidence.transactions.length,10),'Every tx mined successfully; getEntity creator equals receipt.from');
 for(const [i,session] of SESSIONS.entries()){
  const data=await readSession({session,issuer:ISSUER,pageSize:2});const rows=await Promise.all(data.entities.map(e=>verifyEntity(e,ISSUER,{session,blockNumber:data.blockNumber})));const analysis=reconcile(rows);
  evidence.queries.push({...data,entities:undefined,keys:data.entities.map(e=>e.key),analysis,verdicts:rows.map(r=>({key:r.key,creator:r.creator,sequence:r.body?.sequence,trusted:r.trusted,valid:r.valid,errors:r.errors}))});
  check(`${session}: populated cursor pagination`,()=>{assert.equal(rows.length,i===0?4:6);assert.equal(data.pages,i===0?2:3);assert.equal(new Set(rows.map(r=>r.key)).size,rows.length);},'SDK cursor pages read at one block; exact entity count and key uniqueness asserted');
  if(i===0)check('Clean signed session exact subtotal',()=>{assert.equal(analysis.complete,true);assert.equal(analysis.unique,3);assert.equal(analysis.totalMicro,'60000');assert.equal(analysis.settlementVerified,false);},'0.060000 USDC statement subtotal, not actual spend or payment');
  else {
   check('Different creator cannot impersonate publisher',()=>{const spoof=rows.find(r=>r.creator.toLowerCase()===ADVERSARY.toLowerCase());assert.ok(spoof);assert.equal(spoof.valid,true);assert.equal(spoof.trusted,false);},'Real second creator publishes identical session/provider identifiers; excluded');
   check('Altered signed payload rejected on real trusted-creator entity',()=>{assert.ok(rows.some(r=>r.trustedCreator&&!r.valid&&r.errors.includes('SIGNATURE_CREATOR_MISMATCH')));},'Publisher-created synthetic entity altered after signing; origin alone is insufficient');
   check('Duplicate and missing sequence keep bill incomplete',()=>{assert.equal(analysis.complete,false);assert.ok(analysis.issues.includes('Duplicate sequence 3'));assert.ok(analysis.issues.includes('Missing sequence 2'));assert.equal(analysis.totalMicro,'40000');},'Only unique trusted statements contribute, ambiguity remains explicit');
  }
  check(`${session}: actual typed u64 round-trip`,()=>{for(const e of data.entities)for(const k of ['amount_micro','period','sequence'])assert.equal(e.attributes[k].type,'u64');},'SDK decoder returned u64 tags for all three numeric product attributes');
  const trusted=await readSession({session,issuer:ISSUER,trustedOnly:true,pageSize:2});
  check(`${session}: createdBy filters chain response`,()=>{assert.equal(trusted.entities.length,i===0?4:5);assert.ok(trusted.entities.every(e=>e.creator.toLowerCase()===ISSUER.toLowerCase()));},trusted.query);
  evidence.queries.push({...trusted,entities:undefined,keys:trusted.entities.map(e=>e.key),purpose:'immutable creator filter'});save();
 }
 const amount=await readSession({session:SESSIONS[0],issuer:ISSUER,minAmount:20000n});
 check('Real numeric amount range',()=>{assert.equal(amount.entities.length,2);assert.deepEqual(amount.entities.map(e=>e.attributes.amount_micro.value).sort(),['20000','30000']);},amount.query);evidence.queries.push({...amount,entities:undefined,keys:amount.entities.map(e=>e.key),purpose:'amount range'});
 const today=await readSession({session:SESSIONS[0],issuer:ISSUER,from:1792252800n,to:1792339199n});const next=await readSession({session:SESSIONS[0],issuer:ISSUER,from:1792339200n,to:1792425599n});
 check('Billing-day positive and known-empty negative range',()=>{assert.equal(today.entities.length,4);assert.equal(next.entities.length,0);},'Same known-populated session: Oct18 returns4, Oct19 returns0');evidence.queries.push({...next,entities:undefined,keys:[],purpose:'known-empty different billing day'});
 const seqQuery=makeQuery(client,{session:SESSIONS[0],issuer:ISSUER,atBlock:await client.getBlockNumber()}).where(gte('sequence',u64(2n)));const seq=await collectPages(await seqQuery.fetch());
 check('Real numeric sequence filter',()=>{assert.equal(seq.entities.length,2);assert.deepEqual(seq.entities.map(e=>String(e.attributes.sequence.value)).sort(),['2','3']);},seqQuery.toString());
 const balances={};for(const [role,address] of Object.entries({publisher:ISSUER,adversary:ADVERSARY}))balances[role]=String(await client.getBalance({address}));evidence.remainingTestBalancesWei=balances;
 evidence.firstEntityCreatedAt=seeds.records[0].createdAt;evidence.firstWriteElapsedSeconds=Math.round((Date.parse(seeds.records[0].createdAt)-Date.parse('2026-10-17T18:28:08Z'))/1000);
 evidence.status='PASS';save();console.log(`PASS: ${evidence.checks.length} live checks; 10 successful creation transactions. First write ${evidence.firstWriteElapsedSeconds}s from sprint start.`);
}catch(e){evidence.status='FAIL';evidence.error=e.message;save();throw e;}
