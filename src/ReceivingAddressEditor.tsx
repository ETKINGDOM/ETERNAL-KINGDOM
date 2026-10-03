import {useEffect,useState} from 'react';
import {evmReceivingAddressSchema} from '../shared/profile';
import InfoHint from './InfoHint';

export default function ReceivingAddressEditor({saved,defaultAddress,busy,hosted,save,reload}:{saved:string|null;defaultAddress?:string;busy:boolean;hosted:boolean;save:(address:string|null)=>Promise<boolean>;reload:()=>void}){
  const [draft,setDraft]=useState(saved??''),[error,setError]=useState(''),[success,setSuccess]=useState(false);
  const [review,setReview]=useState<{address:string|null;previous:string|null}|null>(null),[checked,setChecked]=useState(false),[saving,setSaving]=useState(false);
  const usingLoginWallet=Boolean(defaultAddress&&saved?.toLowerCase()===defaultAddress.toLowerCase());
  useEffect(()=>{setDraft(saved??'');setReview(null);setChecked(false);},[saved]);
  function prepare(){
    setError('');setSuccess(false);
    const parsed=draft.trim()?evmReceivingAddressSchema.safeParse(draft):null;
    if(parsed&&!parsed.success){setError('Enter a valid EVM 0x address. SOL addresses, names and the zero address are not accepted.');return;}
    const address=parsed?.data??null;
    if(address===saved||(!address&&usingLoginWallet)){setError('This is already the receiving address.');return;}
    setReview({address,previous:saved});setChecked(false);
  }
  async function confirm(){
    if(!review||!checked||busy||saving||review.previous!==saved)return;
    setSaving(true);setError('');
    try{if(await save(review.address)){setSuccess(true);setReview(null);setChecked(false);}}catch(error){setError(error instanceof Error?error.message:'Could not save the address.');}
    finally{setSaving(false);}
  }
  return <section className="recipient-editor" aria-label="EVM receiving address">
    <h3>Your EVM receiving address</h3>
    <InfoHint label="Receiving address details"><p>{defaultAddress?'Your connected EVM wallet is used automatically unless you choose a different receiving address. No binding is needed.':'Add an EVM address for gifts. SOL sign-in does not provide an EVM receiving address.'} No funds are sent here. Public sharing is a separate choice.</p><p>{hosted?'Saved with this wallet’s hosted profile. Sharing is off by default; review publication separately below. Changing this address turns sharing off.':'Guest address: private, saved only in this browser. Clearing browser data loses this setting.'} Saving does not send a transaction.</p></InfoHint>
    <div className="wallet-address"><span>{usingLoginWallet?'Your verified login wallet':saved?'Custom address · ownership not verified':'Receiving address'}</span><code>{saved??'Not configured'}</code></div>
    <details open={defaultAddress?undefined:true}>
      <summary>{defaultAddress?'Use a different receiving address':'Set an EVM receiving address'}</summary>
      <form onSubmit={event=>{event.preventDefault();prepare();}}>
      <label className="field-label" htmlFor="evm-recipient">EVM address</label>
      <input id="evm-recipient" value={draft} placeholder="0x…" maxLength={42} autoComplete="off" autoCapitalize="none" spellCheck={false} disabled={busy||saving} onChange={event=>{setDraft(event.target.value);setReview(null);setChecked(false);setSuccess(false);setError('');}}/>
      {defaultAddress&&!usingLoginWallet&&<button type="button" className="text-button" disabled={busy||saving} onClick={()=>{setDraft('');setReview(null);setSuccess(false);setError('');}}>Use my login wallet again</button>}
      <button className="secondary-button full" type="submit" disabled={busy||saving}>Review address change</button>
      </form>
    </details>
    {review&&<div className="recipient-review" role="region" aria-label="Confirm receiving address">
      <p>{review.address?'Check the complete address before saving:':defaultAddress?'Restore your login wallet as the receiving address? Public sharing will be turned off.':'Remove the saved receiving address? This does not move or delete any wallet assets.'}</p>
      {(review.address||defaultAddress)&&<code>{review.address??defaultAddress}</code>}
      <label className="check-row"><input type="checkbox" checked={checked} disabled={busy||saving} onChange={event=>setChecked(event.target.checked)}/> {review.address?'I checked this complete EVM address.':defaultAddress?'I confirm using my login wallet again.':'I confirm removing this saved address.'}</label>
      <button className="primary full" disabled={!checked||busy||saving} onClick={()=>void confirm()}>{saving?'Saving…':review.address?'Confirm and save address':defaultAddress?'Confirm login wallet':'Confirm removal'}</button>
      <button className="text-button" disabled={saving} onClick={()=>{setReview(null);setChecked(false);}}>Cancel address change</button>
    </div>}
    {success&&<p className="preview-result" role="status">Receiving address setting saved. No transaction was sent.</p>}
    {error&&<p className="error" role="alert">{error}</p>}
    {!hosted&&<button className="text-button" disabled={saving} onClick={()=>{reload();setDraft(saved??'');setReview(null);setError('');setSuccess(false);}}>Reload saved guest address</button>}
  </section>;
}
