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
- Blocking and reporting interfaces remain reserved; additional user-facing controls are deferred.

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

## 6 Planned Testimony House

The agreed product direction is:

- An enterable public Testimony House in the existing 3D world, independent of the future simple client.
- Everyone may enter, view the map and read testimonies. Visiting and reading require no wallet, token holding, friendship or invitation.
- A world map inside the house displays testimony counts by country in the first version, without city-level detail.
- Authors select or search for a country rather than having one inferred from GPS, IP or wallet data. This is an author-selected association, not location verification.
- Logged-in submissions are associated with their authors, appear under the selected country and update its count. Selecting a country opens its testimonies. Login establishes authorship, not entry permission.
- Testimonies are deliberately public submissions. Private prayers, confessions, whispers and wallet addresses must not be imported automatically.

The proposed implementation stores public testimonies in a database, reads country counts together and loads articles in pages after a country is selected, rather than making separate RPC requests for map markers. Validation, content length, editing, deletion, moderation and abuse controls still need design. The feature is not implemented and has no promised release date.

## 7 Map Catalog and Expansion Roadmap

### Seven Implemented Maps

| Map | Current experience and limits |
| --- | --- |
| The Heavenly Gardens | Main entrance, courtyard, riverside, terrace and passages to other maps. These courtyard areas are not separate maps. |
| The First Sanctuary | An enterable sanctuary with prayer, confession, praise and donation interfaces. Opening an interface does not submit a record or make a payment. |
| Cedar Valley | Trees, streams and walkable natural scenery. |
| Mirror Lake | Water, open sky and quiet lakeside paths. |
| The Cloud Cloister | Colonnades, terraces and exploration paths above the clouds. |
| The Market Street | Building exteriors, closed doors and display stalls with inspectable descriptions. Interiors, shop transactions and property ownership are not open. |
| Ark Haven | The implemented three-level vessel, stairs, cabins, decks and six pairs of animals. It is not listed again as an unbuilt map. |

### Agreed New Location

**Testimony House is planned, not implemented.** It follows the country-level testimony design above: a public interior for everyone to visit and read, with account-associated writing and a way for authors to find their records. Its world map represents real-world countries, not the game's destination menu. Whether it needs a separate scene or room instance will be decided during implementation, without assuming another service is necessary.

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

- **Simple client is paused.** Its design remains undecided, including whether it uses a fixed view, 2.5D or another approach. The current compact 3D renderer and archived 2D view are not a completed new simple client.
- **TURN relay integration is reserved, but the relay service is inactive.** Provider selection, configuration, temporary credentials, usage limits and real-device, cross-network and VPN acceptance tests are separate work. Reliability on every network and permanently free operation are not promised.
- **Longer-term vision:** evaluate homes and interiors, portable profiles and backups, additional languages and content, and community-operated services in line with the whitepaper. Scope, priorities, funding and governance require further decisions and are not current completed features.

## 9 Acceptance and Publication Boundaries

The project remains an alpha. Automated and synthetic tests do not replace real mobile wallets, long-running group voice, low-end devices, capacity testing or an independent security audit. Zero bugs are not promised.

Uploading feature documentation does not authorize website publication, TURN activation, contract deployment or real-money operations. Each requires separate authorization. Preserve the whitepaper and local work; do not publish token-contract settings, recipient configuration, credentials, private content or operational logs.
