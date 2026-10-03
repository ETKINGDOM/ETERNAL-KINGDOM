type ReceiptKind='prayer'|'faith'|'token';
const labels={prayer:'Prayer',faith:'Faith',token:'Token'};

// Shared presentation only: the caller owns the ledger and original-network
// receipt validation. Focusing the hash selects it; checking never resubmits.
export default function TransactionReceiptControls({id,hash,checking,check,kind}:{
  id:string;hash?:string;checking:boolean;check:(id:string)=>Promise<void>;kind:ReceiptKind;
}){
  if(!hash)return null;
  return <>
    <label className="field-label">{labels[kind]} transaction hash · select and copy<input readOnly value={hash} onFocus={event=>event.currentTarget.select()}/></label>
    <button type="button" className="secondary-button full" disabled={checking} onClick={()=>void check(id)}>{checking?`Checking ${kind} receipt…`:`Check ${kind} receipt`}</button>
  </>;
}
