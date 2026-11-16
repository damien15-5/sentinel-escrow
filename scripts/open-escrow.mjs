import {required,manifest} from '../src/config.mjs';
import {rpc,signer,contract,event,originRpcUrl,originOf} from '../src/chain.mjs';
import {SCENARIOS} from '../model/features.mjs';
import {parseEther,isAddress} from 'ethers';
const scenario=process.argv[2]||'risky', seller=process.argv[3];
if(!SCENARIOS[scenario]||!isAddress(seller))throw new Error('Usage: node scripts/open-escrow.mjs safe|risky|ambiguous SELLER_ADDRESS. Set BUYER_PRIVATE_KEY in .env.');
const provider=rpc(originRpcUrl()),amountEth=process.env.ESCROW_ETH||'.0001';
try{
  const state=manifest();await originOf(provider,state.originChainId);
  const buyer=signer(required('BUYER_PRIVATE_KEY'),provider);
  const vault=contract('EscrowVault',state.contracts.EscrowVault.address,buyer);
  const receipt=await(await vault.open(seller,3600,SCENARIOS[scenario].listing,{value:parseEther(amountEth)})).wait();
  const id=event(receipt,vault,'EscrowOpened').parsed.args.id;
  console.log(`Escrow ${id} (${amountEth} ETH), origin tx ${receipt.hash}. Run npm run evidence -- ${id} after callbacks arrive.`);
}finally{provider.destroy();}
