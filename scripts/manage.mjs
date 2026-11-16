import {required,manifest} from '../src/config.mjs';
import {rpc,signer,contract,originRpcUrl,originOf,requireLasna} from '../src/chain.mjs';
const [action,id]=process.argv.slice(2);
if(!['release','refund','retry'].includes(action)||!/^\d+$/.test(id||''))throw new Error('Usage: node scripts/manage.mjs release|refund|retry ESCROW_ID');
const state=manifest(),isRetry=action==='retry',provider=rpc(isRetry?required('REACTIVE_RPC_URL'):originRpcUrl());
try{
  if(isRetry)await requireLasna(provider);else await originOf(provider,state.originChainId);
  const runner=signer(required(isRetry?'DEPLOYER_PRIVATE_KEY':'BUYER_PRIVATE_KEY'),provider);
  const name=isRetry?'SentinelReactive':'EscrowVault',instance=contract(name,state.contracts[name].address,runner);
  const receipt=await(await instance[isRetry?'retryDelivery':action](id)).wait();
  console.log(`${action} completed: ${receipt.hash}`);
}finally{provider.destroy();}
