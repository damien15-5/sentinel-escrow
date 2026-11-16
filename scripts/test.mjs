import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
// Direct file runners keep named assertions visible across Node 22/24 environments.
for(const file of fs.readdirSync('test').filter(f=>f.endsWith('.test.mjs')).sort()){
  const result=spawnSync(process.execPath,[`test/${file}`],{stdio:'inherit'});
  if(result.status!==0)process.exit(result.status||1);
}
