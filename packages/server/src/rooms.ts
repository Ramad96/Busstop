import {
  createGame,
  GameError,
  generateRoomCode,
  nextDeadline,
  normaliseRoomCode,
  reduce,
  type Action,
  type CharacterId,
  type ErrorCode,
  type GameState,
  type PlayerId,
  type RandomFn,
} from '@letter-race/core';

export class RoomError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'RoomError';
  }
}

/** Rooms with nobody connected are deleted after this long. */
export const EMPTY_ROOM_TTL_MS = 30 * 60 * 1000;

export interface Room {
  state: GameState;
  timer: ReturnType<typeof setTimeout> | null;
  /** When the last connected player left, or null while someone is connected. */
  emptySince: number | null;
}

export interface RoomManagerOptions {
  now?: () => number;
  random?: RandomFn;
  /** Called after a room's state changes, so the socket layer can broadcast. */
  onChange?: (code: string, state: GameState) => void;
  /** Called after a room is deleted. */
  onDelete?: (code: string) => void;
}

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** An action from a player; the server fills in who sent it, the time and randomness. */
export type PlayerAction = DistributiveOmit<
  Exclude<Action, { type: 'tick' | 'join' | 'reconnect' | 'disconnect' }>,
  'playerId' | 'now' | 'random'
>;

/**
 * Stores rooms, runs timers and calls core. No socket code here so it's easy to test.
 */
export class RoomManager {
  readonly rooms = new Map<string, Room>();
  private readonly now: () => number;
  private readonly random: RandomFn;
  private readonly onChange: NonNullable<RoomManagerOptions['onChange']>;
  private readonly onDelete: NonNullable<RoomManagerOptions['onDelete']>;

  constructor(options: RoomManagerOptions = {}) {
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.onChange = options.onChange ?? (() => {});
    this.onDelete = options.onDelete ?? (() => {});
  }

  get(code: string): Room | undefined {
    return this.rooms.get(normaliseRoomCode(code));
  }

  require(code: string): Room {
    const room = this.get(code);
    if (!room) throw new RoomError('room_not_found', 'No game with that code');
    return room;
  }

  create(host: { id: PlayerId; name: string; character: CharacterId }): GameState {
    const code = generateRoomCode(this.random, this.rooms.keys());
    const state = createGame(code, host);
    this.rooms.set(code, { state, timer: null, emptySince: null });
    this.onChange(code, state);
    return state;
  }

  join(code: string, player: { id: PlayerId; name: string; character: CharacterId }): GameState {
    const room = this.require(code);
    // Joining again with the same id (e.g. a refresh on the join screen) is just a reconnect.
    if (room.state.players.some((p) => p.id === player.id)) return this.reconnect(code, player.id);
    return this.apply(room, { type: 'join', playerId: player.id, ...player });
  }

  reconnect(code: string, playerId: PlayerId): GameState {
    const room = this.require(code);
    return this.apply(room, { type: 'reconnect', playerId });
  }

  disconnect(code: string, playerId: PlayerId): void {
    const room = this.get(code);
    if (!room || !room.state.players.some((p) => p.id === playerId)) return;
    this.apply(room, { type: 'disconnect', playerId });
  }

  dispatch(code: string, playerId: PlayerId, action: PlayerAction): GameState {
    const room = this.require(code);
    const now = this.now();
    let full: Action;
    if (action.type === 'start') full = { ...action, playerId, now, random: this.random };
    else if (action.type === 'stopClock') full = { ...action, playerId, now };
    else full = { ...action, playerId } as Action;
    // Catch up on any due timer first so actions never land in a stale phase.
    this.tick(room);
    return this.apply(room, full);
  }

  /** Runs any due timers. The real server calls this from setTimeout; tests call it directly. */
  checkTimers(): void {
    for (const room of this.rooms.values()) this.tick(room);
  }

  /** Deletes rooms that have had nobody connected for 30 minutes, or have no players at all. */
  sweep(): string[] {
    const now = this.now();
    const deleted: string[] = [];
    for (const [code, room] of this.rooms) {
      const abandoned =
        room.state.players.length === 0 ||
        (room.emptySince !== null && now - room.emptySince >= EMPTY_ROOM_TTL_MS);
      if (abandoned) {
        this.delete(code);
        deleted.push(code);
      }
    }
    return deleted;
  }

  delete(code: string): void {
    const room = this.rooms.get(code);
    if (!room) return;
    if (room.timer) clearTimeout(room.timer);
    this.rooms.delete(code);
    this.onDelete(code);
  }

  /** Stops every timer (used when shutting down). */
  dispose(): void {
    for (const room of this.rooms.values()) if (room.timer) clearTimeout(room.timer);
  }

  private tick(room: Room): void {
    const deadline = nextDeadline(room.state);
    if (deadline !== null && this.now() >= deadline) {
      this.apply(room, { type: 'tick', now: this.now() });
    }
  }

  private apply(room: Room, action: Action): GameState {
    let next: GameState;
    try {
      next = reduce(room.state, action);
    } catch (e) {
      if (e instanceof GameError) throw new RoomError(e.code, e.message);
      throw e;
    }
    if (next === room.state) return next;
    room.state = next;
    const anyoneConnected = next.players.some((p) => p.connected);
    if (anyoneConnected) room.emptySince = null;
    else room.emptySince ??= this.now();
    this.schedule(room);
    this.onChange(next.code, next);
    if (next.players.length === 0) this.delete(next.code);
    return next;
  }

  private schedule(room: Room): void {
    if (room.timer) clearTimeout(room.timer);
    room.timer = null;
    const deadline = nextDeadline(room.state);
    if (deadline === null) return;
    const delay = Math.max(0, deadline - this.now());
    room.timer = setTimeout(() => {
      room.timer = null;
      if (this.rooms.get(room.state.code) !== room) return;
      this.tick(room);
      // If the clock moved oddly and nothing was due, try again later.
      if (!room.timer) this.schedule(room);
    }, delay + 5);
  }
}
