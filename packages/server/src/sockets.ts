import { createHash } from 'node:crypto';
import type { Server, Socket } from 'socket.io';
import {
  GameError,
  normaliseRoomCode,
  toPlayerView,
  type Ack,
  type ClientToServerEvents,
  type ErrorInfo,
  type GameState,
  type PlayerId,
  type ServerToClientEvents,
} from '@letter-race/core';
import { RoomError, type PlayerAction, type RoomManager } from './rooms';

interface SocketData {
  playerId: PlayerId;
  code: string | null;
}

export type GameServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

/**
 * The browser keeps a secret token; the public player id is derived from it so other
 * players (who can see ids) can't impersonate you.
 */
export function playerIdFromToken(token: string): PlayerId {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

function toErrorInfo(e: unknown): ErrorInfo {
  if (e instanceof RoomError || e instanceof GameError) return { code: e.code, message: e.message };
  console.error(e);
  return { code: 'bad_request', message: 'Something went wrong' };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function str(value: unknown): string {
  if (typeof value !== 'string') throw new RoomError('bad_request', 'Bad request');
  return value;
}

export function broadcastState(io: GameServer, state: GameState, now: number): void {
  for (const socket of io.sockets.sockets.values()) {
    if (socket.data.code !== state.code) continue;
    socket.emit('state', {
      state: toPlayerView(state, socket.data.playerId),
      serverNow: now,
      you: socket.data.playerId,
    });
  }
}

export function attachSocketHandlers(io: GameServer, rooms: RoomManager, now: () => number): void {
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || token.length < 16 || token.length > 128) {
      next(new Error('A player token is required'));
      return;
    }
    socket.data.playerId = playerIdFromToken(token);
    socket.data.code = null;
    next();
  });

  io.on('connection', (socket: GameSocket) => {
    const { playerId } = socket.data;

    /** Wraps a handler: validates the ack, turns errors into { ok: false }. */
    const handle =
      <A extends unknown[]>(fn: (...args: A) => object | void) =>
      (...args: unknown[]) => {
        const last = args[args.length - 1];
        const ack = typeof last === 'function' ? (last as (r: Ack) => void) : undefined;
        try {
          const result = fn(...(args as A));
          ack?.({ ok: true, ...(result ?? {}) });
        } catch (e) {
          ack?.({ ok: false, error: toErrorInfo(e) });
        }
      };

    const enterRoom = (code: string) => {
      if (socket.data.code && socket.data.code !== code) leaveCurrentRoom();
      socket.data.code = code;
    };

    const otherSocketsForPlayer = (code: string) =>
      [...io.sockets.sockets.values()].filter(
        (s) => s.id !== socket.id && s.data.code === code && s.data.playerId === playerId,
      );

    /** Marks the player disconnected unless they still have another tab open. */
    const leaveCurrentRoom = () => {
      const code = socket.data.code;
      if (!code) return;
      socket.data.code = null;
      if (otherSocketsForPlayer(code).length === 0) rooms.disconnect(code, playerId);
    };

    const requireRoom = () => {
      if (!socket.data.code) throw new RoomError('not_in_room', 'Join a game first');
      return socket.data.code;
    };

    const dispatch = (action: PlayerAction) => {
      rooms.dispatch(requireRoom(), playerId, action);
    };

    socket.on('time:ping', (ack) => {
      if (typeof ack === 'function') ack(now());
    });

    socket.on(
      'room:check',
      handle((data: unknown) => {
        const code = normaliseRoomCode(str(isObject(data) ? data.code : undefined));
        return { phase: rooms.require(code).state.phase };
      }),
    );

    socket.on(
      'room:create',
      handle((data: unknown) => {
        if (!isObject(data)) throw new RoomError('bad_request', 'Bad request');
        // Join the socket to the room before the first broadcast so it gets the state.
        const pending = { name: str(data.name), character: str(data.character) };
        leaveCurrentRoom();
        const state = rooms.create({
          id: playerId,
          name: pending.name,
          character: pending.character as never,
        });
        enterRoom(state.code);
        broadcastState(io, state, now());
        return { code: state.code, playerId };
      }),
    );

    socket.on(
      'room:join',
      handle((data: unknown) => {
        if (!isObject(data)) throw new RoomError('bad_request', 'Bad request');
        const code = normaliseRoomCode(str(data.code));
        rooms.require(code);
        const previous = socket.data.code;
        enterRoom(code);
        try {
          rooms.join(code, {
            id: playerId,
            name: str(data.name),
            character: str(data.character) as never,
          });
        } catch (e) {
          socket.data.code = previous === code ? code : null;
          throw e;
        }
        return { code, playerId };
      }),
    );

    socket.on(
      'room:rejoin',
      handle((data: unknown) => {
        const code = normaliseRoomCode(str(isObject(data) ? data.code : undefined));
        const room = rooms.require(code);
        if (!room.state.players.some((p) => p.id === playerId)) {
          throw new RoomError('not_in_game', 'You are not in this game');
        }
        enterRoom(code);
        rooms.reconnect(code, playerId);
        return { code, playerId };
      }),
    );

    socket.on(
      'room:leave',
      handle(() => {
        const code = requireRoom();
        socket.data.code = null;
        rooms.dispatch(code, playerId, { type: 'leave' });
        // Tell any other tabs of this player that they're out.
        for (const other of otherSocketsForPlayer(code)) other.data.code = null;
      }),
    );

    socket.on(
      'settings:update',
      handle((data: unknown) => {
        if (!isObject(data) || !isObject(data.settings)) {
          throw new RoomError('bad_request', 'Bad request');
        }
        const { roundSeconds, categories, includeHardLetters, totalRounds } = data.settings;
        const settings: Record<string, unknown> = {};
        if (roundSeconds !== undefined) settings.roundSeconds = roundSeconds;
        if (categories !== undefined) settings.categories = categories;
        if (includeHardLetters !== undefined) settings.includeHardLetters = includeHardLetters;
        if (totalRounds !== undefined) settings.totalRounds = totalRounds;
        dispatch({ type: 'updateSettings', settings });
      }),
    );

    socket.on(
      'game:start',
      handle(() => dispatch({ type: 'start' })),
    );
    socket.on(
      'game:end',
      handle(() => dispatch({ type: 'endGame' })),
    );
    socket.on(
      'game:new',
      handle(() => dispatch({ type: 'newGame' })),
    );

    const answersFrom = (data: unknown) => {
      if (!isObject(data) || !isObject(data.answers)) {
        throw new RoomError('bad_request', 'Bad request');
      }
      return data.answers as Record<string, string>;
    };

    socket.on(
      'answers:update',
      handle((data: unknown) => dispatch({ type: 'updateAnswers', answers: answersFrom(data) })),
    );
    socket.on(
      'answers:submit',
      handle((data: unknown) => dispatch({ type: 'submitAnswers', answers: answersFrom(data) })),
    );
    socket.on(
      'clock:stop',
      handle((data: unknown) => dispatch({ type: 'stopClock', answers: answersFrom(data) })),
    );

    socket.on(
      'answer:challenge',
      handle((data: unknown) => {
        if (!isObject(data)) throw new RoomError('bad_request', 'Bad request');
        dispatch({ type: 'challenge', targetId: str(data.targetId), category: str(data.category) });
      }),
    );

    socket.on(
      'challenge:vote',
      handle((data: unknown) => {
        if (!isObject(data)) throw new RoomError('bad_request', 'Bad request');
        const verdict = str(data.verdict);
        if (verdict !== 'valid' && verdict !== 'invalid') {
          throw new RoomError('bad_request', 'Vote valid or invalid');
        }
        dispatch({
          type: 'voteChallenge',
          targetId: str(data.targetId),
          category: str(data.category),
          verdict,
        });
      }),
    );

    socket.on('disconnect', () => leaveCurrentRoom());
  });
}
