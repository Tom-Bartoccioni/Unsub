# Unsub

[![CI](https://github.com/OWNER/REPO/actions/workflows/ci.yml/badge.svg)](https://github.com/Tom-Bartoccioni/Unsub/actions/workflows/ci.yml)

> Kill your subscription ghosts before they haunt your wallet.

A fintech-driven subscription management app that uses virtual cards to give users one-click control over their recurring expenses.

See [PRD.md](PRD.md) for the product spec and [ROADMAP.md](ROADMAP.md) for delivery status.

## Repo layout

```
app/                # Expo React Native frontend
api/                # Fastify backend (Node 20+, TypeScript)
packages/shared/    # Zod schemas and types shared across app + api
```

## Prerequisites

- **Node 20+** (`.nvmrc` pins `24`)
- **pnpm 9** (`corepack enable` then `corepack prepare pnpm@9 --activate`, or `npm i -g pnpm@9`)
- Windows users: enable long paths — `git config --system core.longpaths true`

## Quickstart

```bash
pnpm install
pnpm turbo run typecheck
pnpm turbo run lint
pnpm turbo run test
```

### Run the API locally

```bash
cp api/.env.example api/.env   # fill in DATABASE_URL + Firebase admin trio
pnpm --filter api dev
curl http://localhost:3000/health
```

### Run the app locally

```bash
cp app/.env.example app/.env   # fill in EXPO_PUBLIC_FIREBASE_*
pnpm --filter app start --web  # browser sanity target — fastest on Windows
```

## Staging deploy (Phase 0 — T08)

Phase 0 DoD requires sign-up working against a deployed staging API. Provisioning steps:

### 1. Firebase (`unsub-dev` project)

1. Firebase Console → **Authentication** → **Sign-in method** → enable **Email/Password**.
2. **Project settings → General → Your apps → Add app → Web** (no need to set up Hosting). Save the config snippet — this is what `app/.env` needs.
3. **Project settings → Service accounts → Generate new private key**. Download the JSON. The three fields you need from it:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`
   - `private_key` → `FIREBASE_PRIVATE_KEY` (paste with `\n` escape sequences; the backend unescapes)

### 2. Neon (`unsub` project, `staging` branch)

1. Neon Console → create project named `unsub`. Default branch is `main`.
2. Branches → **New branch** → `staging` (off `main`).
3. Copy the connection string. **Make sure it's the pooled one** — the hostname must contain `-pooler` (e.g. `ep-cool-tree-12345-pooler.eu-central-1.aws.neon.tech`). Newer Neon UIs default to pooled; if not, click the dropdown next to the connection string and choose **Connection pooling: enabled**, or just insert `-pooler` into the hostname before the first `.` (Neon routes both). That string is `DATABASE_URL`.
4. From the repo root: `cp api/.env.example api/.env`, paste `DATABASE_URL`, then run:

   ```bash
   pnpm --filter @unsub/api db:migrate
   ```

   That applies `0000_init.sql` and creates the `users` table.

### 3. `api/.env` (backend, local dev)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://...neon.tech/...?sslmode=require   # Neon staging branch
FIREBASE_PROJECT_ID=unsub-dev
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@unsub-dev.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

Wrap `FIREBASE_PRIVATE_KEY` in double quotes; keep the literal `\n` sequences — `env.ts` converts them.

### 4. `app/.env` (frontend, local dev)

```
EXPO_PUBLIC_FIREBASE_API_KEY=AIza...
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=unsub-dev.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=unsub-dev
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=unsub-dev.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
EXPO_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef
EXPO_PUBLIC_API_URL=http://localhost:3000
```

### 5. Render (API hosting — free tier)

> Render is the recommended host because the free tier is permanent (cold-starts after 15 min idle).
> Railway also works but its free tier is a 30-day trial — switch your repo there if you'd rather pay $5/month for no cold starts.

1. https://dashboard.render.com → **New + → Web Service** → connect this GitHub repo.
2. Settings:
   - **Name:** `unsub-api`
   - **Region:** closest to you
   - **Branch:** `main`
   - **Root Directory:** _(leave blank)_ — the Dockerfile needs the repo root as its build context to access `pnpm-workspace.yaml` + `packages/shared/`.
   - **Runtime:** **Docker**
   - **Dockerfile Path:** `./api/Dockerfile`
   - **Docker Build Context Directory:** `.` _(the repo root, default)_
   - **Instance Type:** Free
   - **Health Check Path:** `/health`
3. **Environment** tab — add the same keys as `api/.env`, but point `DATABASE_URL` at the Neon `staging` branch and set `NODE_ENV=staging`. Render auto-injects `RENDER_GIT_COMMIT`; if you want it surfaced via `/health`, also add `GITHUB_SHA` with value `${RENDER_GIT_COMMIT}` (Render supports variable references), otherwise `/health` reports `commit: "dev"`.
4. Click **Create Web Service**. The Dockerfile's `CMD` runs `node dist/db/migrate.js && node dist/index.js`, so migrations apply on every container boot. First build takes ~5 min. When it goes green, copy the public URL (`https://unsub-api.onrender.com`). Smoke test: `curl https://unsub-api.onrender.com/health` → `{"status":"ok","commit":"<sha>"}`.

### 6. GitHub repo + CI

1. `git remote add origin https://github.com/<owner>/<repo>.git`
2. Edit `README.md` line 3 — replace `OWNER/REPO` with your actual `owner/repo` slug.
3. `git add . && git commit -m "chore: phase 0 foundations" && git push -u origin main`
4. Watch CI on the **Actions** tab — the workflow runs `format:check` + `lint`/`typecheck`/`test` across all three packages.

### 7. EAS preview build (Android APK)

1. `pnpm dlx eas-cli login`
2. `pnpm dlx eas-cli init` (links the project to your Expo account; updates `app.json` with `extra.eas.projectId`).
3. Edit `app/eas.json` — replace `https://REPLACE-WITH-RAILWAY-URL.up.railway.app` with the live Railway URL in **both** `preview` and `production` blocks.
4. `pnpm dlx eas-cli build --profile preview --platform android` — cloud build (~10–20 min). Returns an install link for the APK.
5. Add Firebase **Authorized domains** for the Expo dev URL if testing via `expo start --web` (`localhost` is allowed by default).

## Phase status

Currently building **Phase 0 — Foundations**. See [ROADMAP.md](ROADMAP.md) for the live task board.
