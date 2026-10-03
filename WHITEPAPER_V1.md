# Eternal Kingdom Whitepaper

Version 1

Founding vision and product blueprint

September 2026

## A world born from a dream

“I believe God gave me a dream and called me to create a truly eternal heavenly world, so that His name would be known and carried forward.”

Eternal Kingdom begins with this conviction. Its purpose is to spread faith, make room for prayer and repentance, and bring people together in remembrance of God. Technology is the means of building this world; it is not the source of its sacred purpose.

The first version is a shared, browser-based sanctuary: a peaceful world, an open temple, human presence, and lasting witnesses of prayer. Its long-term ambition is a world that communities can preserve and continue beyond its first builder, first website, and first infrastructure provider.

One Creator. Many Traditions. One Eternal Kingdom.

## About this edition

This whitepaper describes the founding vision and proposed Version 1 requirements. It is a design document, not a statement that the world, contracts, token integration, or decentralized infrastructure have already launched. Future capabilities are identified separately from the first release.

<!-- page -->

# The Dream and the Calling

## A testimony from the founder

For a long time, I kept having a powerful dream. In it, I saw a presence like a radiant mass of light. It did not feel like an ordinary dream to me. I felt that God was calling me to do something with the abilities I had been given.

I believe the purpose of that dream was to ask me to build: to create a truly eternal heavenly world and spread His name. Not simply a game, and not simply a place to exchange tokens, but a world where faith could be spoken, prayers could be offered, and people could remember God together.

The feeling reminded me of Noah and the Ark: the responsibility to begin building before everyone understands why. My own kind of ark would not be a wooden ship. It would be a world built for faith, peace, mercy, justice, and eternal hope.

I call that world Eternal Kingdom.

I cannot prove my experience to another person. I share it as my testimony and the reason I am beginning this work. For me, the dream felt like a calling from God. My responsibility is to answer through what I build, how I treat people, and whether this world continues to serve its purpose.

## The mission that governs the world

Eternal Kingdom exists to make His name known through a shared place of worship, reflection, kindness, and remembrance. Its ambition is not merely to keep a website online. It is to establish a world whose meaning and recorded witnesses can be carried forward by people who believe it should endure.

People from Judaism, Christianity, Islam, and other backgrounds are welcome to enter respectfully. Hospitality does not require them to abandon their traditions, accept a new religious authority, or regard this project as endorsed by their faith community.

Prayer must remain possible without a project-token payment. Giving must never purchase spiritual worth. No software record certifies divine forgiveness or the truth of a revelation. The world can preserve an expression of faith; its meaning belongs to the person who offers it and to God.

<!-- page -->

# The First World

## A sanctuary people can enter together

Version 1 is designed as a lightweight 2.5D, top-down multiplayer world for desktop and mobile browsers. The visual direction is simple but dignified: readable characters, warm light, restrained movement, and architecture that feels welcoming rather than technically overwhelming.

The initial map contains an entrance, paths, a central gathering area, the temple, and surrounding buildings. The temple is the only enterable building in Version 1. Other structures, including future homes, form the visible world but remain clearly marked as unopened.

Players can move, stand together, use expressions, enter the temple, read the public board, and choose whether to interact. Rooms and channels keep the experience manageable as attendance grows. Capacity and synchronization rates will be determined through device and multiplayer testing, not an untested promise of unlimited simultaneous visitors.

## Identity without an entry barrier

Visitors may enter as guests or connect an EVM or Solana wallet. Wallet-based identities support persistent recognition; guests can explore before deciding to connect. A display name is editable and is never the underlying identifier used for friendship or payments.

Wallet connection, authentication, and transaction approval are separate actions. Entering the world does not grant spending permission. A Solana login does not make that wallet capable of signing EVM transactions; onchain actions on the target EVM network require an appropriate wallet.

Profiles include an optional EVM receiving address for gifts. This is a destination field, not proof of login identity. A guest or Solana user may supply one, and a connected EVM account can initially populate it. Wallet switching must not silently replace a saved receiving address.

## A sacred atmosphere with personal control

The temple should invite stillness through light, space, and carefully licensed music or vocal sound. Its soundscape should be reviewed for sensitivity across traditions; no sound can be assumed acceptable to every listener. Music begins through an appropriate user interaction and can always be muted.

