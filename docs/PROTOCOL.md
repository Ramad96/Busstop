# Letter Race – Client/Server Protocol

Transport: [Socket.IO](https://socket.io) v4 (official clients exist for JS and Swift).
TypeScript types for every message live in `packages/core/src/protocol.ts`.

The server is the referee: it owns the timer, the letter and the scores. Clients only
display what the server sends and ask it to do things.

## Connecting

Connect with a secret player token in the handshake `auth`:

```js
io(SERVER_URL, { auth: { token } });
```

- `token`: a random string, 16–128 characters (e.g. a UUID). The client generates it once
  and saves it (browser: `localStorage`) so a refresh or reconnect is the same player.
- The server derives the public `playerId` from the token (`sha256(token)`, first 16 hex
  chars). Player ids are visible to everyone; the token never leaves the device.
- Connections without a valid token are refused (`connect_error`).

## Requests (client → server)

Every request takes an optional acknowledgement callback as its last argument. The ack is
always one of:

```ts
{ ok: true, ...data }
{ ok: false, error: { code: ErrorCode, message: string } }
```

`message` is human-readable and safe to show to players.

| Event             | Payload                                 | Ack data (on success) | Who / when                                         |
| ----------------- | --------------------------------------- | --------------------- | -------------------------------------------------- |
| `time:ping`       | _(none)_                                | `serverNow: number`   | Anyone, any time. Used for clock sync (see below). |
| `room:check`      | `{ code }`                              | `{ phase }`           | Anyone. Checks a code exists before joining.       |
| `room:create`     | `{ name, character }`                   | `{ code, playerId }`  | Anyone. Creator becomes host.                      |
| `room:join`       | `{ code, name, character }`             | `{ code, playerId }`  | Anyone. Mid-round joiners watch until next round.  |
| `room:rejoin`     | `{ code }`                              | `{ code, playerId }`  | A player already in the room (after reconnect).    |
| `room:leave`      | _(none)_                                | `{}`                  | Player in a room. Removes them for good.           |
| `settings:update` | `{ settings: Partial<Settings> }`       | `{}`                  | Host, in `lobby` or `results`.                     |
| `game:start`      | _(none)_                                | `{}`                  | Host, in `lobby` or `results` (= next round).      |
| `game:end`        | _(none)_                                | `{}`                  | Host, in `results`. Back to lobby, scores reset.   |
| `answers:update`  | `{ answers: Record<category, string> }` | `{}`                  | Participant, in `playing`. Saves a draft.          |
| `answers:submit`  | `{ answers }`                           | `{}`                  | Participant, in `playing` or `scoring`. Final.     |
| `clock:stop`      | `{ answers }`                           | `{}`                  | Participant, in `playing`, all answers valid.      |

Notes:

- `code` is case-insensitive; non-letters are ignored.
- `character` is one of `fox, frog, panda, unicorn, octopus, tiger, penguin, alien`.
- `name` is 1–16 characters, unique in the room (ignoring case).
- `Settings` = `{ roundSeconds: 30–300, categories: string[] (1–12, each 1–24 chars), includeHardLetters: boolean }`.
- Answers for unknown categories are dropped; answers are trimmed and capped at 40 chars.
- `answers:update` should be sent (throttled) as the player types, so a refresh mid-round
  keeps their answers and the server has them even if the final submit is lost.
- `clock:stop` sends the player's answers too; the server checks they're all valid.

## Broadcasts (server → client)

| Event   | Payload                                                  | When                                           |
| ------- | -------------------------------------------------------- | ---------------------------------------------- |
| `state` | `{ state: GameState, serverNow: number, you: playerId }` | After every change to the room (incl. timers). |

`state` is the whole game state (see `GameState` in `packages/core/src/types.ts`), filtered
for the receiving player: until the `results` phase, `round.answers` contains only that
player's own answers.

```ts
GameState {
  code: string;
  phase: 'lobby' | 'reveal' | 'playing' | 'scoring' | 'results';
  hostId: string | null;
  players: { id, name, character, connected, spectating }[];
  settings: Settings;
  round: null | {
    number, letter, categories, participants,
    revealEndsAt,   // epoch ms (server clock): letter animation ends, typing starts
    endsAt,         // epoch ms (server clock): answers lock
    stoppedBy,      // playerId who pressed Stop the clock, or null
    answers,        // Record<playerId, Record<category, string>>
    submitted,      // playerIds whose final answers arrived
    result: null | { letter, categories, scores, roundTotals },
  };
  totals: Record<playerId, number>;
  usedLetters: string[];
}
```

## Phases and timing

```
lobby ──start──▶ reveal ──(revealEndsAt)──▶ playing ──(endsAt)──▶ scoring ──▶ results
  ▲                                                                            │
  └──────────────────────────── game:end ◀─────────────────────────────────────┤
                         reveal ◀── game:start (next round, totals kept) ◀──────┘
```

- `reveal` lasts 3 s (letter-from-a-hat animation).
- `playing` lasts `settings.roundSeconds`. `clock:stop` can bring `endsAt` forward to
  10 s from now (never later).
- `scoring`: answers are locked. Clients send `answers:submit` straight away. The server
  scores as soon as every connected participant has submitted, or after a 2 s grace period.
- The server never sends a ticking number. Clients compute the countdown themselves from
  `endsAt` using a clock offset:

### Clock sync

```
t0 = Date.now(); emit('time:ping', (serverNow) => {
  t1 = Date.now();
  offset = serverNow + (t1 - t0) / 2 - t1;   // add to Date.now() to get server time
});
```

Take a few samples and keep the one with the smallest round trip. Remaining time is
`endsAt - (Date.now() + offset)`.

## Error codes

| Code                 | Meaning                                  |
| -------------------- | ---------------------------------------- |
| `bad_request`        | Payload missing or the wrong type        |
| `room_not_found`     | No room with that code                   |
| `not_in_room`        | This connection hasn't joined a room     |
| `not_in_game`        | You aren't a player in this room         |
| `already_joined`     | You're already in this room              |
| `not_host`           | Only the host can do that                |
| `wrong_phase`        | Not allowed in the current phase         |
| `name_invalid`       | Name blank or too long                   |
| `name_taken`         | Someone in the room has that name        |
| `character_invalid`  | Unknown character                        |
| `room_full`          | Room has 12 players                      |
| `invalid_settings`   | Settings out of range                    |
| `answers_incomplete` | Stop the clock needs every answer valid  |
| `already_submitted`  | Final answers were already sent          |
| `not_participant`    | You're watching this round (joined late) |

## Reconnecting

1. Reconnect with the same `token`.
2. Emit `room:rejoin { code }` (the client remembers the last room code).
3. The server marks you connected and sends `state`, including your saved answers.

If the host disconnects, the next connected player (in join order) becomes host.

## Edge cases

- **Host leaves or disconnects:** host passes to the next connected player in join order.
  The old host does not get it back when they return.
- **Refresh mid-round:** drafts sent with `answers:update` are kept on the server and come
  back in `state.round.answers[you]` after `room:rejoin`.
- **Join mid-round:** the player is added with `spectating: true`, isn't in
  `round.participants`, and gets `not_participant` for answer events. They play from the
  next `game:start`. Joining during `results` makes you a normal player straight away.
- **Several tabs, one player:** the player only shows as disconnected when their last tab
  closes.
- **Cleanup:** a room with nobody connected is deleted after 30 minutes; a room whose last
  player sends `room:leave` is deleted immediately. `room:rejoin` then fails with
  `room_not_found` and the client should go back to the home screen.
- **Removed from a game:** if a `state` arrives that doesn't list `you` in `players`, the
  client should treat itself as out of the game.
