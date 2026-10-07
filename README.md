# ETERNAL KINGDOM

ETERNAL KINGDOM is a faith-centered virtual world by [ETKINGDOM](https://github.com/ETKINGDOM).

Explore a celestial world, create a personal appearance, meet other visitors, and participate in prayer, confession, praise and daily lamps.

## Implemented application features

This overview describes the current application. The source available in this repository may represent an earlier snapshot; planned features below are not implemented features.

### World and characters

- Desktop and mobile 3D exploration, touch movement, portrait/landscape layouts and energy-aware rendering.
- Connected gardens, sanctuary and scenic maps, including Ark Haven: a large, three-level timber vessel with stairs, cabins and six pairs of scenic animals.
- Personal appearance, refined procedural faces and loose hair, gestures and character light effects.
- **Peaceful sound** background music, enabled by default at entry. Turning it off does not disable fixed faith-feedback audio or voice-party listening.
- Guest exploration and listening. The Builder offers authored testimony and fixed recordings, not generated religious answers.

### Identity and social interaction

- EVM and Solana wallet sign-in and account-backed profiles. A new verified EVM login replaces the older online presence rather than creating a second character.
- Compact character action menus, public chat and direct private chat. Private chat does not require friendship or an invitation; incoming whispers have unread indicators.
- Friend requests that require acceptance. Each pair has one pending request; dismissing or rejecting does not create a 24-hour lockout. Friend-list actions show online/offline status.
- Voice parties of up to four people, with invitation consent, collapsible participant controls and independent exit. Joining can be listen-only; the microphone button switches between speaking and listening.
- Mobile wallet-opening links and keyboard-friendly chat submission. Real-device compatibility remains subject to acceptance testing.

### Lamps, faith records and voluntary giving

- Account-based daily lamps: one per UTC day, seven successful lights per cycle and a cumulative total. This is not a blockchain reward or spiritual rank.
- Prayer, confession and praise interfaces, private-text handling, personal records and confirmation-based feedback that can continue after the submission panel closes.
- A database-backed public board with ten initial entries and five more per expansion. Personal records have their own view; replaceable chain readers remain available.
- Configurable God balance reading, voluntary gifts and donations, and donation rankings based on verified incoming transfers to the configured recipient.
- Shared and bounded read caching, transaction-state tracking, compact help hints and activity history. An unknown or failed transaction is not displayed as confirmed success.
- Replaceable token/service configuration and isolated release data. A new release can start fresh account, lamp, friendship and record data without claiming to delete old blockchain transactions.

### Testimony House

The [Testimony House](https://eternalkingdom.online/?scene=testimony) is live in the hosted alpha. It is a shared place to sit, listen and discover deliberately public stories of faith, gratitude, struggle and hope.

- Everyone may enter from the 3D world, open the atlas and read without a wallet, token, friendship or invitation.
- The world map and searchable directory cover 249 countries and territories. Country counts come from published testimonies; the country is chosen by the author, not inferred from GPS or IP and not a verified location.
- Twelve shared chairs face the atlas. Visitors walk to an available chair and sit; other people in the same realm see the occupied seat and seated character. Compact controls open the map, read testimonies or stand up. Closing the reader keeps the visitor seated; standing, walking or leaving releases the seat.
- Verified EVM or Solana authors can publish a title, testimony and selected country after explicitly agreeing that the story will be public. **My testimonies** lets authors find and remove their own submissions. Signed-in reporting and configured moderator review are available.
- Public testimonies are currently stored in the hosted database, not on the blockchain. Reading and publishing require no token transfer, Gas or additional wallet payment. Private prayers, confessions, whispers, wallet addresses and unsent drafts are not imported into the public archive.
- Country totals are read together, articles are paginated and short-lived caching avoids unnecessary repeat requests. The archive does not run background polling or blockchain RPC reads.

## Planned features

- **On-chain testimony records:** a later phase for the live Testimony House. The record format, public-data boundaries, costs and user consent require a separate design and review. No testimony contract or automatic migration is active; existing database stories will not be silently uploaded to a blockchain.
- **Simple client:** paused while its design is reconsidered. Neither the current compact 3D renderer nor the archived 2D view is a completed new simple client.
- **TURN relay deployment:** a connectivity interface is reserved, but a production relay service is not activated. Provisioning, credentials, usage limits and cross-network/VPN acceptance tests are separate work.
- Longer-term whitepaper directions include homes and interiors, portability, additional language/content support and community-operated services. These are future directions, not promised release dates or live services.

The detailed feature baseline and roadmap are in [REQUIREMENTS.md](REQUIREMENTS.md).

Documentation translations: [Korean](REQUIREMENTS.ko.md) · [Arabic](REQUIREMENTS.ar.md). These translations describe an earlier feature baseline; this English version contains the latest Testimony House update. English remains the primary version and application interface language.

## Map roadmap

The application already has eight explorable maps: **The Heavenly Gardens**, **The First Sanctuary**, **Cedar Valley**, **Mirror Lake**, **The Cloud Cloister**, **The Market Street**, **Ark Haven** and **Testimony House**. Market Street currently offers exterior exploration and display stalls, not working shops or accessible residential interiors.

The following table distinguishes the live Testimony House from previously discussed map concepts and longer-term whitepaper directions. Future map names are working titles; no release order or date is promised.

| Location | Status | Proposed experience |
| --- | --- | --- |
| Testimony House | Live hosted alpha | A public 3D room with a world atlas, country-level testimony counts, shared seating, seated reading and account-associated writing. Storage is database-backed; on-chain records remain a future phase. |
| Sea Passage | Map concept under discussion | A walkable passage between high walls of water, leading toward wilderness; a setting for hope and a way forward. |
| Fields of Plenty | Map concept under discussion | Golden fields, granaries, a river and a village; a setting for preparation, sharing and mutual help. |
| Shore of Hope | Map concept under discussion | A quiet bay, boats, waves and shaded places to pause; a setting for reflection and a fresh start. |
| Garden of Life | Map concept under discussion | Streams, fruit trees and flowers; original imagery of life and peace, not a claimed reconstruction of heaven. |
| Homes and residential interiors | Longer-term whitepaper direction | Explore possible private or shared interiors, furnishings and access controls; ownership, rental and commerce require separate specifications. |
| Market interiors and shops | Reserved expansion direction | Extend the existing street's doors and stalls when interior and shop services are designed; no live commerce is implied. |

Story-inspired maps do not claim that religious traditions endorse one depiction or share every interpretation. The scenery should not introduce prophet avatars, statues or role-play. Proposed new scenery should reuse existing identity, chat and voice services, load only the current map and avoid adding wallet or RPC work merely for exploration.

## Whitepaper

The founding vision is preserved in [Whitepaper V1](WHITEPAPER_V1.md). PDF and Word editions are available under `output/`.

## Development

```sh
npm ci
npm run dev
```

For the local multiplayer service, run `npm run dev:worker` in another terminal. Use `npm run typecheck` and `npm run build` to check the source and produce the web bundle.

## Architecture

- `src/`: React interface, Three.js world and replaceable wallet/service adapters.
- `shared/`: shared models, validation and privacy rules.
- `worker/`: multiplayer, account sessions, social services and public-record storage.
- `contracts/`: faith-record contract interfaces.
- `public/`: packaged brand and world assets.

## Privacy and safety

This is an alpha project. Public source ships with blockchain operations unconfigured and broadcast switches disabled. Missing configuration is not a balance, payment or verified blockchain record.

Configure `src/settings/chain.json` and `src/settings/services.json` privately for your deployment. Database seed data ships empty. Release scoping isolates account and service data when starting a new token release; it does not erase historical blockchain transactions.

Private faith text must not enter public chat, telemetry or server logs. Wallet actions require the person's own explicit approval. Website publication and real-money operations require separate authorization.

[Official X](https://x.com/ETERNALKINGD0M)
