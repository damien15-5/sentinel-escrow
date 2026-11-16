import fs from 'node:fs';
import {features, FEATURE_NAMES, SCENARIOS} from './features.mjs';
import {forward} from './network.mjs';
// Reproducible synthetic curriculum. This trains an actual MLP, not a production fraud detector.
let seed = 20261116;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0; return seed/4294967296;};
const good = ['Tested model with serial number and photos included.', 'Shipping with tracking and invoice within 3 days.', 'Buyer inspection, refund policy and escrow protection.', 'Condition and dimensions listed with specifications.', 'Delivery receipt after each milestone; dispute and return policy available.'];
const bad = ['Official support agent requests your seed phrase and private key.', 'Pay directly on Telegram outside the platform.', 'Guaranteed double your investment returns, risk-free daily returns.', 'Urgent, act now immediately, last chance.', 'Crypto only, no refunds; wire transfer or gift card.', 'Verify your wallet to unlock your account with our security team.'];
const vague = ['Mystery package, details later, trust me.', 'Today only; no questions; secret deal.'];
const samples=[];
for(let i=0;i<1600;i++){
  const risk=i%2===0;
  const pool=risk?bad:good;
  const parts=Array.from({length:2+Math.floor(random()*3)},()=>pool[Math.floor(random()*pool.length)]);
  if(risk && random()<.6) parts.push(good[Math.floor(random()*good.length)]);
  if(random()<.18) parts.push(vague[Math.floor(random()*vague.length)]);
  samples.push({x:features(parts.join(' ')), y:risk?1:0});
}
// Ambiguity is treated cautiously in this demo curriculum.
for(let i=0;i<200;i++) samples.push({x:features(vague.join(' ')), y:1});
const model={schemaVersion:1,name:'sentinel-mlp-v1',architecture:'10 → 12 tanh → 1 sigmoid',featureNames:FEATURE_NAMES,training:{seed:20261116,kind:'synthetic curriculum',samples:samples.length,epochs:140,warning:'Demonstration only. No real-world fraud validation or calibrated probabilities.'},w1:Array.from({length:12},()=>Array.from({length:10},()=> (random()-.5)*.5)),b1:Array(12).fill(0),w2:Array.from({length:12},()=> (random()-.5)*.5),b2:0};
for(let epoch=0;epoch<140;epoch++){
  for(let i=samples.length-1;i>0;i--){const j=Math.floor(random()*(i+1)); [samples[i],samples[j]]=[samples[j],samples[i]];}
  for(const {x,y} of samples){
    const {hidden,probability}=forward(model,x); const delta=probability-y; const rate=.018;
    for(let h=0;h<12;h++){
      const dh=delta*model.w2[h]*(1-hidden[h]*hidden[h]);
      for(let j=0;j<10;j++) model.w1[h][j]-=rate*(dh*x[j]+.0002*model.w1[h][j]);
      model.b1[h]-=rate*dh; model.w2[h]-=rate*(delta*hidden[h]+.0002*model.w2[h]);
    }
    model.b2-=rate*delta;
  }
}
fs.writeFileSync('model/weights.json',JSON.stringify(model,null,2)+'\n');
const probes=Object.fromEntries(Object.entries(SCENARIOS).map(([name,{listing}])=>[name,Math.round(forward(model,features(listing)).probability*10000)]));
console.log(JSON.stringify({trained:model.name,parameters:145,probes},null,2));
