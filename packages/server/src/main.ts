import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim());

const app = createApp({ corsOrigin });
app.listen(port).then((actual) => {
  console.log(`Letter Race server listening on :${actual}`);
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    app.close().then(() => process.exit(0));
  });
}
