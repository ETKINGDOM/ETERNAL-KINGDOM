import {useState} from 'react';
import type {WalletChoice} from './walletIdentity';
import {readWalletLoginHint,walletLoginGroups,type LoginFamily,type WalletBrand} from './walletLoginPolicy';

export default function WalletLoginOptions({wallets,disabled,connect,preferred,lastWallet}:{wallets:WalletChoice[];disabled:boolean;connect:(wallet:WalletChoice)=>void;preferred?:{brand:WalletBrand;family:LoginFamily};lastWallet?:{id:string;family:LoginFamily}}){
  const [chosen,setChosen]=useState<Record<string,LoginFamily>>({});
  const remembered=(group:ReturnType<typeof walletLoginGroups>[number])=>lastWallet&&group[lastWallet.family]?.id===lastWallet.id;
  const groups=walletLoginGroups(wallets).sort((a,b)=>Number(Boolean(remembered(b)))-Number(Boolean(remembered(a)))),hint=preferred??readWalletLoginHint(location.search);
  return <div className="wallet-login-groups">
    {groups.map(group=>{
      const preferred=chosen[group.key]??(hint?.brand===group.brand?hint.family:undefined)??(remembered(group)?lastWallet?.family:undefined);
      const wallet=(preferred?group[preferred]:undefined)??group.evm??group.solana!;
      const both=Boolean(group.evm&&group.solana);
      return <div className="wallet-login-group" role="group" aria-label={`${group.name} login`} key={group.key}>
        <button className="secondary-button full" disabled={disabled} onClick={()=>connect(wallet)}>Connect {group.name}{wallet.family==='solana'?' · SOL':''}</button>
        <p className="fine-print">{wallet.family==='evm'?'EVM address · recommended for Robinhood and God':'SOL address · world sign-in'}{group.brand==='phantom'?' · Phantom uses SOL in this world':''}</p>
        {remembered(group)&&<small className="fine-print">Last used on this device</small>}
        {both&&<button className="text-button" type="button" disabled={disabled} onClick={()=>setChosen(old=>({...old,[group.key]:wallet.family==='evm'?'solana':'evm'}))}>Use {wallet.family==='evm'?'SOL':'EVM'} with {group.name}</button>}
      </div>;
    })}
    {!groups.some(g=>g.evm)&&<p className="fine-print">No EVM wallet detected.</p>}
    {!groups.some(g=>g.solana)&&<p className="fine-print">No compatible Solana wallet detected.</p>}
  </div>;
}
