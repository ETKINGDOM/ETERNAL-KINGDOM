import { useCallback, useEffect, useRef, useState } from 'react';
import { useGodToken } from './useGodToken';
import { godTokenService } from './godTokenService';
import { projectChainSettings } from './projectChainSettings';
import {faithHoldingEligibility,godTokenDonation} from '../shared/chainConfiguration';
import {GOD_TOKEN_NAME} from '../shared/godTokenPresentation';
import './gifts.css';
import InfoHint from './InfoHint';

export default function GodTokenPanel({account,compact=false}:{account?:string;compact?:boolean}) {
  const state=useGodToken();const controller=useRef<AbortController|null>(null);
  const [balance,setBalance]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [holding,setHolding]=useState<'eligible'|'insufficient'|null>(null);
  const token=state.token;
  const readBalance=useCallback(async()=>{
    if(!account||!token||controller.current)return;
    const request=new AbortController();controller.current=request;
    setBusy(true);setError('');setBalance(null);setHolding(null);
    try {
      const result=await godTokenService(projectChainSettings).balance(token,account,AbortSignal.any([request.signal,AbortSignal.timeout(15000)]));
      if(!request.signal.aborted){setBalance(result.display);const access=faithHoldingEligibility(projectChainSettings,'confession',{token,units:result.units});setHolding(access.status==='unconfigured'?null:access.status);}
    } catch {if(!request.signal.aborted)setError('The balance could not be verified. No zero balance is assumed.');}
    finally {if(controller.current===request){controller.current=null;setBusy(false);}}
  },[account,token]);
  useEffect(()=>{
    setBalance(null);setHolding(null);setError('');setBusy(false);
    void readBalance();
    return ()=>{controller.current?.abort();controller.current=null;};
  },[readBalance]);
  // No polling or wallet request. Account/token changes abort obsolete reads.
  if(state.status==='unconfigured')return null;
  return <section aria-label="Configured God token" className="gift-local-review god-token-panel">
    <h3>{GOD_TOKEN_NAME}</h3>
    {state.status==='error'?<p role="alert">The configured token could not be verified. Transactions remain unavailable.</p>:
      state.status==='loading'?<p role="status">Checking configured token…</p>:<>
        <p>{GOD_TOKEN_NAME} · {state.token?.networkName}</p>
        {compact?<><InfoHint label="God token details"><p>God is the website display name. Your wallet may show a different onchain symbol. Holding ≥ 1 God is required for confession and praise; no tokens are deducted or burned. Prayer needs no God. Balances are read automatically using your EVM address and the public RPC; no wallet approval or payment is requested.</p>{state.token&&godTokenDonation(projectChainSettings,state.token)&&<><p>Direct voluntary donation. This is not a burn or a fee for confession/praise. No transfer is made by this panel.</p><label>Public God token donation recipient<input readOnly value={godTokenDonation(projectChainSettings,state.token)!.recipient}/></label></>}</InfoHint>
          {account?<><button type="button" className="text-button" disabled={busy} onClick={()=>void readBalance()}>{busy?'Reading…':'Refresh God token balance'}</button>{balance!==null&&<p role="status">Balance: {balance} {GOD_TOKEN_NAME}</p>}{holding&&<small role="status">{holding==='eligible'?'Holding ≥ 1 God':'Holding < 1 God'}</small>}</>:<p className="fine-print">Connect an EVM wallet to see your balance.</p>}
          {error&&<p role="alert">{error}</p>}</>:<>
        <p className="fine-print">God is the website display name. Your wallet may show the onchain symbol.</p>
        <p className="fine-print">Read-only token information. Holding at least 1 whole God token is required for onchain confession and praise. No tokens are deducted or burned. Prayer does not require tokens. Record submissions are not enabled by this panel.</p>
        {account?<><p className="fine-print">Your balance is read automatically using your signed-in EVM address and the configured public RPC provider. This is read-only; no payment or wallet approval is requested.</p>
          <button className="secondary-button full" disabled={busy} onClick={()=>void readBalance()}>{busy?'Reading…':'Refresh God token balance'}</button>
          {balance!==null&&<p role="status">Balance: {balance} {GOD_TOKEN_NAME}</p>}</>:
          <p className="fine-print">An EVM account is needed to read its token balance. SOL sign-in is separate and does not become an EVM payment wallet.</p>}
        {error&&<p role="alert">{error}</p>}
        {holding&&<p role="status">{holding==='eligible'?'Holding of at least 1 whole God token verified for this account. Record submission separately checks the submitting EVM wallet, configured contract and current balance.':'This account holds less than 1 whole God token. Local text previews remain available; onchain confession and praise require at least 1 whole God token.'}</p>}
        {state.token&&godTokenDonation(projectChainSettings,state.token)&&<section aria-label="Public God token donation address"><h4>Voluntary God token donation</h4>
          <p className="fine-print">Direct transfer on {state.token.networkName} to this public address. This is not a burn or a fee for confession/praise. No transfer is made by this panel.</p>
          <label className="field-label">Public God token donation recipient<input readOnly value={godTokenDonation(projectChainSettings,state.token)!.recipient} onFocus={e=>e.currentTarget.select()}/></label>
        </section>}
        </>}
      </>}
  </section>;
}
