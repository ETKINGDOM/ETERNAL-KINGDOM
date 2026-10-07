# ETERNAL KINGDOM Feature Status and Roadmap

This document describes the current application and the directions discussed for its development. It does not imply that the repository's existing source snapshot includes every latest implementation. Statuses distinguish implemented, configuration-dependent, planned, paused and pending-acceptance work. Planned features must not be presented as live. The founding whitepaper remains unchanged; this baseline defines the current interaction rules.

## 1 Implemented World and Characters

- Desktop and mobile 3D exploration, touch movement, portrait and landscape layouts, lightweight rendering, map entrances and character gestures.
- Gardens, a sanctuary and scenic maps. Ark Haven is a large, enterable three-level vessel with stairs connecting the cabins and decks. Six species appear in pairs, twelve scenic animals in total; they are not online players or background AI.
- Personal appearance, refined procedural faces and natural loose hair. A close follow-camera helps visitors identify and control their character.
- The background-music control is **Peaceful sound**, enabled by default at entry. Turning it off affects background music only; fixed feedback recordings and voice-party listening remain independent.
- The Builder offers authored testimony and fixed recordings when approached, not automatically generated religious answers. Guests can explore and listen.

## 2 Implemented Identity and Social Interaction

- EVM and Solana wallet sign-in, server-verified signatures, saved account profiles and appearances. EVM and SOL remain separate identities even in the same wallet application.
- A new verified EVM login replaces the older session, leaving only one online character for that account. Display names are not unique identifiers or proof of a religious role.
- Selecting a character opens a compact menu for profile, whisper, voice invitation, friendship and gifts. Friend-list entries offer the corresponding actions and clearly show offline status.
- Private chat is independent of friendship: select a person and chat directly, without a text invitation. Incoming whispers have unread indicators. Chat content is not restored across a new login, and contacting one hundred people does not permanently exhaust a lifetime contact quota.
- Friendship follows request, receipt, acceptance and addition to the friend list. Each pair has only one pending request. Dismissing a notification does not reject the request; another request can resurface the reminder. Rejection, cancellation or removal permits a new request without a 24-hour cooldown. Existing friendships are identified as such.
- Voice invitations require acceptance, with a maximum of four participants. Joining may be listen-only; a missing microphone must not prevent listening. Only the person's microphone action requests capture permission. Turning it off returns to listening, without automatic microphone restart.
- The top-left voice roster shows simple avatars and names and can be collapsed. Exit removes only the person leaving; one participant's connection failure should not dissolve everyone else's party.
- Mobile wallet-opening links avoid redundant confirmation. Chat submission accommodates keyboard dismissal and focus changes. Actual devices, wallets and networks still require acceptance testing.
- Additional social blocking and reporting controls remain reserved; Testimony House reporting is described in Section 6.

## 3 Implemented Lamps Records and Feedback

- A verified account may light one lamp per UTC day. Seven successful lights complete a cycle, while the cumulative total survives missed days. Lamps charge no God tokens or Gas and promise neither rewards nor religious rank.
- Lamps and **My records** use adjacent tabs rather than long explanatory dropdowns. Personal records support categories, refresh and pagination. The public board reads the independent database by default, initially displays ten entries and adds five per **...** expansion; the chain-reader interface remains available.
- Transaction tracking follows prayer, confession and praise submissions independently of their panels. Closing a form early does not prevent confirmed feedback, fixed recordings or character light effects. Unknown, failed or unverified results are not displayed as blockchain success, and payments are not automatically repeated.
- Detailed explanations belong in compact help hints that remain readable instead of becoming narrow scrollbars. Short-lived notices are separate from the activity history visitors can open.
- Private faith text must not enter public chat, telemetry or server logs. Public displays respect anonymous-name and ciphertext masking choices; these choices do not delete blockchain senders or previously published data.

## 4 Configuration Dependent Wallets Gifts and Donations

- Configurable God balance reads, gifts, donations and transaction confirmation. Shared caches and in-flight reads reduce duplicate RPC work. Failed or unconfigured reads must not display fabricated balances.
- EVM sign-in makes the login address available for receiving gifts by default, with an opt-out. A SOL identity needs a separately configured EVM address to receive EVM God tokens. Gifts use the recipient's address and amount and require the sender's own wallet approval.
- Donation rankings aggregate verified incoming transfers to the specified recipient, not the treasury wallet's current balance. Query windows and incomplete results must be identified.
- Prayer has no token-holding requirement. Configured onchain confession and praise require at least one God token without deducting or burning it for that action; network fees may still apply.
- Voluntary gifts and donations do not purchase forgiveness, religious identity or spiritual status. Public source ships with empty address and service settings and disabled broadcast switches; a fresh deployment must not be described as supporting real payments until configured and verified.

