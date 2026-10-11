/**
 * The only file that talks to Socket.IO. Screens use the `game` client and the
 * `useGame()` hook; they never touch the socket directly. Events: docs/PROTOCOL.md.
 */
import { useSyncExternalStore } from 'react';
import { io, type Socket } from 'socket.io-client';
import type {
  Ack,
  Answers,
  CharacterId,
  ClientToServerEvents,
  GameState,
  JoinedRoom,
  PlayerId,
  ServerToClientEvents,
  Settings,
} from '@letter-race/core';
import { bestOffset, type ClockSample } from './clock';
import { storage } from './storage';

type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

export interface Snapshot {
  status: ConnectionStatus;
  game: GameState | null;
  you: PlayerId | null;
  /** Add to Date.now() to get server time. */
  clockOffset: number;
  /** True while trying to get back into a saved game after a refresh. */
  rejoining: boolean;
}

const TOKEN_KEY = 'letterRace.token';
const CODE_KEY = 'letterRace.code';

function serverUrl(): string {
  const configured = import.meta.env.VITE_SERVER_URL as string | undefined;
  if (configured) return configured;
  if (import.meta.env.PROD) console.warn('VITE_SERVER_URL is not set; guessing the server URL.');
  // Dev default: same host as the page (works from a phone on the same Wi-Fi), port 3001.
  return `${location.protocol}//${location.hostname}:3001`;
}

function getToken(): string {
  let token = storage.get(TOKEN_KEY);
  if (!token || token.length < 16) {
    token =
      typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
            b.toString(16).padStart(2, '0'),
          ).join('');
    storage.set(TOKEN_KEY, token);
  }
  return token;
}

class GameClient {
  private socket: GameSocket | null = null;
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = {
    status: 'connecting',
    game: null,
    you: null,
    clockOffset: 0,
    rejoining: storage.get(CODE_KEY) !== null,
  };

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    this.connect();
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  /** Current server time, estimated. */
  serverNow(): number {
    return Date.now() + this.snapshot.clockOffset;
  }

  private set(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  private connect() {
    if (this.socket) return;
    const socket: GameSocket = io(serverUrl(), { auth: { token: getToken() } });
    this.socket = socket;

    socket.on('connect', () => {
      this.set({ status: 'connected' });
      void this.syncClock();
      void this.rejoinSaved();
    });
    socket.on('disconnect', () => this.set({ status: 'disconnected' }));
    socket.on('connect_error', () => this.set({ status: 'disconnected' }));
    socket.on('state', ({ state, you }) => {
      // Removed from the game (e.g. left in another tab): forget it.
      if (!state.players.some((p) => p.id === you)) {
        storage.remove(CODE_KEY);
        this.set({ game: null, you: null, rejoining: false });
        return;
      }
      storage.set(CODE_KEY, state.code);
      this.set({ game: state, you, rejoining: false });
    });
  }

  private async syncClock() {
    const samples: ClockSample[] = [];
    for (let i = 0; i < 5; i++) {
      const sample = await new Promise<ClockSample | null>((resolve) => {
        const sentAt = Date.now();
        const timer = setTimeout(() => resolve(null), 3000);
        this.socket?.emit('time:ping', (serverNow) => {
          clearTimeout(timer);
          resolve({ sentAt, receivedAt: Date.now(), serverNow });
        });
      });
      if (sample) samples.push(sample);
    }
    const offset = bestOffset(samples);
    if (offset !== null) this.set({ clockOffset: offset });
  }

  /** After a refresh or dropped connection, get back into the last game. */
  private async rejoinSaved() {
    const code = this.snapshot.game?.code ?? storage.get(CODE_KEY);
    if (!code) {
      this.set({ rejoining: false });
      return;
    }
    this.set({ rejoining: true });
    const result = await this.request<JoinedRoom>('room:rejoin', { code });
    if (!result.ok) {
      storage.remove(CODE_KEY);
      this.set({ game: null, you: null, rejoining: false });
    }
  }

  private request<T = object>(
    event: keyof ClientToServerEvents,
    ...args: unknown[]
  ): Promise<Ack<T>> {
    this.connect();
    const socket = this.socket!;
    return new Promise((resolve) => {
      const timer = setTimeout(
        () =>
          resolve({
            ok: false,
            error: {
              code: 'bad_request',
              message: "Can't reach the server. Check your connection.",
            },
          }),
        8000,
      );
      // Socket.IO's typed emit can't express a dynamic event name.
      (socket.emit as (event: string, ...rest: unknown[]) => void)(event, ...args, (r: Ack<T>) => {
        clearTimeout(timer);
        resolve(r);
      });
    });
  }

  checkRoom(code: string) {
    return this.request<{ phase: GameState['phase'] }>('room:check', { code });
  }

  createRoom(name: string, character: CharacterId) {
    return this.request<JoinedRoom>('room:create', { name, character });
  }

  joinRoom(code: string, name: string, character: CharacterId) {
    return this.request<JoinedRoom>('room:join', { code, name, character });
  }

  async leaveRoom() {
    const result = await this.request('room:leave');
    storage.remove(CODE_KEY);
    this.set({ game: null, you: null });
    return result;
  }

  updateSettings(settings: Partial<Settings>) {
    return this.request('settings:update', { settings });
  }

  startGame() {
    return this.request('game:start');
  }

  endGame() {
    return this.request('game:end');
  }

  updateAnswers(answers: Answers) {
    return this.request('answers:update', { answers });
  }

  submitAnswers(answers: Answers) {
    return this.request('answers:submit', { answers });
  }

  stopClock(answers: Answers) {
    return this.request('clock:stop', { answers });
  }

  voteReject(targetId: PlayerId, category: string) {
    return this.request('answer:vote', { targetId, category });
  }
}

export const game = new GameClient();

export function useGame(): Snapshot {
  return useSyncExternalStore(game.subscribe, game.getSnapshot);
}
