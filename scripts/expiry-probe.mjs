import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createWalletClient} from '@arkiv-network/sdk';import {tiramisu} from '@arkiv-network/sdk/chains';import {ExpirationTime,jsonToPayload} from '@arkiv-network/sdk/utils';import {eq} from '@arkiv-network/sdk/query';import {http} from 'viem';import {privateKeyToAccount} from 'viem/accounts';
import {makeClient} from '../src/arkiv.mjs';import {APP,ISSUER,CHAIN_ID} from '../src/config.mjs';
const evidenceDir=process.env.RECEIPT_LENS_EVIDENCE_DIR||'evidence';
fs.mkdirSync(evidenceDir,{recursive:true});
const file=`${evidenceDir}/expiry-probe.json`;const pub=makeClient();if(await pub.getChainId()!==CHAIN_ID)throw Error('Wrong chain');
let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)):{startedAt:new Date().toISOString(),expected:'Entity queryable before short expiration, absent afterward; creation transaction still retrievable'};
const save=()=>fs.writeFileSync(file,JSON.stringify(state,(_,v)=>typeof v==='bigint'?String(v):v,2));
if(!state.entityKey){
 const account=privateKeyToAccount(JSON.parse(fs.readFileSync(path.join(os.homedir(),'.config/sumplus/arkiv-receipt-lens/test-wallets.json'))).publisher);
 if(account.address.toLowerCase()!==ISSUER.toLowerCase())throw Error('Wrong dedicated account');
 if(await pub.getBalance({address:ISSUER})===0n){state.blocked='Dedicated test wallet has no free test GLM';save();console.log(state.blocked);process.exit(2);}
 const wallet=createWalletClient({chain:tiramisu,transport:http(undefined,{timeout:30000,retryCount:0}),account});
 Object.assign(state,await wallet.createEntity({payload:jsonToPayload({synthetic:true,purpose:'Short Entity Expiration probe, not a usage statement'}),contentType:'application/json',attributes:{app:APP,kind:'expiration-probe'},expires:ExpirationTime.fromSeconds(30)}));delete state.blocked;save();
}
const q=await pub.select({key:true,expiresAt:true,creator:true}).where(eq('app',APP),eq('kind','expiration-probe')).createdBy(ISSUER).fetch();
state.observations??=[];state.observations.push({checkedAt:new Date().toISOString(),blockNumber:String(q.blockNumber),found:q.entities.some(e=>e.key===state.entityKey)});
const receipt=await pub.getTransactionReceipt({hash:state.txHash});state.creationTransaction={status:receipt.status,blockNumber:String(receipt.blockNumber),transactionHash:receipt.transactionHash};
save();console.log(JSON.stringify(state,(_,v)=>typeof v==='bigint'?String(v):v,2));
