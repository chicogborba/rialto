# Deployment

Rialto ships in two shapes.

## 1. Landing page on GitHub Pages (static)

GitHub Pages can only host static files, so the Pages build is an **export of the landing page only**: the 3D story, comparisons and a *recorded* demo run. Links that need the backend (`/publish`, `/connect`) point to the repository's quickstart, and a small banner says so.

It deploys automatically on every push to `main` via `.github/workflows/pages.yml`.

**One-time setup:** in the repository go to **Settings → Pages → Build and deployment → Source: GitHub Actions**. The site appears at `https://<user>.github.io/<repo>/` (here: https://chicogborba.github.io/rialto/).

Build it locally:

```bash
NEXT_PUBLIC_BASE_PATH=/rialto npm run build:pages   # output in ./out
```

`scripts/build-pages.mjs` temporarily moves `app/api`, `app/app`, `app/connect` and `app/publish` aside (they need a server), runs `next build` with `STATIC_EXPORT=1`, and restores everything, even on failure. To preview under the sub-path:

```bash
mkdir -p /tmp/serve && ln -sfn "$PWD/out" /tmp/serve/rialto && cd /tmp/serve && python3 -m http.server 8123
# open http://localhost:8123/rialto/
```

Serving from a domain root instead of a sub-path: build without `NEXT_PUBLIC_BASE_PATH`.

## 2. The full platform on a Node host

The platform needs a Node server and a database file, so use any host that runs a long-lived Node process (a VPS, Fly.io, Railway, Render…). Vercel-style serverless is a poor fit today: the SQLite file, in-memory rate limiter and in-process gateway token assume a single instance.

```bash
npm ci
cp .env.example .env     # then edit, see below
npm run setup            # creates + seeds the database
npm run build
npm start                # listens on PORT (default 3000)
```

Production checklist:

- [ ] `SECRETS_KEY` set (`openssl rand -base64 32`). The app refuses to encrypt seller secrets without it in production.
- [ ] `INTERNAL_TOKEN` set to a long random string if you run more than one instance (and then also replace the in-memory rate limiter with Redis).
- [ ] `ALLOW_PRIVATE_UPSTREAMS` unset or `0`.
- [ ] Persist the SQLite file (`prisma/dev.db`) on a volume, and back it up.
- [ ] Put it behind HTTPS (the MCP install commands use your public URL).
- [ ] Decide the commission (`PLATFORM_FEE_BPS`, `PLATFORM_MIN_FEE_MICRO`).
- [ ] Remember payments are **simulated**: do not advertise real payouts until the live Solana rail exists.
