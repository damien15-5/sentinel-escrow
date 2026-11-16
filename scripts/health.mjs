import {Contract,formatEther} from 'ethers';
import {required,manifest} from '../src/config.mjs';
import {rpc,SYSTEM,BASE_PROXY} from '../src/chain.mjs';
const state=manifest(),base=rpc(required('BASE_RPC_URL')),omni=rpc(required('REACTIVE_RPC_URL'));
try{
  if((await base.getNetwork()).chainId!==84532n||(await omni.getNetwork()).chainId!==5318007n)throw new Error('Wrong testnet networks');
  const results=[];
  for(const [name,provider,service]of [['SentinelReactive',omni,SYSTEM],['AssessmentGateway',base,BASE_PROXY]]){
    const address=state.contracts[name].address,fees=new Contract(service,['function debt(address) view returns(uint256)','function reserves(address) view returns(uint256)'],provider);
    const debt=await fees.debt(address),reserves=await fees.reserves(address),balance=await provider.getBalance(address);
    results.push({name,address,balance:formatEther(balance),debt:formatEther(debt),reserves:formatEther(reserves),needsDebtSettlement:debt>0n});
  }
  console.log(JSON.stringify(results,null,2));
}finally{base.destroy();omni.destroy();}
