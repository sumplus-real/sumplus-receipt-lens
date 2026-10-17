import fs from 'node:fs';import assert from 'node:assert/strict';import {makeClient,makeQuery,collectPages} from '../src/arkiv.mjs';import {ISSUER,SESSIONS} from '../src/config.mjs';
const evidenceDir=process.env.RECEIPT_LENS_EVIDENCE_DIR||'evidence';
fs.mkdirSync(evidenceDir,{recursive:true});
const client=makeClient();const record={checkedAt:new Date().toISOString(),sdk:'0.8.1',waitMs:2500};
const bad=makeQuery(client,{session:SESSIONS[1],issuer:ISSUER});const first=await bad.fetch();assert.equal(first.entities.length,2);assert.equal(first.hasNextPage(),true);record.unpinned={query:bad.toString(),firstBlock:String(first.blockNumber)};
await new Promise(r=>setTimeout(r,2500));try{const next=await first.next();record.unpinned={...record.unpinned,actual:'Succeeded',nextBlock:String(next.blockNumber)};}catch(e){record.unpinned={...record.unpinned,actual:'Rejected',kind:e.kind,code:e.code,message:e.message,data:e.data};}
const atBlock=await client.getBlockNumber();const good=makeQuery(client,{session:SESSIONS[1],issuer:ISSUER,atBlock});const goodFirst=await good.fetch();await new Promise(r=>setTimeout(r,2500));const all=await collectPages(goodFirst);assert.equal(all.entities.length,6);assert.equal(all.pages,3);assert.equal(all.blockNumber,String(atBlock));record.pinned={query:good.toString(),explicitAtBlock:String(atBlock),actual:'PASS',entities:6,pages:3,keys:all.entities.map(e=>e.key)};
fs.writeFileSync(`${evidenceDir}/cursor-live-regression.json`,JSON.stringify(record,null,2));console.log(JSON.stringify(record,null,2));