## 5 Implemented Release Scoping Interfaces

- Wallet, token, faith-record, social and reading services use replaceable interfaces. The token contract and its related bindings are managed through one configuration layer.
- Clearing the token configuration leaves an explore-and-listen showcase without onchain actions. A new token release starts an independent data cycle: profiles, names, appearances, cumulative lamps, friends, sessions and website records start fresh, without carrying test data forward.
- One-step clearing and redeployment are private operational workflows that require separate authorization to execute. Data-cycle isolation is not physical database deletion, and historical blockchain transactions cannot be erased. Changing the token contract must not reuse stale record-contract bindings or automatically enable payments.

## 6 Implemented Testimony House — Hosted Alpha

The [Testimony House](https://eternalkingdom.online/?scene=testimony) is a live shared room in the existing 3D world, independent of the paused simple client. It brings the country atlas, public stories and places to sit into one explorable space.

### Entry and World Atlas

- Visitors enter through the garden passage or map selection.
- Everyone may enter, view the map and read testimonies. Visiting and reading require no wallet, token holding, friendship or invitation.
- A world map and searchable English directory cover 249 countries and territories. Totals reflect published, visible testimonies, without fabricated stories or city-level detail.
- Authors select or search for a country rather than having one inferred from GPS, IP or wallet data. This is an author-selected association, not location verification.
- Selecting a country opens its stories. The archive is shared across realms within the same release; seating and online visitors remain realm-scoped.

### Shared Chairs and Seated Reading

- Twelve chairs face the world atlas. Selecting a chair or the seat directory walks the visitor to it before requesting a seat.
- The multiplayer server checks proximity and allows one occupant per chair. Seated poses and occupancy are visible to other visitors, including people arriving later.
- Compact seated controls offer **Open world map**, **Read testimonies** and **Stand up from seat**. Closing the reader does not stand the character up.
- Standing, walking, gesturing or leaving releases the seat. An explicit disconnect releases it immediately; a silent connection loss is bounded by a 65-second seat lease refreshed through the existing heartbeat, not new archive or blockchain polling.

### Publishing, Reading and Moderation

- A verified EVM or Solana account may publish a title, public testimony and selected country after explicit public-content consent. Login establishes authorship, not entry permission; public author names do not expose raw wallet addresses.
- Titles accept 3–100 characters and testimony bodies 20–4,000 characters. Each account may create five testimonies per UTC day. Reading is paginated, with twelve stories per requested page.
- **My testimonies** lets authors find and remove their own submissions. Removal hides the public text and updates country totals. Minimal duplicate-prevention metadata remains; copies already obtained by other people cannot be recalled.
- Signed-in visitors can report a testimony. Configured moderators can review reports, dismiss them or hide a story. A report alone does not automatically hide content or punish its author.
- Submissions use duplicate-prevention identifiers. An unknown network result is not automatically resubmitted, and a delayed duplicate cannot resurrect a removed story.
- Country totals are read together and cached in the tab for fifteen seconds. Manual refresh, publication and removal invalidate the relevant reads. Articles load on demand; there is no background archive polling or per-country blockchain RPC work.

### Current Storage and Privacy

- The hosted alpha stores testimonies in Cloudflare Durable Object SQL. These are database records, not blockchain transactions. Reading and publishing require no token transfer, Gas or additional wallet payment.
- Ordinary website updates preserve the current release archive. An explicitly authorized fresh release selects a separate data namespace; it is not a claim that old databases or downloaded copies are physically deleted.
- Testimonies are deliberately public submissions. Private prayers, confessions, whispers, raw wallet addresses and unsent drafts are not imported into this archive. Unsent drafts remain in memory and are discarded when the form closes or the account changes.
- The room and its current storage are implemented in the hosted application. This documentation update does not imply that the older public source snapshot contains the latest private implementation.

### Future On-Chain Records

Blockchain-backed testimony records are a later phase, not an active feature. Record structure, public-data boundaries, consent, costs and removal limitations require a separate design and review. No testimony contract is deployed and no existing story is automatically migrated. Contract deployment, migration or payment activation would each require explicit authorization.

## 7 Map Catalog and Expansion Roadmap

### Eight Implemented Maps

| Map | Current experience and limits |
| --- | --- |
| The Heavenly Gardens | Main entrance, courtyard, riverside, terrace and passages to other maps. These courtyard areas are not separate maps. |
| The First Sanctuary | An enterable sanctuary with prayer, confession, praise and donation interfaces. Opening an interface does not submit a record or make a payment. |
| Cedar Valley | Trees, streams and walkable natural scenery. |
| Mirror Lake | Water, open sky and quiet lakeside paths. |
| The Cloud Cloister | Colonnades, terraces and exploration paths above the clouds. |
| The Market Street | Building exteriors, closed doors and display stalls with inspectable descriptions. Interiors, shop transactions and property ownership are not open. |
| Ark Haven | The implemented three-level vessel, stairs, cabins, decks and six pairs of animals. It is not listed again as an unbuilt map. |
| Testimony House | A public room with the country atlas, shared chairs, seated reading and account-associated testimony publishing. Its current archive uses the hosted database, not a blockchain. |

### Testimony House Record-Layer Roadmap

The room, seating and database archive are live in the hosted alpha. The proposed on-chain record layer remains separate future work. The room's world atlas represents real-world countries, not the game's destination menu.

### Previously Discussed Story and Scenery Concepts

These are expansion concepts, not confirmed production commitments or scheduled releases. Names are working titles; details, order and whether each becomes a separate map remain to be confirmed.

| Map concept | Proposed scenery | Experience themes | Status |
| --- | --- | --- | --- |
| Sea Passage | A walkable path between high walls of water, with wilderness beyond. | A way through difficulty, hope and a fresh start. | Unbuilt concept awaiting confirmation. |
| Fields of Plenty | Golden fields, granaries, a river and a village. | Preparation, sharing and mutual help. | Unbuilt concept awaiting confirmation; no economic rewards or paid quests are assumed. |
| Shore of Hope | A bay, boats, waves and shaded places to pause. | Stillness, reflection and beginning again. | Unbuilt concept awaiting confirmation. |
| Garden of Life | Streams, fruit trees and gardens; day-and-night variation is a visual option to evaluate. | Original imagery of life and peace. | Unbuilt concept awaiting confirmation, not a claimed reconstruction of heaven or a depiction endorsed by all three faith traditions. |

### Longer Term Spaces and Reserved Interfaces

- **Homes and enterable interiors:** evaluate furnishings, lighting, music, gatherings and private, friends-only, invited or public access. Existing buildings do not thereby become purchasable property. Transfers, rentals, payments and ownership require separate design, review and authorization.
- **Market interiors and shops:** extend the existing door and stall interfaces when interior and shop services are designed. The present street is sightseeing only; display stalls must not be described as operating shops, and stock, owners or transactions must not be fabricated.
- **Community spaces:** future community-operated rooms and world mirrors are continuity goals, not active services or a promise of unlimited capacity.

### Shared Boundaries for Every Map

- Maintain a gentle, explorable artistic style. Story inspiration is not historical reconstruction, a universally agreed religious interpretation or institutional endorsement. Do not introduce prophet avatars, statues or prophet role-play.
- Reuse account, character, chat, friendship and consent-based voice rules rather than duplicating login, payment or private-record systems for each map.
- Load scenes on demand and draw only the current map. Collisions, floors, passages and spawn points follow shared models; characters and movement must remain legible on small screens.
- Static scenery does not require blockchain transactions or per-object RPC reads. Player counts, messages and voice usage still require concurrency-based evaluation; adding maps is not guaranteed to have zero server or download cost.
- Validate entry, exit, movement, camera behavior, multiplayer synchronization and mobile portrait and landscape layouts before opening a map. Publishing a plan does not mean that map has been built or released.

## 8 Paused Work and Future Directions

- **On-chain testimony records are planned.** The current room and public archive are live, but testimony contracts, transaction submission and automatic migration are not. A reviewed design and explicit user consent must precede any chain-backed publication.
- **Simple client is paused.** Its design remains undecided, including whether it uses a fixed view, 2.5D or another approach. The current compact 3D renderer and archived 2D view are not a completed new simple client.
- **TURN relay integration is reserved, but the relay service is inactive.** Provider selection, configuration, temporary credentials, usage limits and real-device, cross-network and VPN acceptance tests are separate work. Reliability on every network and permanently free operation are not promised.
- **Longer-term vision:** evaluate homes and interiors, portable profiles and backups, additional languages and content, and community-operated services in line with the whitepaper. Scope, priorities, funding and governance require further decisions and are not current completed features.

## 9 Acceptance and Publication Boundaries

The project remains an alpha. Automated and synthetic tests do not replace real mobile wallets, long-running group voice, low-end devices, capacity testing or an independent security audit. Zero bugs are not promised.

Uploading feature documentation does not authorize website publication, TURN activation, contract deployment or real-money operations. Each requires separate authorization. Preserve the whitepaper and local work; do not publish token-contract settings, recipient configuration, credentials, private content or operational logs.
