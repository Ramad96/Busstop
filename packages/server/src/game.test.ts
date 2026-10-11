import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REVEAL_MS, SUBMIT_GRACE_MS, type JoinedRoom } from '@letter-race/core';
import { createApp, type App } from './app';
import { TestClient } from './testClient';

let app: App;
let url: string;
let offset = 0;
const clients: TestClient[] = [];

/** Moves the server clock forward and runs any timers that are now due. */
function advance(ms: number) {
  offset += ms;
  app.rooms.checkTimers();
}

async function client(name: string): Promise<TestClient> {
  const c = new TestClient(url, `token-${name}-0123456789abcdef`);
  clients.push(c);
  await c.connected();
  return c;
}

beforeEach(async () => {
  offset = 0;
  let r = 0;
  app = createApp({
    now: () => Date.now() + offset,
    // Deterministic: room codes and letters come out the same each run.
    random: () => (r++ * 0.37) % 1,
  });
  const port = await app.listen(0);
  url = `http://localhost:${port}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await app.close();
});

async function lobbyOfThree() {
  const ann = await client('ann');
  const created = await ann.call<JoinedRoom>('room:create', { name: 'Ann', character: 'fox' });
  if (!created.ok) throw new Error(created.error.message);
  const { code } = created;
  const ben = await client('ben');
  const cat = await client('cat');
  expect((await ben.call('room:join', { code, name: 'Ben', character: 'frog' })).ok).toBe(true);
  expect(
    (await cat.call('room:join', { code: code.toLowerCase(), name: 'Cat', character: 'tiger' })).ok,
  ).toBe(true);
  await ann.waitFor((s) => s.players.length === 3);
  return { code, ann, ben, cat };
}

describe('server', () => {
  it('runs a full game with 3 players', async () => {
    const { code, ann, ben, cat } = await lobbyOfThree();
    expect(code).toMatch(/^[A-HJKMNP-Z]{4}$/);
    expect(ann.state.hostId).toBe(ann.id);

    // Duplicate names are rejected.
    const dupe = await client('dupe');
    const dupeJoin = await dupe.call('room:join', { code, name: 'ann', character: 'fox' });
    expect(dupeJoin).toMatchObject({ ok: false, error: { code: 'name_taken' } });

    // Host-only actions.
    expect(await ben.call('game:start')).toMatchObject({ ok: false, error: { code: 'not_host' } });
    expect(
      await ann.call('settings:update', {
        settings: { categories: ['Food', 'Country'], roundSeconds: 30 },
      }),
    ).toEqual({ ok: true });
    await cat.waitFor((s) => s.settings.roundSeconds === 30);

    // Start: every device sees the same letter and end time.
    expect(await ann.call('game:start')).toEqual({ ok: true });
    const states = await Promise.all(
      [ann, ben, cat].map((c) => c.waitFor((s) => s.phase === 'reveal')),
    );
    const letter = states[0].round!.letter;
    expect(states.map((s) => s.round!.letter)).toEqual([letter, letter, letter]);
    expect(new Set(states.map((s) => s.round!.endsAt)).size).toBe(1);

    advance(REVEAL_MS);
    await Promise.all([ann, ben, cat].map((c) => c.waitFor((s) => s.phase === 'playing')));

    // Answers: Ann and Ben share a food, Cat leaves Country blank.
    const L = letter;
    const answers = {
      ann: { Food: `${L}food`, Country: `${L}land` },
      ben: { Food: `${L}FOOD`, Country: `${L}stan` },
      cat: { Food: `${L}other`, Country: '' },
    };
    await ann.call('answers:update', { answers: answers.ann });
    await cat.call('answers:update', { answers: answers.cat });

    // Other players' answers are hidden during the round.
    await ann.waitFor((s) => Object.keys(s.round!.answers).length === 1);
    expect(Object.keys(ann.state.round!.answers)).toEqual([ann.id]);

    // Stop the clock is locked until all answers are valid.
    expect(await cat.call('clock:stop', { answers: answers.cat })).toMatchObject({
      ok: false,
      error: { code: 'answers_incomplete' },
    });
    const endsBefore = ann.state.round!.endsAt;
    expect(await ben.call('clock:stop', { answers: answers.ben })).toEqual({ ok: true });
    const stopped = await ann.waitFor((s) => s.round!.endsAt < endsBefore);
    expect(stopped.round!.stoppedBy).toBe(ben.id);

    // Time runs out: everyone auto-submits and results come back.
    advance(stopped.round!.endsAt - (Date.now() + offset));
    await Promise.all([ann, ben, cat].map((c) => c.waitFor((s) => s.phase !== 'playing')));
    await Promise.all([
      ann.call('answers:submit', { answers: answers.ann }),
      ben.call('answers:submit', { answers: answers.ben }),
      cat.call('answers:submit', { answers: answers.cat }),
    ]);
    const results = await Promise.all(
      [ann, ben, cat].map((c) => c.waitFor((s) => s.phase === 'results')),
    );
    expect(results[0].round!.result!.roundTotals).toEqual({
      [ann.id]: 15,
      [ben.id]: 15,
      [cat.id]: 10,
    });
    expect(results[2].totals).toEqual(results[0].totals);
    expect(Object.keys(results[1].round!.answers)).toHaveLength(3);

    // Play again keeps players and totals.
    expect(await ann.call('game:start')).toEqual({ ok: true });
    const round2 = await cat.waitFor((s) => s.phase === 'reveal');
    expect(round2.round!.number).toBe(2);
    expect(round2.round!.letter).not.toBe(letter);
    expect(round2.totals[ann.id]).toBe(15);
  });

  it('scores after the grace period even if a player never submits', async () => {
    const { ann, ben } = await lobbyOfThree();
    await ann.call('game:start');
    advance(REVEAL_MS);
    const s = await ben.waitFor((st) => st.phase === 'playing');
    const L = s.round!.letter;
    await ben.call('answers:update', { answers: { Food: `${L}x` } });
    advance(s.round!.endsAt - (Date.now() + offset));
    await ann.waitFor((st) => st.phase === 'scoring');
    advance(SUBMIT_GRACE_MS);
    const results = await ann.waitFor((st) => st.phase === 'results');
    expect(results.round!.result!.roundTotals[ben.id]).toBe(10);
  });

  it('lets a player reconnect with the same token', async () => {
    const { code, ann, ben } = await lobbyOfThree();
    const benId = ben.id;
    ben.close();
    const disconnected = await ann.waitFor(
      (s) => s.players.find((p) => p.id === benId)?.connected === false,
    );
    expect(disconnected.players).toHaveLength(3);

    const ben2 = new TestClient(url, ben.token);
    clients.push(ben2);
    await ben2.connected();
    const rejoined = await ben2.call<JoinedRoom>('room:rejoin', { code });
    expect(rejoined).toMatchObject({ ok: true, code, playerId: benId });
    await ann.waitFor((s) => s.players.find((p) => p.id === benId)?.connected === true);
    expect(ben2.state.players).toHaveLength(3);
  });

  it('rejects unknown codes, strangers and missing tokens', async () => {
    const ann = await client('ann');
    expect(
      await ann.call('room:join', { code: 'ZZZZ', name: 'A', character: 'fox' }),
    ).toMatchObject({ ok: false, error: { code: 'room_not_found' } });
    expect(await ann.call('room:check', { code: 'ZZZZ' })).toMatchObject({ ok: false });
    expect(await ann.call('game:start')).toMatchObject({
      ok: false,
      error: { code: 'not_in_room' },
    });
    const created = await ann.call<JoinedRoom>('room:create', { name: 'Ann', character: 'fox' });
    const stranger = await client('stranger');
    expect(await stranger.call('room:rejoin', { code: created.ok && created.code })).toMatchObject({
      ok: false,
      error: { code: 'not_in_game' },
    });
    expect(
      await stranger.call('room:join', { code: created.ok && created.code, name: 'X' }),
    ).toMatchObject({
      ok: false,
      error: { code: 'bad_request' },
    });

    const noToken = new TestClient(url, '');
    clients.push(noToken);
    await expect(noToken.connected()).rejects.toThrow();
  });

  it('moves host on when the host leaves', async () => {
    const { ann, ben, cat } = await lobbyOfThree();
    expect(await ann.call('room:leave')).toEqual({ ok: true });
    const s = await cat.waitFor((st) => st.players.length === 2);
    expect(s.hostId).toBe(ben.id);
  });
});
