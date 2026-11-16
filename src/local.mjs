import ganache from 'ganache';
import {BrowserProvider,Contract,parseEther} from 'ethers';
import {artifact,deploy,SYSTEM,event,record} from './chain.mjs';
import {MODEL_HASH,assess} from './risk.mjs';

export async function localFixture() {
  const baseRaw=ganache.provider({chain:{chainId:31337,hardfork:'shanghai'},wallet:{totalAccounts:6,defaultBalance:1000},logging:{quiet:true}});
  const omniRaw=ganache.provider({chain:{chainId:31338,hardfork:'shanghai'},wallet:{totalAccounts:4,defaultBalance:1000},logging:{quiet:true}});
  const base=new BrowserProvider(baseRaw,undefined,{cacheTimeout:-1}); const omni=new BrowserProvider(omniRaw,undefined,{cacheTimeout:-1});
  base.pollingInterval=50; omni.pollingInterval=50;
  const owner=await base.getSigner(0), buyer=await base.getSigner(1), seller=await base.getSigner(2), reporter=await base.getSigner(3), stranger=await base.getSigner(4), omniOwner=await omni.getSigner(0);
  await omniRaw.request({method:'evm_setAccountCode',params:[SYSTEM,artifact('MockOmni').deployedBytecode]});
  const system=new Contract(SYSTEM,artifact('MockOmni').abi,omniOwner);
  const proxy=await deploy('MockCallbackProxy',owner);
  const reactive=await deploy('SentinelReactive',omniOwner,[31337,6500,MODEL_HASH],parseEther('1'));
  const vault=await deploy('EscrowVault',owner);
  const gateway=await deploy('AssessmentGateway',owner,[proxy.target,reactive.target,await reporter.getAddress(),vault.target,MODEL_HASH],parseEther('.1'));
  await (await vault.configureGateway(gateway.target)).wait();
  await (await reactive.configure(vault.target,gateway.target)).wait();
  const f={baseRaw,omniRaw,base,omni,owner,buyer,seller,reporter,stranger,omniOwner,system,proxy,reactive,vault,gateway};
  f.close=async()=>{base.destroy();omni.destroy();await baseRaw.disconnect();await omniRaw.disconnect();};
  return f;
}
export async function openLocal(f,listing,duration=3600){
  const receipt=await(await f.vault.connect(f.buyer).open(await f.seller.getAddress(),duration,listing,{value:parseEther('.01')})).wait();
  return {receipt,id:event(receipt,f.vault,'EscrowOpened').parsed.args.id};
}
export async function relay(f,receipt,source,eventName){
  const {log}=event(receipt,source,eventName);
  const reactiveReceipt=await(await f.system.trigger(f.reactive.target,record(log,31337))).wait();
  const callback=event(reactiveReceipt,f.system,'CallbackRequested').parsed.args;
  const callbackReceipt=await(await f.proxy.deliver(callback.reactive,callback.recipient,callback.payload,{gasLimit:callback.gasLimit})).wait();
  return {reactiveReceipt,callbackReceipt};
}
export async function localLoop(f,listing,onStep=()=>{}){
  const started=Date.now(); const steps=[];
  async function step(name,chain,receipt,detail){const item={name,chain,txHash:receipt.hash,blockNumber:receipt.blockNumber,gasUsed:String(receipt.gasUsed),observedAt:new Date().toISOString(),detail};steps.push(item);await onStep(item);}
  const {receipt:opened,id}=await openLocal(f,listing);
  await step('Escrow opened','local-origin',opened,'Buyer deposit locked; listing committed on-chain');
  const request=await relay(f,opened,f.vault,'EscrowOpened');
  await step('Assessment routed','local-reactive',request.reactiveReceipt,'Reactive validates origin and requests a callback');
  await step('AI job requested','local-origin',request.callbackReceipt,'Authenticated callback creates the inference job');
  const report=assess(listing,{chainId:31337,gateway:f.gateway.target,escrowId:String(id)});
  const reported=await(await f.gateway.connect(f.reporter).reportRisk(id,report.score,report.reportHash)).wait();
  await step('Live AI report committed','local-origin',reported,`Neural model scored ${report.score}/10000`);
  const decision=await relay(f,reported,f.gateway,'RiskReported');
  await step('Decision routed','local-reactive',decision.reactiveReceipt,'Reactive applies the immutable 6500 risk threshold');
  await step('Escrow updated','local-origin',decision.callbackReceipt,'Authenticated callback enforces the decision');
  const item=await f.vault.escrows(id);
  return {schemaVersion:1,mode:'local-simulation',networkDisclaimer:'Two local EVM chains with mock Omni transport. These are real local receipts, not Lasna/Base Sepolia transactions or latency measurements.',id:String(id),listing,threshold:6500,status:Number(item.state)===3?'Frozen':'Cleared',amountEth:'.01',report,steps,elapsedMs:Date.now()-started,contracts:{vault:f.vault.target,gateway:f.gateway.target,reactive:f.reactive.target,proxy:f.proxy.target},chainIds:{origin:31337,reactive:31338}};
}
