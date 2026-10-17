import { createPublicClient } from '@arkiv-network/sdk';
import { tiramisu } from '@arkiv-network/sdk/chains';
import { eq,gte,lte } from '@arkiv-network/sdk/query';
import { u64 } from '@arkiv-network/sdk/attr';
import { http } from 'viem';
import { APP,CHAIN_ID,RPC } from './config.mjs';
export const fields={key:true,creator:true,owner:true,attributes:true,payload:true,createdAt:true,updatedAt:true,expiresAt:true,contentType:true};
export function makeClient(rpc=RPC,{onResponse}={}){return createPublicClient({chain:tiramisu,transport:http(rpc,{timeout:12000,retryCount:0,onFetchResponse:onResponse})});}
export function makeQuery(client,{session,issuer,trustedOnly=false,minAmount=0n,from=0n,to=18446744073709551615n,pageSize=2,atBlock,owner}) {
 const q=client.select(fields).where(eq('app',APP),eq('session',session)).limit(pageSize);
 // Omit unbounded/no-op numeric ranges: they can spend shared anonymous query
 // cost without narrowing this namespace. Keep useful user-selected ranges.
 if(minAmount>0n) q.where(gte('amount_micro',u64(minAmount)));
 if(from>0n) q.where(gte('period',u64(from)));
 if(to<18446744073709551615n) q.where(lte('period',u64(to)));
 if(trustedOnly) q.createdBy(issuer);
 if(owner) q.ownedBy(owner);
 if(atBlock!==undefined) q.atBlock(atBlock);
 return q;
}
export function normalizeEntity(e){return {key:e.key,creator:e.creator,owner:e.owner,attributes:Object.fromEntries(Object.entries(e.attributes).map(([k,v])=>[k,{type:v.type,value:typeof v.value==='bigint'?String(v.value):v.value}])),payload:e.toText(),createdAt:String(e.createdAt),updatedAt:String(e.updatedAt),expiresAt:String(e.expiresAt),contentType:e.contentType};}
export async function collectPages(first,{maxPages=100,maxEntities=1000,onPage=()=>{}}={}) {
 let page=first,block=page.blockNumber;const entities=[],keys=new Set(),cursors=new Set();let pages=0;
 while(true){
  if(++pages>maxPages) throw Error('Page safety limit reached; result incomplete');
  if(page.blockNumber!==block) throw Error('Snapshot block changed while paging');
  if(!Array.isArray(page.entities)) throw Error('Invalid entity response');
  for(const entity of page.entities){if(keys.has(entity.key)) throw Error('Repeated entity key while paging');keys.add(entity.key);entities.push(entity);}
  if(entities.length>maxEntities) throw Error('Entity safety limit reached; result incomplete');
  onPage({pages,count:entities.length,block:String(block)});
  if(!page.hasNextPage()) break;
  if(!page.cursor||cursors.has(page.cursor)) throw Error('Missing or repeated cursor');cursors.add(page.cursor);
  page=await page.next();
 }
 return {entities,blockNumber:String(block),pages};
}
export async function readSession(options) {
 const {rpc=RPC,onPage,...queryOptions}=options;
 const responses=[];
 const client=makeClient(rpc,{onResponse:r=>responses.push({status:r.status,retryAfter:r.headers.get('Retry-After'),rateLimit:r.headers.get('RateLimit'),cost:r.headers.get('Arkiv-Cost')})});
 try {
 const chainId=await client.getChainId();if(chainId!==CHAIN_ID) throw Error(`Wrong chain ${chainId}; expected ${CHAIN_ID}`);
 const snapshot=await client.getBlockNumber();
 // SDK 0.8.1 next() reuses the initial request. Pin atBlock BEFORE page one,
 // otherwise a moving head can invalidate the cursor on the public node.
 const query=makeQuery(client,{...queryOptions,atBlock:snapshot});const queryText=query.toString();
 const result=await collectPages(await query.fetch(),{onPage});
 return {...result,entities:result.entities.map(normalizeEntity),query:queryText,chainId,rpc,queriedAt:new Date().toISOString(),responses};
 }catch(error){const last=responses.at(-1);if(last?.status===429){const seconds=Number(last.retryAfter);if(Number.isFinite(seconds)&&seconds>0)error.retryAfterSeconds=seconds;}error.rpcResponses=responses;throw error;}
}
