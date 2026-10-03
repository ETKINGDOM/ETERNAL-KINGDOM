# Project guardrails

- GitHub uploads must authenticate as `ETKINGDOM` and target `ETKINGDOM/ETERNAL-KINGDOM`.
- Git author and committer must both be `ETKINGDOM <337168971+ETKINGDOM@users.noreply.github.com>`.
- Verify the authenticated account and commit identities before any push. Never fall back to another account.
- Project branding is ETERNAL KINGDOM under ETKINGDOM. Keep public documentation focused on the project.
- Identify the project account only as ETKINGDOM in user-facing communications. Do not name other accounts or discuss account transitions. The account logo is `public/brand/logo.jpg`.
- Do not publish development diaries, fixtures, operational configuration, populated wallet/contract addresses, credentials or dependency folders.
- Keep blockchain settings unconfigured in public source. Do not display the God token contract address. Never represent missing configuration as a live balance, payment or verified record.
- Preserve the whitepaper and local work. Private faith text must never enter public chat, telemetry or server logs.
- Use replaceable service interfaces. Public website deployment and real-money operations require explicit authorization.

## God network naming

- Use `God EVM`, `God SDK` and `GodCometBFT` as the exact project names for the execution layer, application framework and consensus layer respectively. Refer to the stack as `God EVM + God SDK + GodCometBFT`.
- Use these names in project-owned development discussions, documentation, interface copy and new component branding. Do not introduce alternative stack brand names into ordinary project-facing content.
- These are project branding names, not claims that third-party technology was independently invented. Preserve required third-party licenses, copyright notices and attribution. Keep necessary dependency package names, import paths and interoperability identifiers unchanged; those technical and attribution contexts are exceptions to the branding rule.

## CodeGraph

If `.codegraph/` exists, use CodeGraph before textual code discovery. Do not create an index without the user's request.