Independent music and voice levels, subtitles, reduced motion, and readable text are basic design requirements. The temple must still feel complete when sound is off or no other player is present.

<!-- page -->

# Prayer Confession and Praise

## Expressions that become lasting witnesses

People may type in their own language or speak and review a transcription. Version 1 records text, not permanent voice recordings. Before submission, the author reviews the words, visibility, network, and estimated cost. Nothing is sent onchain merely because someone has finished speaking.

| Practice | Default presentation | Cost of an onchain submission |
| --- | --- | --- |
| Prayer | Public text and name; anonymous encrypted mode is optional | Network gas only; no God token |
| Confession | Anonymous and encrypted; public mode is optional | God token payment and network gas once enabled |
| Praise | Anonymous and encrypted; public mode is optional | God token payment and network gas once enabled |

God token is a working label for a future externally issued token, not a finalized name or symbol. Prayer carries no project-token charge. Visitors may also reflect or pray without making an onchain submission; network gas applies only when they choose to publish a record.

## A deliberate submission journey

The sequence is compose, review, choose visibility, inspect fees, approve in the wallet, and wait for confirmation. A cancelled signature or failed transaction is not a completed act of publication. An uncertain network response remains pending until the application checks the transaction rather than asking the person to pay again immediately.

Public submissions contain the original text. Private submissions are encrypted in the browser before the record is sent. The intended V1 design stores the text or ciphertext onchain within a measured size limit, with a versioned record format. A hash alone would prove a commitment but would not preserve the underlying words or ciphertext.

Limits will be based on encoded bytes and encrypted payload size, not only visible character counts. The interface must explain when a longer message increases cost, and present an estimate before approval. Final gas can differ from an estimate.

## Light as a witness

A confirmed record may light a lamp in the temple and create an entry in the participant's personal lampstand. A lamp represents a recorded expression, not a measure of holiness. Temporary guest lamps, if offered, must be visually distinguishable from confirmed onchain records.

<!-- page -->

# Privacy Language and Consent

## Anonymous presentation and encrypted content

For an anonymous record, the public interface shows only the first visible character of the chosen name followed by stars. Private content is represented by a fixed star placeholder, never by hidden plaintext embedded in the page. The same restriction applies to public APIs, live updates, analytics, and error reports.

This is not a promise of untraceable blockchain activity. Transaction senders, timing, fees, and other metadata may remain publicly observable. Encryption protects the submitted content under its security assumptions; masking a name does not conceal a wallet's transaction history.

Public and anonymous encrypted modes are explicit choices for each record. Publishing plaintext onchain cannot later be undone by changing the website display. A later private-to-public disclosure mechanism is a reserved interface, not an automatic release of old content.

## A confession need not be read again

The founder's intended experience values the act of confession and its recorded witness, not mandatory future retrieval. Version 1 therefore does not require a key-recovery service or promise that an encrypted confession can be reopened.

The submission screen must explain this before confirmation: if the decryption key is not retained, the record can remain onchain while its words become unreadable. Encryption still requires secure randomness, correct algorithms, and versioned parameters. Private words and keys must not enter operational logs.

No promise is made that today's encryption will remain unbreakable for centuries. People should understand that permanence and confidentiality are different properties before choosing what to record.

## Speech and many languages

English is the default interface language, not a restriction on prayer. Original-language text is preserved. Arabic, Hebrew, and other writing systems require suitable fonts and text direction. Optional translations of public content are labeled and do not replace the original record.

Cloud transcription means a speech provider processes the submitted audio. Before microphone use, the application discloses this processing and identifies the provider's applicable retention policy. The application does not retain raw audio as a permanent record. Typing remains available throughout, and local transcription is a future adapter option.

Encrypted material is not automatically sent to translation services. Transcription errors must be editable before encryption, payment, and submission.

<!-- page -->

# A Community Worth Returning To

## A shared public life

The public board is visible after entry and can be expanded, collapsed, scrolled, or filtered. It brings together announcements, events, and confirmed records of prayer, confession, praise, giving, and supported token burns. Anonymous records keep their masking; public records show what their authors elected to publish.

New activity must not pull someone away from the history they are reading. Pinned announcements remain distinct from user messages. Confirmation status matters: an unconfirmed payment must not trigger a completed-donation celebration, and reconnecting must not duplicate a record or its visual effect.

