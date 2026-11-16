// Read-only view of the public testnet deployment for the dashboard. No keys are used; it only reads
// contract storage over ORIGIN_RPC_URL and links the committed evidence bundles in evidence/.
import fs from 'node:fs';
import {JsonRpcProvider,Contract,formatEther} from 'ethers';
import {ORIGINS,LASNA_EXPLORER} from './chain.mjs';
const STATES=['Missing','Pending','Cleared','Frozen','Released','Refunded'];
const VAULT_ABI=['function nextId() view returns (uint256)','function escrows(uint256) view returns (address buyer,address seller,uint256 amount,uint64 deadline,uint8 state,uint16 score,bytes32 contentHash,bytes32 reportHash)'];
let cache;
export async function testnetView(){
  if(cache&&Date.now()-cache.at<8000)return cache.data;
  const file=process.env.TESTNET_DEPLOYMENT_FILE||'deployments/ethereum-sepolia-lasna.json';
  const url=process.env.ORIGIN_RPC_URL||process.env.BASE_RPC_URL;
  if(!fs.existsSync(file)||!url)return {configured:false,reason:`Set ORIGIN_RPC_URL and provide ${file} to show live testnet state.`};
  const dep=JSON.parse(fs.readFileSync(file,'utf8')),origin=ORIGINS[dep.originChainId];
  const provider=new JsonRpcProvider(url,dep.originChainId,{staticNetwork:true});
  try{
    const vault=new Contract(dep.contracts.EscrowVault.address,VAULT_ABI,provider);
    const [block,next]=await Promise.all([provider.getBlock('latest'),vault.nextId()]);
    const ids=[...Array(Number(next)-1).keys()].map(i=>i+1);
    const rows=await Promise.all(ids.map(async id=>{
      const x=await vault.escrows(id);let ev=null,lat=null;
      try{ev=JSON.parse(fs.readFileSync(`evidence/testnet-${id}.json`,'utf8'));}catch{}
      try{lat=JSON.parse(fs.readFileSync(`evidence/latency-${id}.json`,'utf8'));}catch{}
      const steps=ev?.steps?.map(s=>({name:s.name,txHash:s.txHash,chainId:s.chainId,url:s.explorer}))||[];
      return {id,state:STATES[Number(x.state)],score:Number(x.score),amountEth:formatEther(x.amount),deadline:Number(x.deadline),threshold:ev?.policy?.thresholdApplied??null,scenario:lat?.scenario??null,complete:!!ev?.complete,totalSeconds:lat?.totalSecondsOpenConfirmedToDecisionSeen??null,steps};
    }));
    const data={configured:true,chain:dep.originName,chainId:dep.originChainId,block:block.number,blockTime:block.timestamp,explorer:origin.explorer,lasnaExplorer:LASNA_EXPLORER,policy:{threshold:dep.threshold,highValueThreshold:dep.highValueThreshold,highValueEth:formatEther(dep.highValueWei)},contracts:Object.fromEntries(Object.entries(dep.contracts).map(([k,v])=>[k,{address:v.address,url:`${v.network==='lasna'?LASNA_EXPLORER:origin.explorer}/address/${v.address}`}])),escrows:rows.reverse()};
    cache={at:Date.now(),data};return data;
  }finally{provider.destroy();}
}
