import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import { createWalletClient } from '@arkiv-network/sdk';import { tiramisu } from '@arkiv-network/sdk/chains';
import { u64 } from '@arkiv-network/sdk/attr';import { ExpirationTime,jsonToPayload } from '@arkiv-network/sdk/utils';
import { http } from 'viem';import {privateKeyToAccount} from 'viem/accounts';
import {makeClient,readSession} from '../src/arkiv.mjs';import {canonical} from '../src/receipt.mjs';import {APP,CHAIN_ID,ISSUER,ADVERSARY,SESSIONS} from '../src/config.mjs';
const keys=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/sumplus/arkiv-receipt-lens/test-wallets.json')));
const pub=makeClient();const recordsFile='public/creation-evidence.json';
const evidence=fs.existsSync(recordsFile)?JSON.parse(fs.readFileSync(recordsFile)):{chain:CHAIN_ID,synthetic:true,startedAt:new Date().toISOString(),creators:{publisher:ISSUER,adversary:ADVERSARY},records:[]};
let blocked=false;
const save=()=>fs.writeFileSync(recordsFile,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?String(v):v,2));
if(await pub.getChainId()!==CHAIN_ID) throw Error('Wrong network; never write outside Tiramisu');
for(const role of ['publisher','adversary']) {
 const account=privateKeyToAccount(keys[role]);
 if(account.address.toLowerCase()!==({publisher:ISSUER,adversary:ADVERSARY})[role].toLowerCase()) throw Error('Dedicated wallet mismatch');
 const balance=await pub.getBalance({address:account.address});console.log(role,account.address,'test GLM wei',String(balance));
 if(balance===0n) {console.log('BLOCKED: fund the dedicated wallet with free test GLM only.');blocked=true;continue;}
 const wallet=createWalletClient({chain:tiramisu,transport:http(undefined,{retryCount:0,timeout:30000}),account});
 const jobs=[];const period='1792252800'; // 2026-10-18 00:00 Shanghai, synthetic billing period.
 const statement=(session,sequence,amountMicro,kind='receipt')=>({schema:'receipt-lens/1',chain:CHAIN_ID,app:APP,kind,session,provider:'synthetic-ai-provider',sequence,amountMicro,period,expectedCount:'3',totalMicro:'60000',usageUnits:kind==='receipt'?'100':'0',settlementRef:kind==='receipt'?`synthetic:unverified-${sequence}`:'synthetic:none',synthetic:true});
 if(role==='publisher') {
  for(const [i,amount] of ['10000','20000','30000'].entries()) jobs.push({id:`clean-${i+1}`,body:statement(SESSIONS[0],String(i+1),amount)});
  jobs.push({id:'clean-close',body:statement(SESSIONS[0],'0','0','session-close'),days:90});
  for(const seq of [1,3]) jobs.push({id:`dispute-${seq}`,body:statement(SESSIONS[1],String(seq),String(seq*10000))});
  jobs.push({id:'dispute-duplicate-3',body:statement(SESSIONS[1],'3','30000')});
  jobs.push({id:'dispute-tampered-2',body:statement(SESSIONS[1],'2','20000'),tamper:true});
  jobs.push({id:'dispute-close',body:statement(SESSIONS[1],'0','0','session-close'),days:90});
 }else jobs.push({id:'spoof-2',body:statement(SESSIONS[1],'2','20000')});
 for(const job of jobs){
  if(evidence.records.some(x=>x.id===job.id)) continue;
  const signature=await account.signMessage({message:canonical(job.body)});
  const body={...job.body};if(job.tamper) body.usageUnits='999';
  const result=await wallet.createEntity({payload:jsonToPayload({statement:body,signature}),contentType:'application/json',attributes:{app:APP,kind:body.kind,session:body.session,provider:body.provider,sequence:u64(body.sequence),amount_micro:u64(body.amountMicro),period:u64(body.period)},expires:ExpirationTime.fromDays(job.days||30)});
  evidence.records.push({id:job.id,role,session:body.session,sequence:body.sequence,expected:job.tamper?'invalid-signature':role==='adversary'?'untrusted-creator':'trusted',retentionDays:job.days||30,...result,createdAt:new Date().toISOString()});save();console.log('Created',job.id,result.entityKey,result.txHash);
 }
}
evidence.fundingBlocked=blocked;evidence.complete=!blocked&&evidence.records.length===10;save();
for(const session of SESSIONS){const result=await readSession({session,issuer:ISSUER});fs.writeFileSync(`../evidence/${session}-read.json`,JSON.stringify(result,null,2));console.log(session,result.entities.length,'entities',result.pages,'pages');}
save();

evidence.fundingBlocked=blocked;evidence.complete=!blocked&&evidence.records.length===10;save();if(!evidence.complete)process.exitCode=2;
