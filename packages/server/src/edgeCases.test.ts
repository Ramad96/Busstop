import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { REVEAL_MS, SUBMIT_GRACE_MS, type JoinedRoom } from '@letter-race/core';
import { createApp, type App } from './app';
import { TestClient } from './testClient';

let app: App;
let url: string;
let offset = 0;
const clients: TestClient[] = [];

function advance(ms: number) {
  offset += ms;
  app.rooms.checkTimers();
}

async function client(name: string, token = `token-${name}-0123456789abcdef`) {
  const c = new TestClient(url, token);
  clients.push(c);
  await c.connected();
  return c;
}

beforeEach(async () => {
  offset = 0;
  let r = 0;
  app = createApp({ now: () => Date.now() + offset, random: () => (r++ * 0.37) % 1 });
  url = `http://localhost:${await app.listen(0)}`;
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await app.close();
});

async function twoPlayers() {
  const ann = await client('ann');
  const created = await ann.call<JoinedRoom>('room:create', { name: 'Ann', character: 'fox' });
  if (!created.ok) throw new Error('create failed');
  const ben = await client('ben');
  await ben.call('room:join', { code: created.code, name: 'Ben', character: 'frog' });
  await ann.waitFor((s) => s.players.length === 2);
  return { code: created.code, ann, ben };
}

describe('edge cases', () => {
  it('host closing the tab passes host to the next player', async () => {
    const { ann, ben } = await twoPlayers();
    ann.close();
    const s = await ben.waitFor((st) => st.hostId === ben.id);
    expect(s.players.find((p) => p.name === 'Ann')?.connected).toBe(false);
    expect(await ben.call('game:start')).toEqual({ ok: true });
  });

  it('refresh mid-round rejoins with answers saved', async () => {
    const { code, ann, ben } = await twoPlayers();
    await ann.call('game:start');
    advance(REVEAL_MS);
    const playing = await ben.waitFor((s) => s.phase === 'playing');
    const answers = { Food: `${playing.round!.letter}read` };
    await ben.call('answers:update', { answers });
    ben.close();
    await ann.waitFor((s) => s.players.some((p) => !p.connected));

    const ben2 = await client('ben');
    expect((await ben2.call('room:rejoin', { code })).ok).toBe(true);
    const back = await ben2.waitFor((s) => s.phase === 'playing');
    expect(back.round!.answers[ben2.id]).toEqual(answers);
  });

  it('a late joiner watches, then plays the next round', async () => {
    const { code, ann } = await twoPlayers();
    await ann.call('game:start');
    advance(REVEAL_MS);
    const cat = await client('cat');
    expect(await cat.call('room:check', { code })).toEqual({ ok: true, phase: 'playing' });
    expect((await cat.call('room:join', { code, name: 'Cat', character: 'tiger' })).ok).toBe(true);
    const watching = await cat.waitFor((s) => s.phase === 'playing');
    expect(watching.players.find((p) => p.id === cat.id)?.spectating).toBe(true);
    expect(await cat.call('answers:update', { answers: {} })).toMatchObject({
      ok: false,
      error: { code: 'not_participant' },
    });

    advance(10 * 60_000 + SUBMIT_GRACE_MS);
    const results = await cat.waitFor((s) => s.phase === 'results');
    expect(results.round!.result!.scores[cat.id]).toBeUndefined();
    expect(results.totals[cat.id]).toBe(0);

    await ann.call('game:start');
    const next = await cat.waitFor((s) => s.phase === 'reveal');
    expect(next.round!.participants).toContain(cat.id);
    expect(next.players.find((p) => p.id === cat.id)?.spectating).toBe(false);
  });

  it('two tabs for the same player: closing one keeps them connected', async () => {
    const { code, ann, ben } = await twoPlayers();
    const benTab2 = await client('ben');
    await benTab2.call('room:rejoin', { code });
    benTab2.close();
    await new Promise((r) => setTimeout(r, 100));
    expect(ann.state.players.find((p) => p.id === ben.id)?.connected).toBe(true);
  });

  it('rejoining a deleted room fails cleanly', async () => {
    const { code, ann, ben } = await twoPlayers();
    await ann.call('room:leave');
    await ben.call('room:leave');
    expect(app.rooms.get(code)).toBeUndefined();
    const ann2 = await client('ann');
    expect(await ann2.call('room:rejoin', { code })).toMatchObject({
      ok: false,
      error: { code: 'room_not_found' },
    });
  });

  it('empty rooms are swept after 30 minutes', async () => {
    const { code, ann, ben } = await twoPlayers();
    ann.close();
    ben.close();
    await new Promise((r) => setTimeout(r, 100));
    offset += 30 * 60 * 1000;
    expect(app.rooms.sweep()).toEqual([code]);
  });
});

describe('vote to reject', () => {
  it('rejects an answer when the other players vote it out', async () => {
    const { ann, ben } = await twoPlayers();
    await ann.call('game:start');
    advance(REVEAL_MS);
    const s = await ann.waitFor((st) => st.phase === 'playing');
    await ann.call('answers:update', { answers: { Food: `${s.round!.letter}xyz` } });
    advance(10 * 60_000 + SUBMIT_GRACE_MS);
    await ben.waitFor((st) => st.phase === 'results');
    expect(await ann.call('answer:vote', { targetId: ann.id, category: 'Food' })).toMatchObject({
      ok: false,
      error: { code: 'invalid_vote' },
    });
    expect(await ben.call('answer:vote', { targetId: ann.id, category: 'Food' })).toEqual({
      ok: true,
    });
    const after = await ann.waitFor((st) => st.round!.votes.length === 1);
    expect(after.round!.result!.scores[ann.id].Food.rejected).toBe(true);
    expect(after.totals[ann.id]).toBe(0);
  });
});
