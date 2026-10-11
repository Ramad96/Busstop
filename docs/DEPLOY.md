# Deploying Letter Race

Two parts: the **server** (Node + Socket.IO, needs to stay running) and the **web app**
(static files). Free tiers on Render and Vercel are enough for playing with friends.

## 1. Server on Render

1. Push this repo to GitHub.
2. In [Render](https://render.com): **New → Blueprint**, pick the repo. It reads
   `render.yaml` and creates `letter-race-server`.
3. When asked for `CORS_ORIGIN`, enter the web app URL from step 2 (you can come back and
   set it after the web app is deployed). Several URLs can be comma-separated.
4. Once deployed, open `https://<your-service>.onrender.com/health` – it should say
   `{"ok":true,...}`.

Notes:

- Free Render services sleep after ~15 minutes idle; the first visit then takes ~30–60 s
  to wake up. A paid instance (or Fly.io with `min_machines_running = 1`) avoids that.
- Rooms live in memory. A redeploy or restart ends games in progress.
- Run only **one** instance: rooms aren't shared between instances.

## 2. Web app on Vercel

1. In [Vercel](https://vercel.com): **Add New → Project**, import the repo. Keep the root
   directory as the repo root – `vercel.json` sets the build.
2. Add an environment variable `VITE_SERVER_URL` = your Render URL, e.g.
   `https://letter-race-server.onrender.com`.
3. Deploy. Share the Vercel URL with friends – game links look like
   `https://<app>.vercel.app/?code=ABCD`.
4. Put the Vercel URL into the server's `CORS_ORIGIN` on Render and redeploy the server.

## Environment variables

| Where  | Name              | Example                                   | Default            |
| ------ | ----------------- | ----------------------------------------- | ------------------ |
| server | `PORT`            | `10000` (Render sets this)                | `3001`             |
| server | `CORS_ORIGIN`     | `https://letter-race.vercel.app`          | any origin         |
| web    | `VITE_SERVER_URL` | `https://letter-race-server.onrender.com` | `<page host>:3001` |

## Before you deploy

```sh
pnpm check   # lint, typecheck, tests, core purity audit, build
```

## Testing on phones without deploying

`pnpm dev` serves the web app on your network (`http://<your-computer-ip>:5173`) and the
web app finds the server on the same host at port 3001. Phones on the same Wi-Fi can join.

## iOS later

- `packages/core` is plain TypeScript with no browser, Node, clock or randomness APIs
  (`pnpm audit:core` enforces it), so it can be ported to Swift using its tests as a
  checklist.
- Or keep the server as-is and build an iOS client with the official Socket.IO Swift
  client – every message is listed in `docs/PROTOCOL.md`, and a test fails if the docs and
  the server drift apart.
