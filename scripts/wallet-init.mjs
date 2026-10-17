import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
// Dedicated disposable Tiramisu wallets, never the user's real wallets.
const dir = path.join(os.homedir(), '.config/sumplus/arkiv-receipt-lens');
fs.mkdirSync(dir, {recursive:true,mode:0o700});
fs.chmodSync(dir,0o700);
const file = path.join(dir,'test-wallets.json');
if (!fs.existsSync(file)) fs.writeFileSync(file,JSON.stringify({publisher:generatePrivateKey(),adversary:generatePrivateKey()}),{mode:0o600,flag:'wx'});
fs.chmodSync(file,0o600);
const keys=JSON.parse(fs.readFileSync(file));
if(!keys.reader){keys.reader=generatePrivateKey();fs.writeFileSync(file,JSON.stringify(keys),{mode:0o600});fs.chmodSync(file,0o600);}
console.log(JSON.stringify({secretOutsideRepository:true,mode:(fs.statSync(file).mode&0o777).toString(8),...Object.fromEntries(Object.entries(keys).map(([role,k])=>[role,privateKeyToAccount(k).address]))},null,2));
