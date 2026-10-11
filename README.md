# Letter Race

A real-time party word game: everyone gets the same letter, fill in a name, country, food… before the clock runs out.

See [docs/RULES.md](docs/RULES.md) for the rules and [AGENTS.md](AGENTS.md) for how the code is organised.

## Getting started

```sh
pnpm install
pnpm dev     # server on :3001, web on :5173
pnpm test
```

## Packages

- `packages/core` – pure TypeScript game rules (no DOM, no Node, no clocks or randomness)
- `packages/server` – Node + Socket.IO referee
- `packages/web` – React + Vite client
