import fs from 'node:fs';
import {parseEther,getAddress,Wallet} from 'ethers';
import {required,envInt,atomic} from '../src/config.mjs';
import {preflight} from './preflight.mjs';
import {compile} from './compile.mjs';
import {rpc,signer,deploy,contract,originRpcUrl,originOf} from '../src/chain.mjs';
import {MODEL_HASH} from '../src/risk.mjs';
const pre=await preflight(); compile();
const base=rpc(originRpcUrl()), omni=rpc(required('REACTIVE_RPC_URL'));
try{
  const baseSigner=signer(required('DEPLOYER_PRIVATE_KEY'),base), omniSigner=signer(required('DEPLOYER_PRIVATE_KEY'),omni);
  const owner=new Wallet(process.env.DEPLOYER_PRIVATE_KEY).address, reporter=getAddress(required('REPORTER_ADDRESS'));
  const threshold=envInt('THRESHOLD_BPS',6500,1); if(threshold>10000)throw new Error('THRESHOLD_BPS exceeds 10000');
  const highValueThreshold=envInt('HIGH_VALUE_THRESHOLD_BPS',threshold,1); if(highValueThreshold>threshold)throw new Error('HIGH_VALUE_THRESHOLD_BPS must be <= THRESHOLD_BPS');
  const highValueWei=parseEther(process.env.HIGH_VALUE_ETH||'1000000');
  const origin=await originOf(base);
  const file=process.env.DEPLOYMENT_FILE||'.state/deployment.json';
  const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:2,mode:'testnet',originChainId:origin.chainId,originName:origin.name,callbackProxy:origin.proxy,reactiveChainId:5318007,owner,reporter,modelHash:MODEL_HASH,threshold,highValueThreshold,highValueWei:highValueWei.toString(),contracts:{},createdAt:new Date().toISOString()};
  if(state.owner!==owner||state.reporter!==reporter||state.modelHash!==MODEL_HASH||state.threshold!==threshold||(state.highValueThreshold??threshold)!==highValueThreshold||state.originChainId!==origin.chainId||state.reactiveChainId!==5318007)throw new Error('Existing deployment differs from environment/model; choose a new DEPLOYMENT_FILE for a new deployment');
  async function ensure(name,network,runner,args,funding){
    const stored=state.contracts[name];
    if(stored){if(await runner.provider.getCode(stored.address)==='0x')throw new Error(`Missing deployed ${name} bytecode`);return contract(name,stored.address,runner);}
    const instance=await deploy(name,runner,args,funding);const receipt=await instance.deploymentTransaction().wait();
    state.contracts[name]={address:instance.target,txHash:receipt.hash,blockNumber:receipt.blockNumber,network};atomic(file,state);
    console.log(`Deployed ${name}: ${instance.target}`);return instance;
  }
  const reactive=await ensure('SentinelReactive','lasna',omniSigner,[origin.chainId,threshold,highValueThreshold,highValueWei,MODEL_HASH],parseEther(process.env.REACTIVE_FUNDING_ETH||'1'));
  const vault=await ensure('EscrowVault',origin.name,baseSigner,[],0n);
  const gateway=await ensure('AssessmentGateway',origin.name,baseSigner,[origin.proxy,reactive.target,reporter,vault.target,MODEL_HASH],parseEther(process.env.CALLBACK_FUNDING_ETH||'.003'));
  if((await vault.gateway())==='0x0000000000000000000000000000000000000000')await(await vault.configureGateway(gateway.target)).wait();
  if((await vault.gateway()).toLowerCase()!==gateway.target.toLowerCase())throw new Error('Vault gateway mismatch');
  if((await reactive.vault())==='0x0000000000000000000000000000000000000000')await(await reactive.configure(vault.target,gateway.target)).wait();
  if((await reactive.vault()).toLowerCase()!==vault.target.toLowerCase()||(await reactive.gateway()).toLowerCase()!==gateway.target.toLowerCase())throw new Error('Reactive configuration mismatch');
  state.ready=true;atomic(file,state);
  console.log(`Saved ${file}. Fund the reporter with origin-chain test ETH, then npm run worker.`);
}finally{base.destroy();omni.destroy();}
