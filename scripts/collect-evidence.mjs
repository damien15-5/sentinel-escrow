import fs from 'node:fs';
import {Contract,keccak256,toUtf8Bytes} from 'ethers';
import {required,manifest} from '../src/config.mjs';
import {rpc,contract,SYSTEM,save,event} from '../src/chain.mjs';
import {queryChunks} from '../src/worker.mjs';
const id=process.argv[2];if(!/^\d+$/.test(id||''))throw new Error('Usage: npm run evidence -- ESCROW_ID');
const state=manifest(),base=rpc(required('BASE_RPC_URL')),omni=rpc(required('REACTIVE_RPC_URL'));
const output={schemaVersion:1,mode:'testnet',escrowId:id,complete:false,checkedAt:new Date().toISOString(),deployment:state,steps:[],missing:[]};
try{
  if((await base.getNetwork()).chainId!==84532n||(await omni.getNetwork()).chainId!==5318007n)throw new Error('Evidence requires Base Sepolia + Lasna');
  const vault=contract('EscrowVault',state.contracts.EscrowVault.address,base), gateway=contract('AssessmentGateway',state.contracts.AssessmentGateway.address,base), reactive=contract('SentinelReactive',state.contracts.SentinelReactive.address,omni);
  const baseHead=await base.getBlockNumber(),omniHead=await omni.getBlockNumber();
  const stages=[
    ['origin',vault,vault.filters.EscrowOpened(id),base,state.contracts.EscrowVault.blockNumber,baseHead,84532],
    ['reactive-request',reactive,reactive.filters.AssessmentRouted(id),omni,state.contracts.SentinelReactive.blockNumber,omniHead,5318007],
    ['request-callback',gateway,gateway.filters.AssessmentRequested(id),base,state.contracts.AssessmentGateway.blockNumber,baseHead,84532],
    ['ai-report',gateway,gateway.filters.RiskReported(id),base,state.contracts.AssessmentGateway.blockNumber,baseHead,84532],
    ['reactive-decision',reactive,reactive.filters.DecisionRouted(id),omni,state.contracts.SentinelReactive.blockNumber,omniHead,5318007],
    ['decision-callback',vault,vault.filters.AssessmentApplied(id),base,state.contracts.EscrowVault.blockNumber,baseHead,84532],
  ];
  const logs={};
  for(const [name,instance,filter,provider,from,to,chainId]of stages){
    const matches=await queryChunks(instance,filter,from,to);if(!matches.length){output.missing.push(name);continue;}
    const log=matches[0],receipt=await provider.getTransactionReceipt(log.transactionHash),block=await provider.getBlock(receipt.blockNumber);
    if(receipt.status!==1)throw new Error(`Reverted receipt at ${name}`);
    logs[name]=log;
    output.steps.push({name,chainId,txHash:receipt.hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,timestamp:block.timestamp,gasUsed:String(receipt.gasUsed),explorer:`${chainId===84532?'https://sepolia.basescan.org':'https://lasna.reactscan.net'}/tx/${receipt.hash}`});
  }
  if(output.missing.length)throw new Error(`Waiting for: ${output.missing.join(', ')}`);
  if(logs['reactive-request'].args.originTxHash!==logs.origin.transactionHash||logs['reactive-decision'].args.reportTxHash!==logs['ai-report'].transactionHash)throw new Error('Cross-chain causality hashes do not match');
  const expectedHash=logs.origin.args.contentHash;
  for(const name of ['reactive-request','request-callback','ai-report'])if(logs[name].args.contentHash!==expectedHash)throw new Error(`Listing commitment mismatch: ${name}`);
  if(keccak256(toUtf8Bytes(logs.origin.args.listing))!==expectedHash)throw new Error('Origin listing hash mismatch');
  const report=logs['ai-report'].args,decision=logs['decision-callback'].args;
  if(report.modelHash!==state.modelHash||report.score!==decision.score||report.reportHash!==decision.reportHash||decision.frozen!==(Number(report.score)>=state.threshold))throw new Error('Model, report, score or threshold mismatch');
  const system=new Contract(SYSTEM,['function getCallbacks(uint256) view returns ((uint256 blockNumber,address reactive,uint256 callbackIndex,uint256 chainId,uint256 txHash,bytes err)[])'],omni);
  output.callbackRecords={};
  for(const [source,dest]of [['reactive-request','request-callback'],['reactive-decision','decision-callback']]){
    const records=await system.getCallbacks(BigInt(logs[source].transactionHash));
    const matching=records.find(r=>r.reactive.toLowerCase()===reactive.target.toLowerCase()&&r.chainId===84532n&&r.txHash===BigInt(logs[dest].transactionHash)&&r.err==='0x');
    if(!matching)throw new Error(`No successful system callback record yet for ${source}`);
    output.callbackRecords[source]={reactive:matching.reactive,destinationTx:logs[dest].transactionHash,err:matching.err};
  }
  const reportFile=`.state/reports/84532-${gateway.target.toLowerCase()}-${id}.json`;
  if(!fs.existsSync(reportFile))throw new Error('Missing worker report file; retain .state/reports to prove live inference');
  const serialized=fs.readFileSync(reportFile,'utf8');if(keccak256(toUtf8Bytes(serialized))!==report.reportHash)throw new Error('Worker report file does not match the on-chain commitment');
  output.report=JSON.parse(serialized);output.reportSerialized=serialized;
  const first=output.steps[0],last=output.steps.at(-1);output.observedBlockTimestampDeltaSeconds=last.timestamp-first.timestamp;
  output.timingNote='Cross-chain block timestamp difference, not a synchronized end-to-end latency benchmark.';
  output.complete=true;
}catch(error){output.error=error.shortMessage||error.message;process.exitCode=1;}
finally{save(`evidence/testnet-${id}.json`,output);console.log(JSON.stringify({complete:output.complete,file:`evidence/testnet-${id}.json`,error:output.error},null,2));base.destroy();omni.destroy();}
