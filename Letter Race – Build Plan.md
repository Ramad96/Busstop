# Letter Race – Build Plan

Oct 11, 2026 · @Ramiz

## Overview

Build in 9 small phases. Each one ends with something you can test before moving on.

**The big idea for iOS later:** all game rules live in one shared `core` package with no browser code. The web app and the server just call it. When you build the iOS app, you either reuse the same server (easiest) or port `core` to Swift using the same tests as a checklist.

### Recommended stack

| Part       | Tool                                                  | Why                                                     |
| ---------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Language   | TypeScript                                            | Types make the rules easy to port to Swift              |
| Game rules | `packages/core` (pure TS)                             | No UI, no network, fully unit-tested                    |
| Server     | Node + Socket.IO                                      | Real-time rooms; Socket.IO has an official Swift client |
| Web client | React + Vite                                          | Fast to build, easy for AI agents                       |
| Tests      | Vitest                                                | Simple and fast                                         |
| Hosting    | Render or Fly.io (server), Vercel or Netlify (client) | Free tiers work for testing                             |

### Folder structure

```
letter-race/
  packages/
    core/      # rules: types, scoring, letters, validation, state machine
    server/    # rooms, timer, sockets (the referee)
    web/       # React UI
  docs/
    RULES.md     # game rules (copy from this doc)
    PROTOCOL.md  # every message between client and server
  AGENTS.md    # standing instructions for the AI agent
```

**Golden rule:** the server is the referee. It owns the timer, the letter and the scores. Phones only display what the server says. This stops cheating and keeps every device in sync.

## Game rules (the spec)

Give this section to the agent as `docs/RULES.md`.

### Flow

1. Host creates a game and gets a 4-letter code (no confusing letters like O, I, L).
2. Players join with the code, pick a name and a character.
3. Host changes settings in the lobby: timer length and which categories are on.
4. Host presses **Start**. Every device shows the letter coming out of a hat.
5. Players fill in one answer per category, each starting with that letter.
6. When all fields are filled, **Stop the clock** unlocks. Pressing it drops the timer to 10 seconds (only if more than 10 are left).
7. At 0, all answers lock and are sent in automatically.
8. Scores show on every device. Host can start another round.

### Defaults

- Timer: 2 minutes
- Categories: Boy's name, Girl's name, Country, Food, Place, Brand
- Letters: A–Z, skipping hard ones (Q, U, V, X, Y, Z) by default — host can turn them back on

### Scoring (per category)

| How many players gave the same answer | Points each |
| ------------------------------------- | ----------- |
| 1 (unique)                            | 10          |
| 2                                     | 5           |
| 3                                     | 3           |
| 4 or more                             | 2           |
| Blank or wrong letter                 | 0           |

### Assumptions

- Confirmed: 4 or more players sharing an answer = 2 points each.
- Answers match if they are the same after ignoring capitals, spaces, accents and "the" (so "The Gap" = "gap").
- The app checks the first letter only. It can't tell if "Bxyz" is a real food. A "vote to reject" step is an optional add-on in Phase 7.

## The phases

Do one phase at a time. Tick it off only when "Done when" is true.

### Phase 0 — Set up the project

- [x] Create the monorepo with `core`, `server`, `web` (pnpm workspaces)
- [x] Add TypeScript, Vitest, ESLint, Prettier
- [x] Add `docs/RULES.md` (rules section above) and `AGENTS.md`

**Done when:** `pnpm test` and `pnpm dev` both run without errors.

> **Prompt:** Set up a pnpm TypeScript monorepo with packages core, server and web. core is pure TypeScript with no DOM or Node APIs. server uses Node + Socket.IO. web uses React + Vite. Add Vitest. Read docs/RULES.md and AGENTS.md before writing code.

### Phase 1 — Game rules in `core` (most important)

- [x] Types: `Player`, `Settings`, `Round`, `Answers`, `GamePhase` (lobby → reveal → playing → scoring → results)
- [x] `pickLetter(settings, random)` — pass the random function in so tests are repeatable
- [x] `normaliseAnswer()` and `isValidAnswer(answer, letter)`
- [x] `scoreRound(allAnswers)` → points per player per category
- [x] `applyStopClock(endsAt, now)` → new end time
- [x] A state machine: `reduce(state, action) → newState`

**Done when:** 30+ unit tests pass, covering every scoring row in the table.

