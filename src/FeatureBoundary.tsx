import {Component,type ReactNode} from 'react';

type Props={children:ReactNode;label:string;onFailure?:()=>void;close?:()=>void;pending?:boolean};
// Catch a failed lazy module/render locally. Never log error objects/user text,
// refresh automatically, reconstruct a wallet request or retry a transaction.
export default class FeatureBoundary extends Component<Props,{failed:boolean}>{
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(){this.props.onFailure?.();}
  render(){
    if(!this.state.failed)return this.props.children;
    return <section className="feature-recovery" role="alert" aria-label={`${this.props.label} unavailable`}>
      <p>This part of the world could not load. Nothing is retried automatically.</p>
      <p className="fine-print">An old page or interrupted download can cause this. Reloading clears unsent text, but never resends a transaction. If you already confirmed in your wallet, check its history before submitting again.</p>
      {this.props.close&&<button className="secondary-button" type="button" onClick={this.props.close}>Back to the world</button>}
      <button className="secondary-button" type="button" disabled={this.props.pending} onClick={()=>location.reload()}>Reload website</button>
    </section>;
  }
}