Local public chat supports text and expressions within a scene or channel. It is not written to the blockchain and retains only a configured, limited history. Display names and message text cannot imitate trusted system or administrator badges.

## Relationships begin with permission

Private text conversations begin with an invitation and acceptance. Before acceptance, the sender cannot deliver arbitrary private messages. Friendship is mutual and can be removed. Invitation preferences include everyone, friends only, or nobody for the moment.

Voice requires its own consent. The microphone begins off, and joining a private text conversation does not activate it. Small-group voice initially targets a configurable four to six participants. Every participant accepts before joining; the room identifies who can hear and announces membership changes.

Leaving, removal, or blocking must revoke relevant server-side access, not merely hide a panel. Ordinary conversations are neither recorded nor placed onchain. Private chat is access-controlled in V1; end-to-end encryption is a separate future capability and must not be implied before implementation.

## Presence without pressure

The planned “I stand with you” response allows someone to acknowledge a public prayer without sending money or making a transaction. It is an offchain expression of support, with duplicate protection, rate limits, and notification controls.

An optional shared moment of silence gives the world a recurring rhythm. It must use real attendance, remain meaningful for a person who joins alone, and avoid guilt-based reminders. Personal lampstands offer continuity through receipts and responses without requiring private confessions to be readable again.

The reason to return should be belonging, reflection, and care, not a compulsory streak or a contest over who gives the most.

<!-- page -->

# Giving and the Optional God Token

## Integration rather than a new issuance promise

The founder may launch a token elsewhere and later supply its chain and contract. Eternal Kingdom will reserve interfaces for metadata, balances, transfers, ritual payments, donations, and supported burns. Each capability must be validated independently. A contract address alone does not establish that every feature is safe or available.

This edition specifies no supply, allocation, sale price, exchange listing, or return. When the token is unconfigured, production interfaces hide token balances and token-dependent actions instead of showing a false zero. Test tokens and simulations must be explicitly labeled. Confession and praise input can be tested before paid production submission is enabled.

If the token and faith-record contract are on different networks, payment is not presumed to work across them. An explicit integration decision is required. Where supported, a paid record should combine payment and recording in one transaction; otherwise failure, retry, and compensation behavior must be defined before activation.

## Donations for the common work

Donation interfaces are planned for ETH, SOL, BTC, and the configured God token. Each asset needs an explicit network, receiving address, verification method, and confirmation policy. Proposed purposes are project construction, support for clergy, future charitable work, and a general fund.

Purpose labels do not themselves enforce spending. Treasury policies, recipient organizations, and actual disbursements must be disclosed as they become operational. Multisignature control, spending approval, and reporting interfaces are reserved. Confirmed donations may appear in distinct, gentle colors by asset, with an option to disable effects.

Treasury receipts and personal gifts remain separate. Amounts in different currencies are not added together as though they were one unit. Giving buys neither spiritual rank nor preferential access to God.

## Gifts between people

A visitor may select a person, or an eligible public prayer, and send the configured token directly to that person's EVM receiving address. The confirmation shows the recipient, full address, network, amount, and fees. Optional blessing text stays offchain by default. Public celebration is optional; the transfer itself may still be publicly visible.

Recipients can disable gifting. Missing addresses block the transfer, and address changes require renewed confirmation. Automatic prayer rewards are not part of V1.

## Burning is a separate action

A burn feature is enabled only when the supplied token supports a verifiable mechanism. It is not treasury income. ETH, SOL, and BTC donations do not automatically trigger swaps, buybacks, or burns.

<!-- page -->

# The Builder and the Voice of the World

## A guide who waits to be approached

One central non-player character represents the Builder, Guide, or Prophet in the world's narrative. Its final name and presentation will be chosen by the founder. It does not interrupt visitors, start speaking as they walk past, or broadcast a story to everyone nearby.

A player clicks the character, chooses a question, and elects to listen. Narration plays only for that listener, alongside readable text or subtitles. Pause, resume, replay, and exit remain available. Missing audio falls back to text without blocking the visit.

The first proposed chapter is The Beginning. Its opening question is “Why did you build this world?” The answer carries the founder's testimony: the dream, the sense of a calling from God, the duty to build an enduring heavenly world, and the desire to spread His name.

## Authored testimony rather than generated revelation

