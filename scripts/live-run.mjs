// Opens one testnet escrow and measures wall-clock latency of every loop stage as observed over RPC
// (1 s polling, so each figure has about 1 s of granularity). Hashes come only from chain logs.
import {parseEther,isAddress} from 'ethers';
import {required,manifest,atomic} from '../src/config.mjs';
import {rpc,signer,contract,event,originRpcUrl,originOf,requireLasna,LASNA_EXPLORER} from '../src/chain.mjs';
import {SCENARIOS} from '../model/features.mjs';
const [scenario='safe',amountEth='.0001']=process.argv.slice(2);
const seller=required('SELLER_ADDRESS');
if(!SCENARIOS[scenario]||!isAddress(seller))throw new Error('Usage: node scripts/live-run.mjs SCENARIO [AMOUNT_ETH] (SELLER_ADDRESS in env)');
const state=manifest(),base=rpc(originRpcUrl()),omni=rpc(required('REACTIVE_RPC_URL'));
try{
  const origin=await originOf(base,state.originChainId);await requireLasna(omni);
  const buyer=signer(required('BUYER_PRIVATE_KEY'),base);
  const vault=contract('EscrowVault',state.contracts.EscrowVault.address,buyer),gateway=contract('AssessmentGateway',state.contracts.AssessmentGateway.address,base),reactive=contract('SentinelReactive',state.contracts.SentinelReactive.address,omni);
  const t0=Date.now();
  const receipt=await(await vault.open(seller,3600,SCENARIOS[scenario].listing,{value:parseEther(amountEth)})).wait();
  const tOpen=Date.now(),id=event(receipt,vault,'EscrowOpened').parsed.args.id;
  console.log(`escrow ${id} (${scenario}, ${amountEth} ETH) origin ${origin.explorer}/tx/${receipt.hash}`);
  const omniFrom=await omni.getBlockNumber()-30,baseFrom=receipt.blockNumber;
  const stages=[['reactive-request',reactive,()=>reactive.filters.AssessmentRouted(id),omni,omniFrom],['request-callback',gateway,()=>gateway.filters.AssessmentRequested(id),base,baseFrom],['ai-report',gateway,()=>gateway.filters.RiskReported(id),base,baseFrom],['reactive-decision',reactive,()=>reactive.filters.DecisionRouted(id),omni,omniFrom],['decision-callback',vault,()=>vault.filters.AssessmentApplied(id),base,baseFrom]];
  const seen={origin:{tx:receipt.hash,ms:tOpen-t0}};let prev=tOpen;
  for(const [name,c,filter,provider,from]of stages){
    let log;for(let i=0;i<900&&!log;i++){try{const head=await provider.getBlockNumber();if(head>=from)log=(await c.queryFilter(filter(),from,head))[0];}catch(e){}if(!log)await new Promise(r=>setTimeout(r,1000));}
    if(!log)throw new Error(`Timed out waiting for ${name}`);
    const now=Date.now();seen[name]={tx:log.transactionHash,secondsSincePrevious:(now-prev)/1000,secondsSinceOpenConfirmed:(now-tOpen)/1000,explorer:`${provider===omni?LASNA_EXPLORER:origin.explorer}/tx/${log.transactionHash}`,args:Object.fromEntries(Object.entries(log.args.toObject()).map(([k,v])=>[k,typeof v==='bigint'?v.toString():v]))};prev=now;
    console.log(`${name.padEnd(18)} +${seen[name].secondsSincePrevious.toFixed(1)}s ${seen[name].explorer}`);
  }
  const out={mode:'testnet',scenario,amountEth,escrowId:String(id),origin:{chainId:origin.chainId,explorer:`${origin.explorer}/tx/${receipt.hash}`},stages:seen,totalSecondsOpenConfirmedToDecisionSeen:(prev-tOpen)/1000,measuredAt:new Date().toISOString(),method:'wall clock, 1 s RPC polling'};
  atomic(`evidence/latency-${id}.json`,out);console.log(`total ${out.totalSecondsOpenConfirmedToDecisionSeen}s -> evidence/latency-${id}.json`);
}finally{base.destroy();omni.destroy();}
