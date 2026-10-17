export function rpcErrorInfo(error){
 const chain=[];let current=error;
 for(let i=0;current&&i<6;i++,current=current.cause) chain.push({name:current.name,status:current.status,code:current.code,kind:current.kind,detail:String(current.details||current.shortMessage||current.message||'').slice(0,240)});
 return chain;
}
export function rpcErrorMessage(error){
 const info=rpcErrorInfo(error);
 if(info.some(x=>x.status===429))return `RPC rate limit (HTTP 429). ${error.retryAfterSeconds?`Server asks to retry in ${Math.ceil(error.retryAfterSeconds/60)} minutes`:'Retry later'} or choose another public endpoint`;
 if(info.some(x=>x.kind==='cursor'))return 'RPC cursor rejected. Start a fresh query; incomplete pages were discarded';
 if(info.some(x=>/timeout/i.test(x.name)))return 'RPC timed out. Retry or check the endpoint';
 const detail=info.find(x=>x.detail&&!/HTTP request failed\.?$/.test(x.detail))?.detail;
 return detail||error.shortMessage||error.message||'RPC request failed';
}