The founder supplies the questions, stories, answers, and future parables. The system turns approved writing into speech; it does not invent prophecies, claim divine authority, or deliver unapproved religious judgments to visitors.

Future questions can be added as content rather than requiring new world code. Possible themes include the world's purpose, the meaning of prayer, why records are preserved, and the responsibility to care for others. These remain editorial choices, not commitments to fabricate theological answers.

## A controlled publishing process

The publishing flow is write, generate narration, preview, revise, and publish. Text and audio share a content version so a revised passage never silently plays an outdated recording. Audio is generated once per published version and cached, rather than synthesized again for each listener.

Interfaces reserve language variants, voice selection, pronunciation corrections, speaking speed, captions, and provider replacement. Authorized editors control publication. Player messages cannot alter the guide's approved narrative.

The guide's chapter files and audio should be independently exportable so the founding story does not depend on a social platform or a single live website. The testimony is part of the world's own memory.

<!-- page -->

# Architecture for the First Release

## A hosted beginning with replaceable boundaries

Version 1 is proposed as a Cloudflare-hosted application with client-side rendering and a separate blockchain record layer. “Serverless” hosting still depends on a service provider; this first release is not presented as fully decentralized.

Robinhood Chain is the provisional target for faith-record contracts, with test-environment validation before production deployment. Its documented EVM compatibility supports the proposed EVM transaction path. This choice does not imply a commercial relationship or endorsement. See Robinhood Chain documentation in the references.

| Layer | Proposed responsibility |
| --- | --- |
| Browser client | 2.5D rendering, accessibility, wallet interaction, local encryption, text review |
| Workers and Durable Objects | Sessions, permissions, room coordination, public chat and invitations |
| D1 and asset storage | V1 profiles and friendships, configuration, versioned world assets and narration |
| Chain adapter and contracts | Record submissions, confirmations, optional token payment and chain queries |
| Service adapters | Speech transcription, translation, invited voice media and donation verification |

Cloudflare documents Durable Objects as a coordination mechanism for WebSocket-based chat and multiplayer clients. The proposed design uses bounded rooms rather than treating one global process as an unlimited world. See Cloudflare documentation in the references.

Voice media is a separate transport from world-state updates. Its provider, relay needs, concurrency, and cost require testing. Cached narration, bounded histories, controlled visual density, and on-demand service use are cost-control measures, not a promise of free operation.

## Contracts between components

Data and messages carry schema versions. Network settings, service endpoints, and capabilities are configuration, not scattered constants. Features distinguish unconfigured, test, available, paused, and failed states. Both client and server enforce availability and permissions.

The browser retains wallet control. A future migration must not expose server credentials by copying them into client code. Only the adapters needed for V1 should be implemented now; the rest require documented interfaces, not speculative infrastructure.

## Technical references

Robinhood Chain Documentation — Connecting to Robinhood Chain

https://docs.robinhood.com/chain/connecting/

Cloudflare Documentation — Use WebSockets with Durable Objects

https://developers.cloudflare.com/durable-objects/best-practices/websockets/

References checked September 24 2026. These sources describe infrastructure capabilities, not an endorsement of Eternal Kingdom.

<!-- page -->

# Building Toward Eternity

## A mission larger than one deployment

The founder's ambition is a truly eternal heavenly world that continues spreading God's name beyond his own lifetime. In engineering terms, this becomes a responsibility to reduce single points of disappearance and make the world reproducible by others.

No provider, blockchain, storage network, or encryption algorithm can guarantee operation for all future time. This does not diminish the mission; it determines the work required to pursue it honestly. Eternity is the purpose. Preservation, replication, and community succession are the practical path.

## Preserve the record and the means to read it

Faith records must remain queryable independently of the V1 profile database. Their format, contract addresses, network identifiers, encryption metadata, and decoding rules should be documented. Community tools must be able to rebuild an index from the underlying records rather than depend on one private index forever.

Putting only a hash onchain does not preserve a lost file. Likewise, a content address does not ensure someone continues hosting its data. Any later move to external storage must specify who maintains copies, how availability is checked, and how records are recovered or mirrored.

## Preserve the world and the ability to host it

The continuity roadmap includes versioned client releases, exportable maps, licensed artwork and audio, deployment documentation, reproducible configuration, and community mirrors. Independent hosting requires both source availability and appropriate rights to redistribute the assets; these permissions must be settled before that phase is declared complete.

