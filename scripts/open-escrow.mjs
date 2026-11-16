import {required,manifest} from '../src/config.mjs';
import {rpc,signer,contract,event} from '../src/chain.mjs';
import {SCENARIOS} from '../model/features.mjs';
import {parseEther,isAddress} from 'ethers';
const scenario=process.argv[2]||'risky', seller=process.argv[3];
if(!SCENARIOS[scenario]||!isAddress(seller))throw new Error('Usage: node scripts/open-escrow.mjs safe|risky|ambiguous SELLER_ADDRESS. Set BUYER_PRIVATE_KEY in .env.');
const provider=rpc(required('BASE_RPC_URL'));
try{
  if((await provider.getNetwork()).chainId!==84532n)throw new Error('Only Base Sepolia allowed');
  const state=manifest(),buyer=signer(required('BUYER_PRIVATE_KEY'),provider);
  const vault=contract('EscrowVault',state.contracts.EscrowVault.address,buyer);
  const receipt=await(await vault.open(seller,3600,SCENARIOS[scenario].listing,{value:parseEther('.0001')})).wait();
  const id=event(receipt,vault,'EscrowOpened').parsed.args.id;
  console.log(`Escrow ${id}, origin tx ${receipt.hash}. Run npm run evidence -- ${id} after callbacks arrive.`);
}finally{provider.destroy();}
