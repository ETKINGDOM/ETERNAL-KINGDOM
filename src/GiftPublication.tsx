import {useEffect,useState} from 'react';
import type {AccountProfile} from '../shared/profile';
import InfoHint from './InfoHint';
type Mode=AccountProfile['giftPublication'];
export default function GiftPublication({profile,disabled,save}:{profile:AccountProfile;disabled:boolean;save:(mode:Mode)=>Promise<boolean>}){
  const [review,setReview]=useState<{mode:Mode;revision:number;address:string|null}|null>(null),[checked,setChecked]=useState(false),[saving,setSaving]=useState(false);
  useEffect(()=>{setReview(null);setChecked(false);},[profile.revision]);
  const address=profile.evmRecipient?.address??null,mode=profile.giftPublication;
  const prepare=(next:Mode)=>{setReview({mode:next,revision:profile.revision,address});setChecked(false);};
  async function confirm(){
    if(!review||!checked||disabled||saving||review.revision!==profile.revision||review.address!==address)return;
    setSaving(true);try{if(await save(review.mode)){setReview(null);setChecked(false);}}finally{setSaving(false);}
  }
  return <section className="recipient-editor gift-publication" aria-label="Published gift address settings">
    <h3>Sharing your gift address</h3>
    <InfoHint label="Gift address sharing details"><p>Your signed-in EVM wallet is the default receiving address unless you choose another. Using an address does not publish it: sharing below requires separate consent. No transfer is made here.</p><p>Publishing links this complete EVM address to your public person ID. Anyone who has your current room/person reference can read and copy it, including guests. It may reveal your wallet activity. Custom receiving addresses are not ownership-verified. Stopping sharing cannot erase copies or past transfers.</p><p>Changing or removing the saved address turns sharing off; publish again only after fresh review. Other clients read on demand, not through public chat or presence packets. This is hosted permission, not an onchain record or a guarantee of payment.</p></InfoHint>
    <p role="status">{mode==='published'?'Published for on-demand person lookups.':mode==='disabled'?'Published gifts disabled. Address hidden from new lookups.':'Private — no receiving address published.'}</p>
    <div className="publication-actions">
      {mode!=='published'&&<button type="button" className="secondary-button full" disabled={disabled||saving||!address} onClick={()=>prepare('published')}>Review publishing my address</button>}
      {mode==='published'&&<button type="button" className="secondary-button full" disabled={disabled||saving} onClick={()=>prepare('private')}>Review stopping address sharing</button>}
      {mode!=='disabled'&&<button type="button" className="text-button" disabled={disabled||saving} onClick={()=>prepare('disabled')}>Review disabling published gifts</button>}
      {mode==='disabled'&&<button type="button" className="text-button" disabled={disabled||saving} onClick={()=>prepare('private')}>Return to private receiving settings</button>}
    </div>
    {!address&&<p className="fine-print">Save and confirm an EVM receiving address above before publishing. SOL users can set a separate EVM address. Guest publication is reserved, not enabled.</p>}
    {review&&<div className="recipient-review" role="region" aria-label="Review gift address sharing">
      <p>{review.mode==='published'?'Publish this saved address under your public person identity?':review.mode==='disabled'?'Disable published gifts and hide the address from new lookups?':'Keep the saved address private and stop new public lookups?'}</p>
      {review.mode==='published'&&<code>{review.address}</code>}
      <label className="check-row"><input type="checkbox" checked={checked} disabled={disabled||saving} onChange={e=>setChecked(e.target.checked)}/>{review.mode==='published'?'I checked this full address and consent to it being publicly readable.':'I understand existing copies cannot be recalled.'}</label>
      <button type="button" className="primary full" disabled={!checked||disabled||saving} onClick={()=>void confirm()}>{saving?'Saving sharing settings…':review.mode==='published'?'Confirm address publication':'Confirm sharing change'}</button>
      <button type="button" className="text-button" disabled={saving} onClick={()=>{setReview(null);setChecked(false);}}>Cancel sharing change</button>
    </div>}
  </section>;
}
