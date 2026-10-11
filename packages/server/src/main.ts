import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { CORE_VERSION } from '@letter-race/core';

const port = Number(process.env.PORT ?? 3001);
const httpServer = createServer((_req, res) => {
  res.writeHead(200, { 'content-type': 'text/plain' });
  res.end('Letter Race server');
});
const io = new Server(httpServer, { cors: { origin: '*' } });

io.on('connection', (socket) => {
  socket.emit('hello', { coreVersion: CORE_VERSION });
});

httpServer.listen(port, () => {
  console.log(`Letter Race server listening on :${port}`);
});
