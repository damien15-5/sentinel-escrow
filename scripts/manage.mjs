import {required,manifest} from '../src/config.mjs';
import {rpc,signer,contract} from '../src/chain.mjs';
const [action,id]=process.argv.slice(2);
if(!['release','refund','retry'].includes(action)||!/^\d+$/.test(id||''))throw new Error('Usage: node scripts/manage.mjs release|refund|retry ESCROW_ID');
const state=manifest(),isRetry=action==='retry',provider=rpc(required(isRetry?'REACTIVE_RPC_URL':'BASE_RPC_URL'));
try{
  if((await provider.getNetwork()).chainId!==BigInt(isRetry?5318007:84532))throw new Error('Wrong testnet chain');
  const runner=signer(required(isRetry?'DEPLOYER_PRIVATE_KEY':'BUYER_PRIVATE_KEY'),provider);
  const name=isRetry?'SentinelReactive':'EscrowVault',instance=contract(name,state.contracts[name].address,runner);
  const receipt=await(await instance[isRetry?'retryDelivery':action](id)).wait();
  console.log(`${action} completed: ${receipt.hash}`);
}finally{provider.destroy();}
