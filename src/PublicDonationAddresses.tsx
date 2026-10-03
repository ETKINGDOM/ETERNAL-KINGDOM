import {publicDonationAddresses} from '../shared/donationAddresses';
import {projectChainSettings} from './projectChainSettings';
import InfoHint from './InfoHint';

export default function PublicDonationAddresses(){
  return <section className="public-donation-addresses" aria-label="Project donation addresses">
    <h3>Public donation addresses</h3>
    <InfoHint label="Donation address details"><p>Addresses supplied by the project owner. Address format checks do not verify wallet ownership or supported networks. In-app transfers and rankings are separate; merely viewing an address does not make a donation.</p><p>The receiving address is EVM-based, not an ETH-only or token-contract address. God is listed separately and shares the EVM treasury. The God token contract is a different setting. No burn or faith-submission fee.</p></InfoHint>
    <dl>{publicDonationAddresses(projectChainSettings).map(row=><div key={row.kind}>
      <dt>{row.label}</dt><dd>{row.address?<textarea aria-label={row.label} readOnly rows={2} value={row.address} spellCheck={false} onFocus={e=>e.currentTarget.select()}/>:<span>Not configured</span>}</dd>
      {row.kind==='evm'&&<small>Ethereum · Base · Arbitrum · BNB Chain</small>}
    </div>)}</dl>
  </section>;
}
