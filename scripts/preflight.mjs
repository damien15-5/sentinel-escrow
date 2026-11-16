import '../src/config.mjs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {required} from '../src/config.mjs';
import {rpc,SYSTEM,originRpcUrl,originOf,requireLasna} from '../src/chain.mjs';
import {Wallet,formatEther,isAddress} from 'ethers';
export async function preflight(requireWallet=true){
  const base=rpc(originRpcUrl()), omni=rpc(required('REACTIVE_RPC_URL'));
  try{
    const origin=await originOf(base);await requireLasna(omni);
    const [baseCode,systemCode]=await Promise.all([base.getCode(origin.proxy),omni.getCode(SYSTEM)]);
    if(baseCode==='0x'||systemCode==='0x')throw new Error('Documented Omni system/proxy has no bytecode; recheck official network addresses');
    let balances;
    if(requireWallet){
      const address=new Wallet(required('DEPLOYER_PRIVATE_KEY')).address;
      if(!isAddress(required('REPORTER_ADDRESS')))throw new Error('REPORTER_ADDRESS must be a valid address');
      if(process.env.REPORTER_PRIVATE_KEY&&new Wallet(process.env.REPORTER_PRIVATE_KEY).address.toLowerCase()!==process.env.REPORTER_ADDRESS.toLowerCase())throw new Error('Reporter key does not match REPORTER_ADDRESS');
      balances={deployer:address,originETH:formatEther(await base.getBalance(address)),lasnaREACT:formatEther(await omni.getBalance(address))};
    }
    return {originChainId:origin.chainId,originName:origin.name,reactiveChainId:5318007,system:SYSTEM,callbackProxy:origin.proxy,...balances};
  }finally{base.destroy();omni.destroy();}
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))preflight(!process.argv.includes('--rpc-only')).then(v=>console.log(JSON.stringify(v,null,2))).catch(e=>{console.error(e.message);process.exitCode=1;});
