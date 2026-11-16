import fs from 'node:fs';
import {Contract,Interface,AbiCoder,keccak256,toUtf8Bytes} from 'ethers';
import {required,manifest} from '../src/config.mjs';
import {rpc,contract,SYSTEM,save,event,originRpcUrl,originOf,requireLasna,LASNA_EXPLORER} from '../src/chain.mjs';
import {queryChunks} from '../src/worker.mjs';
const id=process.argv[2];if(!/^\d+$/.test(id||''))throw new Error('Usage: npm run evidence -- ESCROW_ID');
const state=manifest(),base=rpc(originRpcUrl()),omni=rpc(required('REACTIVE_RPC_URL'));
const output={schemaVersion:1,mode:'testnet',escrowId:id,complete:false,checkedAt:new Date().toISOString(),deployment:state,steps:[],missing:[]};
try{
  const origin=await originOf(base,state.originChainId);await requireLasna(omni);const O=origin.chainId;
  const vault=contract('EscrowVault',state.contracts.EscrowVault.address,base), gateway=contract('AssessmentGateway',state.contracts.AssessmentGateway.address,base), reactive=contract('SentinelReactive',state.contracts.SentinelReactive.address,omni);
  const baseHead=await base.getBlockNumber(),omniHead=await omni.getBlockNumber();
  const stages=[
    ['origin',vault,vault.filters.EscrowOpened(id),base,state.contracts.EscrowVault.blockNumber,baseHead,O],
    ['reactive-request',reactive,reactive.filters.AssessmentRouted(id),omni,state.contracts.SentinelReactive.blockNumber,omniHead,5318007],
    ['request-callback',gateway,gateway.filters.AssessmentRequested(id),base,state.contracts.AssessmentGateway.blockNumber,baseHead,O],
    ['ai-report',gateway,gateway.filters.RiskReported(id),base,state.contracts.AssessmentGateway.blockNumber,baseHead,O],
    ['reactive-decision',reactive,reactive.filters.DecisionRouted(id),omni,state.contracts.SentinelReactive.blockNumber,omniHead,5318007],
    ['decision-callback',vault,vault.filters.AssessmentApplied(id),base,state.contracts.EscrowVault.blockNumber,baseHead,O],
  ];
  const logs={};
  for(const [name,instance,filter,provider,from,to,chainId]of stages){
    const matches=await queryChunks(instance,filter,from,to);if(!matches.length){output.missing.push(name);continue;}
    const log=matches[0],receipt=await provider.getTransactionReceipt(log.transactionHash),block=await provider.getBlock(receipt.blockNumber);
    if(receipt.status!==1)throw new Error(`Reverted receipt at ${name}`);
    logs[name]=log;
    output.steps.push({name,chainId,txHash:receipt.hash,blockNumber:receipt.blockNumber,blockHash:receipt.blockHash,timestamp:block.timestamp,gasUsed:String(receipt.gasUsed),explorer:`${chainId===O?origin.explorer:LASNA_EXPLORER}/tx/${receipt.hash}`});
  }
  if(output.missing.length)throw new Error(`Waiting for: ${output.missing.join(', ')}`);
  if(logs['reactive-request'].args.originTxHash!==logs.origin.transactionHash||logs['reactive-decision'].args.reportTxHash!==logs['ai-report'].transactionHash)throw new Error('Cross-chain causality hashes do not match');
  const expectedHash=logs.origin.args.contentHash;
  for(const name of ['reactive-request','request-callback','ai-report'])if(logs[name].args.contentHash!==expectedHash)throw new Error(`Listing commitment mismatch: ${name}`);
  if(keccak256(toUtf8Bytes(logs.origin.args.listing))!==expectedHash)throw new Error('Origin listing hash mismatch');
  const report=logs['ai-report'].args,decision=logs['decision-callback'].args;
  if(report.modelHash!==state.modelHash||report.score!==decision.score||report.reportHash!==decision.reportHash||decision.frozen!==(Number(report.score)>=Number(logs['reactive-decision'].args.thresholdApplied)))throw new Error('Model, report, score or threshold mismatch');
  // Size-aware policy: the applied threshold must follow from the on-chain deposit amount.
  const amount=logs.origin.args.amount,hvWei=BigInt(state.highValueWei??'0'),hv=state.highValueThreshold??state.threshold;
  const expectedThreshold=(state.highValueWei!==undefined&&amount>=hvWei)?hv:state.threshold;
  if(Number(logs['reactive-decision'].args.thresholdApplied)!==expectedThreshold)throw new Error(`Applied threshold ${logs['reactive-decision'].args.thresholdApplied} differs from policy ${expectedThreshold}`);
  output.policy={depositWei:amount.toString(),thresholdApplied:expectedThreshold,baseThreshold:state.threshold,highValueThreshold:hv,highValueWei:state.highValueWei??null,frozen:decision.frozen,score:Number(report.score)};
  // Callback provenance. Preferred: the system contract's getCallbacks record. On Lasna we observed that
  // validators were not storing records (no CallbackPosted events), so when it is empty we verify
  // instead that (a) the Reactive tx emitted CallbackRequest(origin, reactive, gateway) from 0x8888,
  // (b) the destination tx was sent to the official callback proxy, and (c) its calldata carries the
  // exact requested payload (all bytes after the network-injected sender argument).
  const system=new Contract(SYSTEM,['function getCallbacks(uint256) view returns ((uint256 blockNumber,address reactive,uint256 callbackIndex,uint256 chainId,uint256 txHash,bytes err)[])'],omni);
  const sysIface=new Interface(['event CallbackRequest(uint256 indexed chainId,address indexed sender,address indexed recipient,uint8 version,bytes configuration)']);
  output.callbackRecords={};
  for(const [source,dest]of [['reactive-request','request-callback'],['reactive-decision','decision-callback']]){
    let records=[];try{records=await system.getCallbacks(BigInt(logs[source].transactionHash));}catch{}
    const matching=records.find(r=>r.reactive.toLowerCase()===reactive.target.toLowerCase()&&r.chainId===BigInt(O)&&r.txHash===BigInt(logs[dest].transactionHash)&&r.err==='0x');
    if(matching){output.callbackRecords[source]={method:'system-getCallbacks',reactive:matching.reactive,destinationTx:logs[dest].transactionHash,err:matching.err};continue;}
    const rr=await omni.getTransactionReceipt(logs[source].transactionHash);
    const req=rr.logs.filter(l=>l.address.toLowerCase()===SYSTEM.toLowerCase()).map(l=>{try{return sysIface.parseLog(l);}catch{return null;}})
      .find(p=>p&&p.name==='CallbackRequest'&&p.args.chainId===BigInt(O)&&p.args.sender.toLowerCase()===reactive.target.toLowerCase()&&p.args.recipient.toLowerCase()===gateway.target.toLowerCase());
    if(!req)throw new Error(`No CallbackRequest from the system contract in ${source}`);
    const [cfg]=AbiCoder.defaultAbiCoder().decode(['tuple(uint256 chainId,address recipient,uint64 gasLimit,bytes payload)'],req.args.configuration);
    const destTx=await base.getTransaction(logs[dest].transactionHash);
    if(destTx.to.toLowerCase()!==origin.proxy.toLowerCase())throw new Error(`${dest} was not sent to the official callback proxy`);
    const payload=cfg.payload.toLowerCase(),selector=payload.slice(2,10),args=payload.slice(10+64);
    if(!destTx.data.toLowerCase().includes(selector)||!destTx.data.toLowerCase().includes(args))throw new Error(`${dest} calldata does not carry the requested payload`);
    output.callbackRecords[source]={method:'callback-request+official-proxy+payload-match',systemRecords:records.length,proxy:destTx.to,signer:destTx.from,destinationTx:logs[dest].transactionHash,gasLimit:String(cfg.gasLimit)};
  }
  const reportFile=`.state/reports/${O}-${gateway.target.toLowerCase()}-${id}.json`;
  if(!fs.existsSync(reportFile))throw new Error('Missing worker report file; retain .state/reports to prove live inference');
  const serialized=fs.readFileSync(reportFile,'utf8');if(keccak256(toUtf8Bytes(serialized))!==report.reportHash)throw new Error('Worker report file does not match the on-chain commitment');
  output.report=JSON.parse(serialized);output.reportSerialized=serialized;
  const first=output.steps[0],last=output.steps.at(-1);output.observedBlockTimestampDeltaSeconds=last.timestamp-first.timestamp;
  output.timingNote='Cross-chain block timestamp difference, not a synchronized end-to-end latency benchmark.';
  const ts=Object.fromEntries(output.steps.map(x=>[x.name,x.timestamp]));
  output.legSecondsByBlockTimestamp={originToReactiveRequest:ts['reactive-request']-ts.origin,reactiveRequestToJobCallback:ts['request-callback']-ts['reactive-request'],jobToAiReport:ts['ai-report']-ts['request-callback'],aiReportToReactiveDecision:ts['reactive-decision']-ts['ai-report'],reactiveDecisionToEscrowCallback:ts['decision-callback']-ts['reactive-decision'],total:ts['decision-callback']-ts.origin};
  output.complete=true;
}catch(error){output.error=error.shortMessage||error.message;process.exitCode=1;}
finally{save(`evidence/testnet-${id}.json`,output);console.log(JSON.stringify({complete:output.complete,file:`evidence/testnet-${id}.json`,error:output.error},null,2));base.destroy();omni.destroy();}
