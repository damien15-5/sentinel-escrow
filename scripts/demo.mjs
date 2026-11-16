import fs from 'node:fs';
import {compile} from './compile.mjs';
import {localFixture,localLoop} from '../src/local.mjs';
import {SCENARIOS} from '../model/features.mjs';
import {save} from '../src/chain.mjs';
compile(); const f=await localFixture();
try{
  const runs=[];
  for(const [name,scenario] of Object.entries(SCENARIOS)){
    console.log(`\n${name.toUpperCase()}: ${scenario.title}`);
    const run=await localLoop(f,scenario.listing,s=>console.log(`  ${s.name}: ${s.txHash}`));
    runs.push({...run,scenario:name,title:scenario.title});
    console.log(`  ${run.status}: ${run.report.score}/10000`);
  }
  save('evidence/local-demo.json',{generatedAt:new Date().toISOString(),mode:'local-simulation',runs});
  console.log('\nSaved evidence/local-demo.json. Local receipts are NOT submission evidence.');
}finally{await f.close();}
