import fs from 'node:fs';
import {Contract,ContractFactory,JsonRpcProvider,Wallet,NonceManager,FetchRequest,FeeData} from 'ethers';
export const SYSTEM='0x8888888888888888888888888888888888888888';
// Supported testnet origin/destination chains with the official callback proxies listed at
// https://dev.reactive.network/origins-and-destinations (rechecked 2026-11-16).
export const ORIGINS={
  84532:{name:'base-sepolia',proxy:'0x476F44b11F5C942c58f4c8E3d0300E5710743585',explorer:'https://sepolia.basescan.org',faucet:'0x2afaFD298b23b62760711756088F75B7409f5967'},
  11155111:{name:'ethereum-sepolia',proxy:'0xAa14d9Cd0f788Ca23d11805986C1d8bd035D23b4',explorer:'https://sepolia.etherscan.io',faucet:'0x9b9BB25f1A81078C544C829c5EB7822d747Cf434'},
};
export const BASE_PROXY=ORIGINS[84532].proxy;
export const REACTIVE_CHAIN_ID=5318007, LASNA_EXPLORER='https://lasna.reactscan.net';
export function originRpcUrl(){const url=process.env.ORIGIN_RPC_URL||process.env.BASE_RPC_URL;if(!url)throw new Error('Set ORIGIN_RPC_URL (or BASE_RPC_URL) in .env');return url;}
export async function originOf(provider,expected){
  const chainId=Number((await provider.getNetwork()).chainId),origin=ORIGINS[chainId];
  if(!origin)throw new Error(`Unsupported origin chain ${chainId}; allowed: ${Object.keys(ORIGINS).join(', ')}`);
  if(expected!==undefined&&Number(expected)!==chainId)throw new Error(`Origin RPC is chain ${chainId} but the deployment is on ${expected}`);
  return {chainId,...origin};
}
export async function requireLasna(provider){if((await provider.getNetwork()).chainId!==BigInt(REACTIVE_CHAIN_ID))throw new Error('REACTIVE_RPC_URL must be Reactive Lasna (5318007)');}
export function artifact(name){return JSON.parse(fs.readFileSync(`artifacts/${name}.json`,'utf8'));}
export function contract(name,address,runner){return new Contract(address,artifact(name).abi,runner);}
export async function deploy(name,signer,args=[],value=0n){
  const a=artifact(name); const instance=await new ContractFactory(a.abi,a.bytecode,signer).deploy(...args,{value});
  await instance.waitForDeployment(); return instance;
}
export function rpc(url){const request=new FetchRequest(url);request.timeout=20000;const provider=new JsonRpcProvider(request,undefined,{cacheTimeout:-1,batchMaxCount:1});
  // Lasna rejects EIP-1559 txs with a zero tip ("gas tip cap 0, minimum needed 1") while
  // eth_maxPriorityFeePerGas returns 0, so enforce a minimal non-zero tip.
  const original=provider.getFeeData.bind(provider);
  provider.getFeeData=async()=>{const fee=await original();if(fee.maxPriorityFeePerGas!==null&&fee.maxPriorityFeePerGas<1000000000n&&fee.maxFeePerGas!==null){const tip=fee.maxPriorityFeePerGas>0n?fee.maxPriorityFeePerGas:1000000n;return new FeeData(fee.gasPrice,fee.maxFeePerGas+tip,tip);}return fee;};
  return provider;}
export function signer(key,provider){return new NonceManager(new Wallet(key,provider));}
export function json(value){return JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);}
export function save(file,value){fs.mkdirSync(file.slice(0,file.lastIndexOf('/'))||'.',{recursive:true});fs.writeFileSync(file,json(value)+'\n');}
export function event(receipt,instance,name){
  for(const log of receipt.logs){if(log.address.toLowerCase()!==instance.target.toLowerCase())continue;
    try{const parsed=instance.interface.parseLog(log);if(parsed?.name===name)return {log,parsed};}catch{}}
  throw new Error(`Missing ${name} in ${receipt.hash}`);
}
export function record(log,chainId){return {chainId,contractAddress:log.address,topic0:BigInt(log.topics[0]||0),topic1:BigInt(log.topics[1]||0),topic2:BigInt(log.topics[2]||0),topic3:BigInt(log.topics[3]||0),data:log.data,blockNumber:log.blockNumber,opCode:log.topics.length,blockHash:BigInt(log.blockHash),txHash:BigInt(log.transactionHash),logIndex:log.index};}