> **Prompt:** In packages/core, implement the game rules from docs/RULES.md as pure functions with no side effects. No Date.now() or Math.random() inside — pass time and randomness in. Write the state machine as reduce(state, action). Write Vitest tests for every rule, especially scoring edge cases.

### Phase 2 — Server (the referee)

- [x] Create room → unique code, creator is host
- [x] Join room with name + character; reject duplicate names
- [x] Host-only actions: update settings, start, play again
- [x] Timer: server sends `endsAt` timestamp, not a ticking number
- [x] Receive answers, score with `core`, broadcast results
- [x] Handle reconnects (same player ID saved in browser)
- [x] Write `docs/PROTOCOL.md` listing every event and its data

**Done when:** a test script can run a full game with 3 fake players.

> **Prompt:** Build the Socket.IO server in packages/server. Keep all rules in core — the server only stores rooms, runs the timer and calls core. Server is the source of truth. Document every event in docs/PROTOCOL.md. Add an integration test that simulates 3 players playing a full round.

### Phase 3 — Lobby screens

- [x] Home: **Host game** or **Join game**
- [x] Join: enter code
- [x] Pick name + character (6–8 simple emoji or coloured shapes)
- [x] Waiting room: player list, code shown big, share link
- [x] Host only: settings panel + **Start** button

**Done when:** you can join from your phone and laptop and see each other in the lobby.

> **Prompt:** Build the lobby screens in packages/web. Mobile-first. Connect to the server using the events in docs/PROTOCOL.md. Put all socket code in one file (src/net/socket.ts) so screens never call Socket.IO directly.

### Phase 4 — Playing the round

- [x] Letter-from-a-hat animation (\~3 seconds, same on all devices)
- [x] One input per category, with a tick when the first letter is right
- [x] Countdown worked out from server `endsAt`
- [x] **Stop the clock** button, locked until every field is valid
- [x] Auto-submit when time hits 0

**Done when:** two devices play a full round and their timers match within 1 second.

> **Prompt:** Build the round screen. Show the letter reveal animation, then the answer form. Calculate the countdown from the server's endsAt. Use isValidAnswer from core to enable the Stop the clock button only when all fields are valid. Auto-submit at zero.

### Phase 5 — Results

- [ ] Table: each category, each player's answer and points
- [ ] Highlight unique answers vs shared ones
- [ ] Running total and winner
- [ ] Host: **Next round** or **End game**

**Done when:** scores on screen match what you work out by hand.

> **Prompt:** Build the results screen. Show answers by category with points, mark shared answers, show totals and the winner. Host can start the next round, which keeps players and totals.

### Phase 6 — Edge cases

- [ ] Host leaves → next player becomes host
- [ ] Player refreshes mid-round → rejoins with answers saved
- [ ] Join a game in progress → watch until next round
- [ ] Empty rooms deleted after 30 minutes

**Done when:** you can refresh, close tabs and rejoin without breaking a game.

> **Prompt:** Handle these edge cases: host leaves, player refresh mid-round, late joiners, and cleaning up empty rooms. Add tests for each.

### Phase 7 — Polish (optional extras)

- [ ] Sounds and haptics (tick in last 10 seconds)
- [ ] Confetti for the winner
- [ ] Vote to reject silly answers
- [ ] Custom categories

**Done when:** it feels fun to play with friends.

### Phase 8 — Go live and prep for iOS

- [ ] Deploy server and web app
- [ ] Check `PROTOCOL.md` is complete and up to date
- [ ] Make sure `core` has zero browser imports

**Done when:** friends can play from their own phones using a public link.

> **Prompt:** Deploy the server to Render and the web app to Vercel, using environment variables for the server URL. Then audit packages/core for any browser or Node imports, and check docs/PROTOCOL.md matches the server code.

## Working with the AI agent

Put this in `AGENTS.md` so the agent follows it every time:

```
- Read docs/RULES.md and docs/PROTOCOL.md before coding.
- All game rules go in packages/core. No UI or network code there.
- core never uses Date.now(), Math.random(), window or Node APIs.
- The server is the source of truth for timer, letter and scores.
- Write tests for every rule change. Run them before finishing.
- Update docs/PROTOCOL.md whenever an event changes.
- Keep changes small. Explain what you changed in 3 bullets.
```

**Your habits:**

- One phase per chat. Start a fresh chat for each phase.
- Commit to git after every phase that works.
- If the agent gets stuck twice, paste the error and ask it to explain before fixing.
- Test on a real phone from Phase 3 onwards.
