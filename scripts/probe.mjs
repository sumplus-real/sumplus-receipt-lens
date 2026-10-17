import fs from 'node:fs';
import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq } from '@arkiv-network/sdk/query';
import { http } from 'viem';
const evidenceDir=process.env.RECEIPT_LENS_EVIDENCE_DIR||'evidence';
fs.mkdirSync(evidenceDir,{recursive:true});
const calls=[];
const client=createPublicClient({chain:tiramisu,transport:http(undefined,{timeout:15000,retryCount:0,onFetchRequest:r=>{calls.push({url:r.url,body:r.body})}})});
const start=Date.now();
try {
 const chain=await client.getChainId(); if(chain!==7738577) throw Error('Wrong chain');
 const result=await client.select({key:true,creator:true,attributes:true,payload:true,expiresAt:true}).where(eq('app','sumplus-receipt-lens-v1')).limit(2).fetch();
 const evidence={checkedAt:new Date().toISOString(),elapsedMs:Date.now()-start,chain,entities:result.entities.length,hasNext:result.hasNextPage(),blockNumber:result.blockNumber,calls};
 fs.writeFileSync(`${evidenceDir}/probe-read.json`,JSON.stringify(evidence,(_,v)=>typeof v==='bigint'?v.toString():v,2));
 console.log(evidence);
} catch(e) {fs.writeFileSync(`${evidenceDir}/probe-read-error.txt`,String(e));throw e;}