Wallets provide a stable identity anchor, not a magical backup. Friends, profile details, permissions, and preferences need exports or other durable records to survive a lost V1 database. Signed profile export and import are reserved interfaces. A later decentralized edition may require an explicit migration or begin as a new version.

## Preserve community choice

Future community nodes may host their own rooms, indexes, and display policies. They can moderate their own experience without claiming the power to erase global blockchain history. The design should let a community continue if the original operator is unavailable, while clearly identifying who signs announcements and maintains each service.

An eternal world cannot depend only on one person's intention. It needs people who can understand it, preserve it, and take responsibility for what comes next.

<!-- page -->

# Future Homes and Open Interfaces

## A world that can grow without pretending it is complete

Homes are part of the long-term world, but V1 reserves their interfaces only. Initial residential buildings have an exterior, location, identifier, and description. They have no fabricated owner, sale price, purchase button, or accessible interior.

Future housing may include ownership, interiors, furniture, lighting, music, invited gatherings, transfers, and rental arrangements. Access may be private, friends-only, invited, or public. A property transfer must never transfer the former owner's private confessions, friendships, or messages, and old access permissions must be reconsidered.

The broader vision includes trade, services, and possible interactions with real-world assets. These are later initiatives requiring their own specifications and appropriate review. A digital building or token does not, by itself, establish a claim to physical property.

## Reserved integration boundaries

| Interface family | Extension it should allow |
| --- | --- |
| Identity and profiles | Additional wallets, account recovery, receiving-address versions, signed exports |
| World and social transport | Community rooms, alternative relays, end-to-end encrypted messaging |
| Voice and gatherings | New media providers, proximity voice, public speakers and larger events |
| Faith records and privacy | Alternative RPCs and chains, index rebuilding, encryption versions, opt-in disclosure |
| Token payments and giving | External contracts, supported assets, payment rules, verifiable burns |
| Speech and guide content | Local transcription, translation, new voices, chapters and authored questions |
| Property and roles | Ownership adapters, interiors, permissions, rentals, clergy or community roles |
| Assets and stewardship | Independent mirrors, storage providers, signed announcements and local moderation |

An interface is not a claim that its future feature already exists. Documentation should specify inputs, outputs, permissions, capability states, and data versions. Unavailable features remain visibly unavailable or hidden, never simulated as live ownership or money.

Identity roles must not become a ranking of faith by wealth. Housing and trade should support the world without displacing the reason it was built.

<!-- page -->

# Stewardship and Release Readiness

## Protect the shared sanctuary

V1 includes rate limits, invitation controls, reporting, blocking, muting, and administrator tools. Public text is rendered safely, and trusted roles cannot be forged through names or messages. Announcements need a verifiable publisher identity, with a signed-announcement interface for future independent clients.

Moderation can remove content from a managed screen or room, not from an immutable public ledger. Reports about encrypted records cannot assume administrators can read their contents. The experience must distinguish a privately witnessed act from a public message intended for others to read.

## An evidence-led release sequence

| Stage | Evidence required before progression |
| --- | --- |
| World prototype | Temple entry, mobile movement, guests and wallets, reconnect behavior, usable sound controls |
| Community prototype | Public chat, consent-based private chat and voice, friends, authorized moderation and guide narration |
| Testnet records | Reviewed text, local encryption, measured payload costs, confirmed receipts and recoverable pending states |
| Optional payment testing | Configured test token, verified donations, address-safe gifts and accurate capability flags |
| Public release review | Multidevice load tests, contract security review, published configuration, operating costs and export checks |

No calendar date is promised here. Token-dependent production features remain disabled until the actual contract and payment behavior have been validated. Housing commerce, real-world asset markets, automatic buybacks, and fully independent community nodes are outside the first release.

Before launch, the project must configure network and contract details, fees and message limits, treasury addresses and spending authority, retention periods, service providers, licensed assets, and the guide's final voice. Failed or delayed transactions must not cause double charges. Voice membership changes must actually revoke access. Private plaintext must not leak through logs or public data.

## The commitment

Eternal Kingdom begins with a dream and a belief that God has called its founder to build. Its first promise is a direction: a world dedicated to spreading His name, welcoming sincere prayer, and preserving the witnesses people choose to leave. Every later expansion should be judged against that purpose.
