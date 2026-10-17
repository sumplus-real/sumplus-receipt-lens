import fs from 'node:fs';import {makeClient} from '../src/arkiv.mjs';
const evidenceDir=process.env.RECEIPT_LENS_EVIDENCE_DIR||'evidence';
fs.mkdirSync(evidenceDir,{recursive:true});
const client=makeClient();const chain=await client.getChainId();if(chain!==7738577)throw Error('Wrong chain');const gasPrice=await client.getGasPrice();const block=await client.getBlock();const timing=await client.getBlockTiming();const result={checkedAt:new Date().toISOString(),chain,gasPriceWei:String(gasPrice),block:String(block.number),baseFeePerGasWei:String(block.baseFeePerGas),blockTiming:timing};fs.writeFileSync(`${evidenceDir}/fee-probe.json`,JSON.stringify(result,(_,v)=>typeof v==='bigint'?String(v):v,2));console.log(result);
