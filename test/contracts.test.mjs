import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseEther,ZeroAddress,ZeroHash,keccak256,toUtf8Bytes,toBeHex} from 'ethers';
import {compile} from '../scripts/compile.mjs';
import {localFixture,localLoop,openLocal,relay} from '../src/local.mjs';
import {event,record,deploy} from '../src/chain.mjs';
import {SCENARIOS} from '../model/features.mjs';
import {MODEL_HASH} from '../src/risk.mjs';
import {processJob} from '../src/worker.mjs';
let f;
before(async()=>{compile();f=await localFixture();});
after(async()=>{await f?.close();});
const rejected=async(action)=>assert.rejects(async()=>{const tx=await action();if(tx?.wait)await tx.wait();});

test('safe listing traverses both reactive callbacks; only buyer may release',async()=>{
  const run=await localLoop(f,SCENARIOS.safe.listing);
  assert.equal(run.steps.length,6);assert.equal(run.status,'Cleared');assert.ok(run.report.score<6500);
  await rejected(()=>f.vault.connect(f.seller).release(run.id));
  await(await f.vault.connect(f.buyer).release(run.id)).wait();
  assert.equal((await f.vault.escrows(run.id)).state,4n);
  await rejected(()=>f.vault.connect(f.buyer).release(run.id));
  await rejected(()=>f.vault.connect(f.buyer).refund(run.id));
});
test('risky listing freezes; buyer refunds; seller never takes funds',async()=>{
  const run=await localLoop(f,SCENARIOS.risky.listing);assert.equal(run.status,'Frozen');assert.ok(run.report.score>=6500);
  await rejected(()=>f.vault.connect(f.buyer).release(run.id));
  await(await f.vault.connect(f.buyer).refund(run.id)).wait();
  assert.equal((await f.vault.escrows(run.id)).state,5n);
  await rejected(()=>f.vault.connect(f.buyer).refund(run.id));
});
test('direct callers cannot forge react, gateway callbacks, decisions or reports',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.safe.listing);const log=event(receipt,f.vault,'EscrowOpened').log;
  await rejected(()=>f.reactive.react(record(log,31337)));
  await rejected(()=>f.gateway.requestAssessment(f.reactive.target,id,log.topics[2],9999999999));
  await rejected(()=>f.gateway.deliverDecision(f.reactive.target,id,log.topics[2],0,false,MODEL_HASH));
  await rejected(()=>f.vault.applyAssessment(id,log.topics[2],0,false,MODEL_HASH));
  await rejected(()=>f.gateway.connect(f.stranger).reportRisk(id,0,MODEL_HASH));
});
test('legitimate proxy rejects callbacks from a different reactive contract',async()=>{
  const {receipt}=await openLocal(f,SCENARIOS.safe.listing);
  const trigger=await(await f.system.trigger(f.reactive.target,record(event(receipt,f.vault,'EscrowOpened').log,31337))).wait();
  const cb=event(trigger,f.system,'CallbackRequested').parsed.args;
  await rejected(()=>f.proxy.deliver(awaitAddress(f.stranger),cb.recipient,cb.payload));
});
function awaitAddress(signer){return signer.getAddress();}
test('reactive validates source chain, contract, topic and topic count',async()=>{
  const {receipt}=await openLocal(f,SCENARIOS.safe.listing);const valid=record(event(receipt,f.vault,'EscrowOpened').log,31337);
  for(const invalid of [{chainId:1},{contractAddress:ZeroAddress},{topic0:0},{opCode:2}])await rejected(()=>f.system.trigger(f.reactive.target,{...valid,...invalid}));
});
test('duplicate origin events request only one assessment',async()=>{
  const {receipt}=await openLocal(f,SCENARIOS.safe.listing);const log=record(event(receipt,f.vault,'EscrowOpened').log,31337);
  await(await f.system.trigger(f.reactive.target,log)).wait();
  const duplicate=await(await f.system.trigger(f.reactive.target,log)).wait();
  assert.throws(()=>event(duplicate,f.system,'CallbackRequested'),/Missing/);
});
test('report cannot precede job; invalid, duplicate and expired reports fail',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.safe.listing);
  await rejected(()=>f.gateway.connect(f.reporter).reportRisk(id,1,MODEL_HASH));
  await relay(f,receipt,f.vault,'EscrowOpened');
  await rejected(()=>f.gateway.connect(f.reporter).reportRisk(id,10001,MODEL_HASH));
  await rejected(()=>f.gateway.connect(f.reporter).reportRisk(id,1,ZeroHash));
  await(await f.gateway.connect(f.reporter).reportRisk(id,1,MODEL_HASH)).wait();
  await rejected(()=>f.gateway.connect(f.reporter).reportRisk(id,1,MODEL_HASH));
});
test('report threshold boundary freezes at exactly 6500 and clears at 6499',async()=>{
  for(const score of [6499,6500]){
    const {receipt,id}=await openLocal(f,SCENARIOS.safe.listing);await relay(f,receipt,f.vault,'EscrowOpened');
    const report=await(await f.gateway.connect(f.reporter).reportRisk(id,score,MODEL_HASH)).wait();
    await relay(f,report,f.gateway,'RiskReported');
    assert.equal((await f.vault.escrows(id)).state,score===6500?3n:2n);
  }
});
test('AI worker processes an on-chain job with live inference and safely skips replay',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.risky.listing);const request=await relay(f,receipt,f.vault,'EscrowOpened');
  const jobLog=(await f.gateway.queryFilter(f.gateway.filters.AssessmentRequested(id),request.callbackReceipt.blockNumber,request.callbackReceipt.blockNumber))[0];
  const args={gateway:f.gateway.connect(f.reporter),vault:f.vault,provider:f.base,jobLog,originStart:0,chainId:31337,reportsDir:'.state/test-reports'};
  const result=await processJob(args);assert.equal(result.status,'reported');assert.ok(result.score>=6500);
  assert.equal((await processJob(args)).status,'already-reported');
});
test('callback replay cannot reverse a refund',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.risky.listing);await relay(f,receipt,f.vault,'EscrowOpened');
  const report=await(await f.gateway.connect(f.reporter).reportRisk(id,9000,MODEL_HASH)).wait();
  const decision=await relay(f,report,f.gateway,'RiskReported');
  await(await f.vault.connect(f.buyer).refund(id)).wait();
  const cb=event(decision.reactiveReceipt,f.system,'CallbackRequested').parsed.args;
  await(await f.proxy.deliver(cb.reactive,cb.recipient,cb.payload)).wait();
  assert.equal((await f.vault.escrows(id)).state,5n);
});
test('timestamp timeout returns pending funds after a stalled AI pipeline',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.safe.listing,60);await relay(f,receipt,f.vault,'EscrowOpened');
  await rejected(()=>f.vault.connect(f.buyer).refund(id));
  await f.baseRaw.request({method:'evm_increaseTime',params:[61]});await f.baseRaw.request({method:'evm_mine',params:[]});
  await rejected(()=>f.gateway.connect(f.reporter).reportRisk(id,1,MODEL_HASH));
  await(await f.vault.connect(f.buyer).refund(id)).wait();assert.equal((await f.vault.escrows(id)).state,5n);
});
test('callback fee payer cannot drain escrow deposits',async()=>{
  const locked=await f.vault.totalLocked(),balance=await f.base.getBalance(f.vault.target);
  await(await f.proxy.charge(f.gateway.target,parseEther('.001'))).wait();
  assert.equal(await f.base.getBalance(f.vault.target),balance);assert.equal(await f.vault.totalLocked(),locked);
  await rejected(()=>f.proxy.charge(f.vault.target,1));
  await rejected(()=>f.gateway.pay(1));
});
test('configuration is one-time and owner-only',async()=>{
  await rejected(()=>f.vault.configureGateway(f.proxy.target));
  await rejected(()=>f.reactive.configure(f.vault.target,f.gateway.target));
  const stranger=await f.omni.getSigner(1);
  await rejected(()=>f.reactive.connect(stranger).retryDelivery(1));
});
test('input validation rejects empty, oversized, self-directed or unfunded listings',async()=>{
  for(const text of ['', 'x'.repeat(2049)])await rejected(()=>f.vault.connect(f.buyer).open(f.seller.getAddress(),3600,text,{value:1}));
  await rejected(()=>f.vault.connect(f.buyer).open(f.buyer.getAddress(),3600,'Test',{value:1}));
  await rejected(()=>f.vault.connect(f.buyer).open(f.seller.getAddress(),3600,'Test'));
  await rejected(()=>f.vault.connect(f.buyer).open(f.seller.getAddress(),1,'Test',{value:1}));
});
test('reentrant buyer cannot withdraw the deposit twice',async()=>{
  const receiver=await deploy('ReentrantBuyer',f.owner,[f.vault.target]);
  const opened=await(await receiver.open(await f.seller.getAddress(),SCENARIOS.risky.listing,{value:parseEther('.01')})).wait();
  const id=await receiver.id();await relay(f,opened,f.vault,'EscrowOpened');
  const report=await(await f.gateway.connect(f.reporter).reportRisk(id,9000,MODEL_HASH)).wait();await relay(f,report,f.gateway,'RiskReported');
  const before=await f.vault.totalLocked();await(await receiver.refund()).wait();
  assert.equal(await receiver.reentrySucceeded(),false);assert.equal(await f.base.getBalance(receiver.target),parseEther('.01'));
  assert.equal(await f.vault.totalLocked(),before-parseEther('.01'));
});
test('report with mismatched commitment or model cannot cause a decision',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.safe.listing);await relay(f,receipt,f.vault,'EscrowOpened');
  const reported=await(await f.gateway.connect(f.reporter).reportRisk(id,1,MODEL_HASH)).wait();
  const valid=record(event(reported,f.gateway,'RiskReported').log,31337);
  await rejected(()=>f.system.trigger(f.reactive.target,{...valid,topic2:1n}));
  const wrongModel=f.gateway.interface.encodeEventLog(f.gateway.interface.getEvent('RiskReported'),[id,toBeHex(valid.topic2,32),1,MODEL_HASH,ZeroHash]);
  await rejected(()=>f.system.trigger(f.reactive.target,{...valid,data:wrongModel.data}));
  assert.equal((await f.reactive.requests(id)).decided,false);
});
test('owner retry replays only the stored decision and preserves threshold',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.safe.listing);await relay(f,receipt,f.vault,'EscrowOpened');
  const report=await(await f.gateway.connect(f.reporter).reportRisk(id,6499,MODEL_HASH)).wait();
  await relay(f,report,f.gateway,'RiskReported');
  await f.omniRaw.request({method:'evm_increaseTime',params:[31]});await f.omniRaw.request({method:'evm_mine',params:[]});
  const retried=await(await f.reactive.retryDelivery(id)).wait();
  const cb=event(retried,f.system,'CallbackRequested').parsed.args;
  const decoded=f.gateway.interface.decodeFunctionData('deliverDecision',cb.payload);
  assert.equal(decoded.score,6499n);assert.equal(decoded.frozen,false);
  await rejected(()=>f.reactive.retryDelivery(id));
});
test('worker retry preserves the original report bytes across submission failures',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.risky.listing);const request=await relay(f,receipt,f.vault,'EscrowOpened');
  const jobLog=(await f.gateway.queryFilter(f.gateway.filters.AssessmentRequested(id),request.callbackReceipt.blockNumber,request.callbackReceipt.blockNumber))[0];
  const gateway=f.gateway.connect(f.reporter);
  const args={gateway,vault:f.vault,provider:f.base,jobLog,originStart:0,chainId:31337,reportsDir:'.state/test-retry-reports'};
  await assert.rejects(()=>processJob({...args,gateway:{target:gateway.target,jobs:gateway.jobs.bind(gateway),reportRisk:async()=>{throw new Error('Simulated RPC submission failure');}}}),/Simulated/);
  const file=`${args.reportsDir}/31337-${gateway.target.toLowerCase()}-${id}.json`,before=fs.readFileSync(file,'utf8');
  const reported=await processJob(args);
  assert.equal(fs.readFileSync(file,'utf8'),before);assert.equal(reported.reportHash,keccak256(toUtf8Bytes(before)));
});
test('size-aware policy: same live score clears a small deposit and freezes a large one',async()=>{
  const small=await localLoop(f,SCENARIOS.borderline.listing,()=>{},'.01');
  const large=await localLoop(f,SCENARIOS.borderline.listing,()=>{},'1');
  assert.equal(small.report.score,large.report.score);
  assert.ok(small.report.score>=5000&&small.report.score<6500,`borderline score ${small.report.score}`);
  assert.equal(small.threshold,6500);assert.equal(small.status,'Cleared');
  assert.equal(large.threshold,5000);assert.equal(large.status,'Frozen');
});
test('size-aware threshold is fixed at deposit time and preserved by retry',async()=>{
  const {receipt,id}=await openLocal(f,SCENARIOS.safe.listing,3600,'1');await relay(f,receipt,f.vault,'EscrowOpened');
  assert.equal((await f.reactive.requests(id)).threshold,5000n);
  const report=await(await f.gateway.connect(f.reporter).reportRisk(id,5000,MODEL_HASH)).wait();
  const decision=await relay(f,report,f.gateway,'RiskReported');
  assert.equal(event(decision.reactiveReceipt,f.reactive,'DecisionRouted').parsed.args.thresholdApplied,5000n);
  await f.omniRaw.request({method:'evm_increaseTime',params:[31]});await f.omniRaw.request({method:'evm_mine',params:[]});
  const retried=await(await f.reactive.retryDelivery(id)).wait();
  const decoded=f.gateway.interface.decodeFunctionData('deliverDecision',event(retried,f.system,'CallbackRequested').parsed.args.payload);
  assert.equal(decoded.frozen,true);
});
test('constructor rejects a high-value threshold looser than the base threshold',async()=>{
  await assert.rejects(()=>deploy('SentinelReactive',f.omniOwner,[31337,6500,7000,parseEther('1'),MODEL_HASH],parseEther('1')));
});
