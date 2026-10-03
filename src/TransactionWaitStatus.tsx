import {LoaderCircle,ShieldAlert} from 'lucide-react';
import type {TransactionWaitPhase} from './transactionLedger';
const titles={wallet:'Complete the request in your wallet…',blockchain:'Waiting for blockchain confirmation…',uncertain:'Transaction result not verified.'};
export default function TransactionWaitStatus({phase}:{phase:TransactionWaitPhase|null}){
  if(!phase)return null;
  return <section className="transaction-wait-status" role="status" aria-label="Transaction progress" data-phase={phase} aria-live="polite" aria-busy={phase!=='uncertain'}>
    {phase==='uncertain'?<ShieldAlert size={19}/>:<LoaderCircle size={19} className="transaction-wait-spinner"/>}
    <div><strong>{titles[phase]}</strong><small>{phase==='uncertain'?'Check transaction history before trying again.':'Please wait. Do not submit again.'}</small></div>
  </section>;
}
