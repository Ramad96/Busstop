# Busstop

A real-time party word game: everyone gets the same letter, then races to fill in every
category. First to finish shouts BUSSTOP! and everyone else has 10 seconds left.

**Play:** https://busstop.amanahdigital.co.uk

- Rules: [docs/RULES.md](docs/RULES.md)
- Client/server messages: [docs/PROTOCOL.md](docs/PROTOCOL.md)
- Deploying: [docs/DEPLOY.md](docs/DEPLOY.md)
- Working on the code: [AGENTS.md](AGENTS.md)

## Getting started

```sh
pnpm install
pnpm dev     # server on :3001, web on :5173 (phones on the same Wi-Fi can join)
pnpm test
pnpm check   # lint, typecheck, tests, core purity audit, build
```

`pnpm --filter @letter-race/server simulate` plays a 3-player round against a running server.

## Packages

- `packages/core` – pure TypeScript game rules (no DOM, no Node, no clocks or randomness)
- `packages/server` – Node + Socket.IO referee: rooms, timers, scoring via core
- `packages/web` – React + Vite mobile-first client
