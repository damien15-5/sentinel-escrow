import fs from 'node:fs';
import {parseEther,getAddress,Wallet} from 'ethers';
import {required,envInt,atomic} from '../src/config.mjs';
import {preflight} from './preflight.mjs';
import {compile} from './compile.mjs';
import {rpc,signer,deploy,contract,BASE_PROXY} from '../src/chain.mjs';
import {MODEL_HASH} from '../src/risk.mjs';
await preflight(); compile();
const base=rpc(required('BASE_RPC_URL')), omni=rpc(required('REACTIVE_RPC_URL'));
try{
  const baseSigner=signer(required('DEPLOYER_PRIVATE_KEY'),base), omniSigner=signer(required('DEPLOYER_PRIVATE_KEY'),omni);
  const owner=new Wallet(process.env.DEPLOYER_PRIVATE_KEY).address, reporter=getAddress(required('REPORTER_ADDRESS'));
  const threshold=envInt('THRESHOLD_BPS',6500,1); if(threshold>10000)throw new Error('THRESHOLD_BPS exceeds 10000');
  const file=process.env.DEPLOYMENT_FILE||'.state/deployment.json';
  const state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{schemaVersion:1,mode:'testnet',originChainId:84532,reactiveChainId:5318007,owner,reporter,modelHash:MODEL_HASH,threshold,contracts:{},createdAt:new Date().toISOString()};
  if(state.owner!==owner||state.reporter!==reporter||state.modelHash!==MODEL_HASH||state.threshold!==threshold||state.originChainId!==84532||state.reactiveChainId!==5318007)throw new Error('Existing deployment differs from environment/model; choose a new DEPLOYMENT_FILE for a new deployment');
  async function ensure(name,network,runner,args,funding){
    const stored=state.contracts[name];
    if(stored){if(await runner.provider.getCode(stored.address)==='0x')throw new Error(`Missing deployed ${name} bytecode`);return contract(name,stored.address,runner);}
    const instance=await deploy(name,runner,args,funding);const receipt=await instance.deploymentTransaction().wait();
    state.contracts[name]={address:instance.target,txHash:receipt.hash,blockNumber:receipt.blockNumber,network};atomic(file,state);
    console.log(`Deployed ${name}: ${instance.target}`);return instance;
  }
  const reactive=await ensure('SentinelReactive','lasna',omniSigner,[84532,threshold,MODEL_HASH],parseEther(process.env.REACTIVE_FUNDING_ETH||'1'));
  const vault=await ensure('EscrowVault','base-sepolia',baseSigner,[],0n);
  const gateway=await ensure('AssessmentGateway','base-sepolia',baseSigner,[BASE_PROXY,reactive.target,reporter,vault.target,MODEL_HASH],parseEther(process.env.CALLBACK_FUNDING_ETH||'.003'));
  if((await vault.gateway())==='0x0000000000000000000000000000000000000000')await(await vault.configureGateway(gateway.target)).wait();
  if((await vault.gateway()).toLowerCase()!==gateway.target.toLowerCase())throw new Error('Vault gateway mismatch');
  if((await reactive.vault())==='0x0000000000000000000000000000000000000000')await(await reactive.configure(vault.target,gateway.target)).wait();
  if((await reactive.vault()).toLowerCase()!==vault.target.toLowerCase()||(await reactive.gateway()).toLowerCase()!==gateway.target.toLowerCase())throw new Error('Reactive configuration mismatch');
  state.ready=true;atomic(file,state);
  console.log(`Saved ${file}. Fund the reporter with Base Sepolia ETH, then npm run worker.`);
}finally{base.destroy();omni.destroy();}
