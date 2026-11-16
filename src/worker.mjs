import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {keccak256,toUtf8Bytes} from 'ethers';
import {required,envInt,manifest,atomic} from './config.mjs';
import {contract,rpc,signer,originRpcUrl,originOf} from './chain.mjs';
import {assess,MODEL_HASH} from './risk.mjs';
export async function queryChunks(instance,filter,from,to,chunk=1000){const results=[];for(let start=from;start<=to;start+=chunk)results.push(...await instance.queryFilter(filter,start,Math.min(start+chunk-1,to)));return results;}
export async function processJob({gateway,vault,provider,jobLog,originStart,chainId,reportsDir='.state/reports'}){
  const id=jobLog.args.id;const job=await gateway.jobs(id);
  if(job.reported)return {id:String(id),status:'already-reported'};
  const head=await provider.getBlock('latest');
  const item=await vault.escrows(id);
  if(Number(item.state)!==1||BigInt(head.timestamp)>=job.deadline)return {id:String(id),status:'closed-or-expired'};
  const logs=await queryChunks(vault,vault.filters.EscrowOpened(id),originStart,jobLog.blockNumber);
  if(logs.length!==1)throw new Error(`Expected one origin event for escrow ${id}; got ${logs.length}`);
  const listing=logs[0].args.listing;
  if(keccak256(toUtf8Bytes(listing))!==job.contentHash||item.contentHash!==job.contentHash)throw new Error('Listing commitment mismatch');
  const context={chainId,gateway:gateway.target,escrowId:String(id),originTxHash:logs[0].transactionHash,requestTxHash:jobLog.transactionHash};
  const reportFile=`${reportsDir}/${chainId}-${gateway.target.toLowerCase()}-${id}.json`;
  let report;
  if(fs.existsSync(reportFile)){
    // A previous submission may still be in the mempool. Never overwrite its report bytes.
    const serialized=fs.readFileSync(reportFile,'utf8'),stored=JSON.parse(serialized);
    if(stored.contentHash!==job.contentHash||stored.modelHash!==MODEL_HASH||JSON.stringify(stored.context)!==JSON.stringify(context))throw new Error(`Persisted report context mismatch for ${id}; inspect reorg/state before retrying`);
    report={...stored,serialized,reportHash:keccak256(toUtf8Bytes(serialized))};
  }else{
    report=assess(listing,context);
    // Store exact JSON before sending, so a crash cannot lose the inference evidence.
    atomic(reportFile,report.serialized);
  }
  const receipt=await(await gateway.reportRisk(id,report.score,report.reportHash)).wait();
  return {id:String(id),status:'reported',score:report.score,reportHash:report.reportHash,txHash:receipt.hash};
}
export async function runWorker(){
  const state=manifest(), provider=rpc(originRpcUrl());
  try{
    const origin=await originOf(provider,state.originChainId);
    const reporter=signer(required('REPORTER_PRIVATE_KEY'),provider);
    const gateway=contract('AssessmentGateway',state.contracts.AssessmentGateway.address,reporter);
    const vault=contract('EscrowVault',state.contracts.EscrowVault.address,provider);
    if((await gateway.reporter()).toLowerCase()!==(await reporter.getAddress()).toLowerCase())throw new Error('Reporter key is not authorized by gateway');
    if(await gateway.modelHash()!==MODEL_HASH)throw new Error('Local weights differ from the deployed model hash');
    const checkpointFile=`.state/worker-${gateway.target.toLowerCase()}.json`;
    let checkpoint=fs.existsSync(checkpointFile)?JSON.parse(fs.readFileSync(checkpointFile,'utf8')):{nextBlock:state.contracts.AssessmentGateway.blockNumber};
    let stop=false;process.once('SIGINT',()=>{stop=true;});process.once('SIGTERM',()=>{stop=true;});
    const confirmations=envInt('CONFIRMATIONS',5,1),pollMs=envInt('POLL_MS',2000,250);
    console.log(`Watching confirmed AssessmentRequested jobs at ${gateway.target}. Model ${MODEL_HASH}`);
    while(!stop){
      try{
        if(checkpoint.blockHash){const block=await provider.getBlock(checkpoint.nextBlock-1);if(block?.hash!==checkpoint.blockHash){checkpoint={nextBlock:Math.max(state.contracts.AssessmentGateway.blockNumber,checkpoint.nextBlock-100)};}}
        const safeHead=await provider.getBlockNumber()-confirmations;
        const to=Math.min(safeHead,checkpoint.nextBlock+999);
        if(to>=checkpoint.nextBlock){
          const jobs=await gateway.queryFilter(gateway.filters.AssessmentRequested(),checkpoint.nextBlock,to);
          for(const jobLog of jobs)console.log(JSON.stringify(await processJob({gateway,vault,provider,jobLog,originStart:state.contracts.EscrowVault.blockNumber,chainId:origin.chainId})));
          const block=await provider.getBlock(to);checkpoint={nextBlock:to+1,blockHash:block.hash};atomic(checkpointFile,checkpoint);
        }
      }catch(error){reporter.reset();console.error(`Worker retry: ${error.shortMessage||error.message}`);}
      if(!stop)await new Promise(resolve=>setTimeout(resolve,pollMs));
    }
  }finally{provider.destroy();}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runWorker().catch(error=>{console.error(error.shortMessage||error.message);process.exitCode=1;});
