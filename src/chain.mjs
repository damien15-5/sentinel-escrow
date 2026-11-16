import fs from 'node:fs';
import {Contract,ContractFactory,JsonRpcProvider,Wallet,NonceManager,FetchRequest} from 'ethers';
export const SYSTEM='0x8888888888888888888888888888888888888888';
export const BASE_PROXY='0x476F44b11F5C942c58f4c8E3d0300E5710743585';
export function artifact(name){return JSON.parse(fs.readFileSync(`artifacts/${name}.json`,'utf8'));}
export function contract(name,address,runner){return new Contract(address,artifact(name).abi,runner);}
export async function deploy(name,signer,args=[],value=0n){
  const a=artifact(name); const instance=await new ContractFactory(a.abi,a.bytecode,signer).deploy(...args,{value});
  await instance.waitForDeployment(); return instance;
}
export function rpc(url){const request=new FetchRequest(url);request.timeout=20000;return new JsonRpcProvider(request,undefined,{cacheTimeout:-1,batchMaxCount:1});}
export function signer(key,provider){return new NonceManager(new Wallet(key,provider));}
export function json(value){return JSON.stringify(value,(_,v)=>typeof v==='bigint'?v.toString():v,2);}
export function save(file,value){fs.mkdirSync(file.slice(0,file.lastIndexOf('/'))||'.',{recursive:true});fs.writeFileSync(file,json(value)+'\n');}
export function event(receipt,instance,name){
  for(const log of receipt.logs){if(log.address.toLowerCase()!==instance.target.toLowerCase())continue;
    try{const parsed=instance.interface.parseLog(log);if(parsed?.name===name)return {log,parsed};}catch{}}
  throw new Error(`Missing ${name} in ${receipt.hash}`);
}
export function record(log,chainId){return {chainId,contractAddress:log.address,topic0:BigInt(log.topics[0]||0),topic1:BigInt(log.topics[1]||0),topic2:BigInt(log.topics[2]||0),topic3:BigInt(log.topics[3]||0),data:log.data,blockNumber:log.blockNumber,opCode:log.topics.length,blockHash:BigInt(log.blockHash),txHash:BigInt(log.transactionHash),logIndex:log.index};}
