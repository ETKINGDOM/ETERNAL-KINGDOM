# ETERNAL KINGDOM

ETERNAL KINGDOM is a faith-centered virtual world by [ETKINGDOM](https://github.com/ETKINGDOM).

Explore a celestial world, create a personal appearance, meet other visitors, and participate in prayer, confession, praise and daily lamps.

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
- `worker/`: multiplayer, account sessions and social services.
- `contracts/`: faith-record contract interfaces.
- `public/`: packaged brand and world assets.

## Privacy and safety

This is an alpha project. Public source ships with blockchain operations unconfigured and broadcast switches disabled. Missing configuration is not a balance, payment or verified blockchain record.

Private faith text must not enter public chat, telemetry or server logs. Wallet actions require the person's own explicit approval. Website publication and real-money operations require separate authorization.

[Official X](https://x.com/ETERNALKINGD0M)
