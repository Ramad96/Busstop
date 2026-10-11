import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { Server } from 'socket.io';
import type { RandomFn } from '@letter-race/core';
import { RoomManager } from './rooms';
import { attachSocketHandlers, broadcastState, type GameServer } from './sockets';

export interface AppOptions {
  now?: () => number;
  random?: RandomFn;
  /** Allowed web origins (CORS). Defaults to any origin. */
  corsOrigin?: string | string[];
}

export interface App {
  httpServer: HttpServer;
  io: GameServer;
  rooms: RoomManager;
  listen(port: number): Promise<number>;
  close(): Promise<void>;
}

export function createApp(options: AppOptions = {}): App {
  const now = options.now ?? Date.now;
  const httpServer = createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, rooms: rooms.rooms.size }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/plain' });
    res.end('Letter Race server');
  });
  const io: GameServer = new Server(httpServer, {
    cors: { origin: options.corsOrigin ?? '*' },
  });
  const rooms: RoomManager = new RoomManager({
    now,
    random: options.random,
    onChange: (_code, state) => broadcastState(io, state, now()),
  });
  attachSocketHandlers(io, rooms, now);

  return {
    httpServer,
    io,
    rooms,
    listen: (port) =>
      new Promise((resolve) => {
        httpServer.listen(port, () => resolve((httpServer.address() as AddressInfo).port));
      }),
    close: () =>
      new Promise((resolve) => {
        rooms.dispose();
        io.close(() => resolve());
      }),
  };
}
