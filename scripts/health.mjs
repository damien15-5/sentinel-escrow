import {Contract,formatEther} from 'ethers';
import {required,manifest} from '../src/config.mjs';
import {rpc,SYSTEM,originRpcUrl,originOf,requireLasna} from '../src/chain.mjs';
const state=manifest(),base=rpc(originRpcUrl()),omni=rpc(required('REACTIVE_RPC_URL'));
try{
  const origin=await originOf(base,state.originChainId);await requireLasna(omni);
  const results=[];
  for(const [name,provider,service]of [['SentinelReactive',omni,SYSTEM],['AssessmentGateway',base,origin.proxy]]){
    const address=state.contracts[name].address,fees=new Contract(service,['function debt(address) view returns(uint256)','function reserves(address) view returns(uint256)'],provider);
    const debt=await fees.debt(address),reserves=await fees.reserves(address),balance=await provider.getBalance(address);
    results.push({name,address,balance:formatEther(balance),debt:formatEther(debt),reserves:formatEther(reserves),needsDebtSettlement:debt>0n});
  }
  console.log(JSON.stringify(results,null,2));
}finally{base.destroy();omni.destroy();}
