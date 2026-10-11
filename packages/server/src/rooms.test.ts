import { afterEach, describe, expect, it } from 'vitest';
import { REVEAL_MS, SUBMIT_GRACE_MS } from '@letter-race/core';
import { EMPTY_ROOM_TTL_MS, RoomManager } from './rooms';

let clock = 0;
let manager: RoomManager;
const deleted: string[] = [];

function setup() {
  clock = 1_000_000;
  deleted.length = 0;
  let r = 0;
  manager = new RoomManager({
    now: () => clock,
    random: () => (r++ * 0.37) % 1,
    onDelete: (code) => deleted.push(code),
  });
  const { code } = manager.create({ id: 'a', name: 'Ann', character: 'fox' });
  manager.join(code, { id: 'b', name: 'Ben', character: 'frog' });
  return code;
}

afterEach(() => manager.dispose());

describe('RoomManager edge cases', () => {
  it('deletes a room 30 minutes after everyone disconnects', () => {
    const code = setup();
    manager.disconnect(code, 'a');
    manager.disconnect(code, 'b');
    clock += EMPTY_ROOM_TTL_MS - 1;
    expect(manager.sweep()).toEqual([]);
    clock += 1;
    expect(manager.sweep()).toEqual([code]);
    expect(manager.get(code)).toBeUndefined();
    expect(deleted).toEqual([code]);
  });

  it('keeps a room if someone comes back before 30 minutes', () => {
    const code = setup();
    manager.disconnect(code, 'a');
    manager.disconnect(code, 'b');
    clock += EMPTY_ROOM_TTL_MS - 1000;
    manager.reconnect(code, 'b');
    clock += 2000;
    expect(manager.sweep()).toEqual([]);
    expect(manager.get(code)).toBeDefined();
  });

  it('never deletes a room while someone is connected', () => {
    const code = setup();
    manager.disconnect(code, 'a');
    clock += EMPTY_ROOM_TTL_MS * 3;
    expect(manager.sweep()).toEqual([]);
  });

  it('deletes a room straight away when the last player leaves', () => {
    const code = setup();
    manager.dispatch(code, 'a', { type: 'leave' });
    manager.dispatch(code, 'b', { type: 'leave' });
    expect(manager.get(code)).toBeUndefined();
  });

  it('catches up on overdue timers before handling an action', () => {
    const code = setup();
    manager.dispatch(code, 'a', { type: 'start' });
    clock += REVEAL_MS;
    // No timer fired yet (fake clock), but the answer still lands in "playing".
    expect(() =>
      manager.dispatch(code, 'b', { type: 'updateAnswers', answers: { Food: 'x' } }),
    ).not.toThrow();
    expect(manager.require(code).state.phase).toBe('playing');
  });

  it('hands host on when the host disconnects mid-round, and the new host can carry on', () => {
    const code = setup();
    manager.dispatch(code, 'a', { type: 'start' });
    manager.disconnect(code, 'a');
    expect(manager.require(code).state.hostId).toBe('b');
    clock += 10 * 60_000 + SUBMIT_GRACE_MS;
    manager.checkTimers();
    expect(manager.require(code).state.phase).toBe('results');
    manager.dispatch(code, 'b', { type: 'start' });
    expect(manager.require(code).state.phase).toBe('reveal');
  });

  it('treats joining again with the same id as a reconnect', () => {
    const code = setup();
    manager.disconnect(code, 'b');
    manager.join(code, { id: 'b', name: 'Ben', character: 'frog' });
    const state = manager.require(code).state;
    expect(state.players).toHaveLength(2);
    expect(state.players[1].connected).toBe(true);
  });
});
