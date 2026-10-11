# Agent instructions

- Read docs/RULES.md and docs/PROTOCOL.md before coding.
- All game rules go in packages/core. No UI or network code there.
- core never uses Date.now(), Math.random(), window or Node APIs.
- The server is the source of truth for timer, letter and scores.
- Write tests for every rule change. Run them before finishing.
- Update docs/PROTOCOL.md whenever an event changes.
- Keep changes small. Explain what you changed in 3 bullets.

## Commands

- `pnpm install` – install everything
- `pnpm dev` – run server (:3001) and web (:5173) together
- `pnpm test` – run all unit/integration tests
- `pnpm typecheck` / `pnpm lint` / `pnpm build`
