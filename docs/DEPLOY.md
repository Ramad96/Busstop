# Deploying Letter Race

Two parts:

- **Web app** – static files, hosted free on **GitHub Pages** (built by
  `.github/workflows/pages.yml` on every push to `main`).
- **Server** – Node + Socket.IO. It must stay running (open connections, rooms in memory,
  timers), so it can't run on GitHub Pages or on serverless hosts like Vercel. Render's free
  tier works; sign up with "Continue with GitHub".

## 1. Server on Render

1. In [Render](https://render.com), sign in with GitHub, then **New → Blueprint** and pick
   this repo. It reads `render.yaml` and creates `letter-race-server`.
2. When asked for `CORS_ORIGIN`, enter `https://<your-github-username>.github.io`
   (origin only, no `/LetterRace` path). Lowercase, e.g. `https://ramad96.github.io`.
3. Once deployed, open `https://<your-service>.onrender.com/health` – it should say
   `{"ok":true,...}`.

Notes:

- Free Render services sleep after ~15 minutes idle; the first visit then takes ~30–60 s
  to wake up (the app shows "Connecting…" meanwhile).
- Rooms live in memory. A redeploy or restart ends games in progress.
- Run only **one** instance: rooms aren't shared between instances.

## 2. Web app on GitHub Pages

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Repo **Settings → Secrets and variables → Actions → Variables → New repository
   variable**: `VITE_SERVER_URL` = your Render URL, e.g.
   `https://letter-race-server.onrender.com`.
3. Re-run the **Deploy web to GitHub Pages** workflow (Actions tab), or push to `main`.
4. The site is at `https://<your-github-username>.github.io/<repo-name>/`. Game links look
   like `https://ramad96.github.io/LetterRace/?code=ABCD`.

The workflow builds with `VITE_BASE=/<repo-name>/` so assets load from the Pages sub-path.
It fails with a clear message until `VITE_SERVER_URL` is set.

## 3. Custom domain (letterrace.amanahdigital.co.uk)

1. **DNS (Cloudflare):** add a `CNAME` record, name `letterrace`, target `ramad96.github.io`,
   proxy status **DNS only** (grey cloud) so GitHub can issue the HTTPS certificate.
2. **Render:** set `CORS_ORIGIN` to
   `https://letterrace.amanahdigital.co.uk,https://ramad96.github.io` and redeploy.
3. **GitHub:** Settings → Pages → Custom domain → `letterrace.amanahdigital.co.uk` → Save.
   When the certificate is ready, tick **Enforce HTTPS**.
4. Re-run **Deploy web to GitHub Pages**. The workflow sees the custom domain and builds
   with base path `/` instead of `/<repo-name>/`. The old github.io address redirects.

Optional but recommended: verify `amanahdigital.co.uk` under your GitHub account
(Settings → Pages → Verified domains) so nobody else can claim subdomains on GitHub Pages.

## Environment variables

| Where  | Name              | Example                                   | Default            |
| ------ | ----------------- | ----------------------------------------- | ------------------ |
| server | `PORT`            | `10000` (Render sets this)                | `3001`             |
| server | `CORS_ORIGIN`     | `https://ramad96.github.io`               | any origin         |
| web    | `VITE_SERVER_URL` | `https://letter-race-server.onrender.com` | `<page host>:3001` |
| web    | `VITE_BASE`       | `/` or `/LetterRace/` (set by workflow)   | `/`                |

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
