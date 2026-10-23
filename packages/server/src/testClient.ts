import { io as connect, type Socket } from 'socket.io-client';
import type {
  Ack,
  ClientToServerEvents,
  GameState,
  ServerToClientEvents,
  StateMessage,
} from '@busstop/core';

export type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/** A fake player for tests and the simulate script. */
export class TestClient {
  readonly socket: ClientSocket;
  latest: StateMessage | null = null;
  private waiters: { predicate: (s: GameState) => boolean; resolve: (s: GameState) => void }[] = [];

  constructor(
    url: string,
    readonly token: string,
  ) {
    this.socket = connect(url, { auth: { token }, transports: ['websocket'], forceNew: true });
    this.socket.on('state', (message) => {
      this.latest = message;
      this.waiters = this.waiters.filter((w) => {
        if (!w.predicate(message.state)) return true;
        w.resolve(message.state);
        return false;
      });
    });
  }

  get state(): GameState {
    if (!this.latest) throw new Error('No state yet');
    return this.latest.state;
  }

  get id(): string {
    if (!this.latest) throw new Error('No state yet');
    return this.latest.you;
  }

  connected(): Promise<void> {
    if (this.socket.connected) return Promise.resolve();
    return new Promise((resolve, reject) => {
      this.socket.once('connect', () => resolve());
      this.socket.once('connect_error', reject);
    });
  }

  /** Emits an event and resolves with the ack. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  call<T = object>(event: keyof ClientToServerEvents, ...args: any[]): Promise<Ack<T>> {
    return new Promise((resolve) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this.socket.emit as any)(event, ...args, resolve);
    });
  }

  waitFor(predicate: (s: GameState) => boolean, timeoutMs = 2000): Promise<GameState> {
    if (this.latest && predicate(this.latest.state)) return Promise.resolve(this.latest.state);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Timed out waiting for state')), timeoutMs);
      this.waiters.push({
        predicate,
        resolve: (s) => {
          clearTimeout(timer);
          resolve(s);
        },
      });
    });
  }

  close(): void {
    this.socket.close();
  }
}
