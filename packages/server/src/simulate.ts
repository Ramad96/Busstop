/**
 * Plays one real-time round against a running server with 3 fake players.
 * Usage: pnpm --filter @busstop/server simulate [url]
 */
import { randomUUID } from 'node:crypto';
import type { JoinedRoom } from '@busstop/core';
import { TestClient } from './testClient';

const url = process.argv[2] ?? process.env.SERVER_URL ?? 'http://localhost:3001';

async function main() {
  const players = ['Ann', 'Ben', 'Cat'].map((name) => ({
    name,
    client: new TestClient(url, randomUUID()),
  }));
  await Promise.all(players.map((p) => p.client.connected()));
  const [host, ...rest] = players;

  const created = await host.client.call<JoinedRoom>('room:create', {
    name: host.name,
    character: 'fox',
  });
  if (!created.ok) throw new Error(created.error.message);
  console.log(`Room ${created.code} created`);
  for (const p of rest) {
    const joined = await p.client.call('room:join', {
      code: created.code,
      name: p.name,
      character: 'frog',
    });
    if (!joined.ok) throw new Error(joined.error.message);
  }
  await host.client.call('settings:update', { settings: { roundSeconds: 30 } });
  await host.client.call('game:start');

  const playing = await host.client.waitFor((s) => s.phase === 'playing', 10_000);
  const letter = playing.round!.letter;
  console.log(`Letter is ${letter}; categories: ${playing.round!.categories.join(', ')}`);

  const answersFor = (i: number) =>
    Object.fromEntries(
      playing.round!.categories.map((c, j) => [c, `${letter}${(i + j) % 2 ? 'aa' : 'bb'}`]),
    );
  for (const [i, p] of players.entries()) {
    await p.client.call('answers:update', { answers: answersFor(i) });
  }
  const stop = await rest[0].client.call('clock:stop', { answers: answersFor(1) });
  console.log(`Stop the clock: ${stop.ok ? 'ok' : JSON.stringify(stop)}`);

  await host.client.waitFor((s) => s.phase !== 'playing', 15_000);
  await Promise.all(
    players.map((p, i) => p.client.call('answers:submit', { answers: answersFor(i) })),
  );
  const results = await host.client.waitFor((s) => s.phase === 'results', 5000);
  for (const p of results.players) console.log(`${p.name}: ${results.totals[p.id]} points`);
  for (const p of players) p.client.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
