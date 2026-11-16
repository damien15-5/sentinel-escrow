// Renders verified evidence/testnet-*.json + latency-*.json into Markdown. Only complete bundles are used.
import fs from 'node:fs';
const dep=JSON.parse(fs.readFileSync(process.argv.slice(2).find(a=>!a.startsWith('--'))||'deployments/ethereum-sepolia-lasna.json','utf8'));
const O=dep.originName==='ethereum-sepolia'?'https://sepolia.etherscan.io':'https://sepolia.basescan.org',L='https://lasna.reactscan.net';
const short=h=>`${h.slice(0,10)}…${h.slice(-6)}`,link=(e,h)=>`[\`${short(h)}\`](${e}/tx/${h})`;
const files=fs.readdirSync('evidence').filter(f=>/^testnet-\d+\.json$/.test(f)).sort((a,b)=>parseInt(a.slice(8))-parseInt(b.slice(8)));
const out=[];
out.push(`| Contract | Chain | Address |`,`|---|---|---|`);
out.push(`| SentinelReactive | Reactive Lasna (5318007) | [${dep.contracts.SentinelReactive.address}](${L}/address/${dep.contracts.SentinelReactive.address}) |`);
out.push(`| EscrowVault | ${dep.originName} (${dep.originChainId}) | [${dep.contracts.EscrowVault.address}](${O}/address/${dep.contracts.EscrowVault.address}) |`);
out.push(`| AssessmentGateway | ${dep.originName} (${dep.originChainId}) | [${dep.contracts.AssessmentGateway.address}](${O}/address/${dep.contracts.AssessmentGateway.address}) |`);
out.push(`| Callback proxy (official) | ${dep.originName} | \`${dep.callbackProxy}\` |`,'');
out.push(`Policy: freeze if score ≥ ${dep.threshold} bps, or ≥ ${dep.highValueThreshold} bps for deposits ≥ ${Number(BigInt(dep.highValueWei))/1e18} ETH. Model hash \`${dep.modelHash}\`.`,'');
out.push('| Escrow | Listing / deposit | Score → threshold | 1 EscrowOpened | 2 Reactive request | 3 AI job callback | 4 AI report | 5 Reactive decision | 6 Decision callback | Result | Wall-clock total |','|---|---|---|---|---|---|---|---|---|---|---|');
for(const f of files){const d=JSON.parse(fs.readFileSync(`evidence/${f}`,'utf8'));if(!d.complete)continue;
  const s=Object.fromEntries(d.steps.map(x=>[x.name,x.txHash]));let lat={};try{lat=JSON.parse(fs.readFileSync(`evidence/latency-${d.escrowId}.json`,'utf8'));}catch{}
  const p=d.policy;out.push(`| #${d.escrowId} | ${lat.scenario||'?'} / ${Number(BigInt(p.depositWei))/1e18} ETH | ${p.score} → ${p.thresholdApplied} | ${link(O,s.origin)} | ${link(L,s['reactive-request'])} | ${link(O,s['request-callback'])} | ${link(O,s['ai-report'])} | ${link(L,s['reactive-decision'])} | ${link(O,s['decision-callback'])} | **${p.frozen?'Frozen':'Cleared'}** | ${lat.totalSecondsOpenConfirmedToDecisionSeen??'?'} s |`);}
out.push('','Wall-clock legs (seconds after the previous stage was seen; 1 s RPC polling):','','| Escrow | → Reactive request | → AI job callback | → AI report (incl. confirmations + inference) | → Reactive decision | → decision callback |','|---|---|---|---|---|---|');
for(const f of files){const id=f.slice(8,-5);try{const l=JSON.parse(fs.readFileSync(`evidence/latency-${id}.json`,'utf8')).stages;out.push(`| #${id} | ${l['reactive-request'].secondsSincePrevious} | ${l['request-callback'].secondsSincePrevious} | ${l['ai-report'].secondsSincePrevious} | ${l['reactive-decision'].secondsSincePrevious} | ${l['decision-callback'].secondsSincePrevious} |`);}catch{}}
try{const st=JSON.parse(fs.readFileSync('evidence/settlements-ethereum-sepolia.json','utf8'));out.push('',`Buyer settlements: release of cleared #${st.release.escrowId} ${link(O,st.release.tx)}, refund of frozen #${st.frozenRefund.escrowId} ${link(O,st.frozenRefund.tx)}. Escrows #3 (Cleared) and #4 (Frozen) were left open for the demo video.`);}catch{}
const md=out.join('\n');
if(process.argv.includes('--write')){for(const file of ['README.md','docs/SUBMISSION.md']){let t=fs.readFileSync(file,'utf8');const a=t.indexOf('<!-- LIVE:START -->'),b=t.indexOf('<!-- LIVE:END -->');if(a>=0&&b>a){t=t.slice(0,a)+'<!-- LIVE:START -->\n'+md+'\n'+t.slice(b);fs.writeFileSync(file,t);}}}
console.log(md);
