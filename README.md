# LeadFlow

Personal lead gen & automation tool. React 18 + Tailwind v4 frontend, Express backend.

**Live:**
- Frontend: https://leadflowtool.vercel.app
- Backend API: https://leadflow-production-a9e7.up.railway.app (Railway)
- Repo: https://github.com/Humera-png/leadflow

## Run it locally

```bash
npm run install:all   # first time only
npm run dev             # runs backend (:5000) + frontend (:5173) together
```

Open http://localhost:5173.

## Features

- **Leads**: CRUD, search/filter (status, ICP, company), bulk status/tag updates, CSV import & export.
- **Statuses**: Cold → Warm → Hot → Customer, plus **Follow-up Later** (said "not now, maybe later" — distinct from a hard **Rejected**).
- **Quick Add**: `+ Add Lead` opens a form that can back-fill an already-contacted lead (message sent, last reply, deal info) — the backend decides whether to hand it to the auto-sequence engine or just record history, based on what you fill in.
- **Mark as Replied**: one click on Lead Detail logs an inbound reply (status → Warm, reply message saved, dashboard updates) — stands in for a real Gmail reply webhook.
- **Automation**: new cold lead → email #1 auto-scheduled for next morning → auto follow-ups every 5 days (3-email sequence) → status auto-advances on reply/call-booked/deal-closed. Runs on a 60s interval tick in `server/src/index.js`.
- **CSV import/export**: `POST /api/leads/import-csv`, `GET /api/leads/export-csv` — same column set, round-trips cleanly.
- **Analytics**: status breakdown (all 6 statuses), Cold→Warm→Hot→Customer conversion funnel, conversion rate by month, best-performing email templates, CSV export.

## Current state

- **Backend** (`server/`): data lives **in-memory** (resets on restart/redeploy) — swap `server/src/data/store.js` for Mongoose + MongoDB Atlas when ready; document shapes already match a real schema.
- **Gmail / Google Calendar**: currently **mocked** — emails/events are logged to the server console and recorded in the data store, nothing is actually sent. Wire real sending in `server/src/services/emailService.js` and `server/src/services/calendarService.js` (marked with `TODO` comments), then set `GOOGLE_CLIENT_ID` / `GOOGLE_REFRESH_TOKEN` in `server/.env` (copy from `server/.env.example`).
- **Calendly**: not connected — `Meetings` are created directly via the in-app "Book a call" action instead of a webhook.

## Project structure

```
client/    React + Vite + Tailwind frontend (deploys to Vercel)
server/    Express backend (deploys to Railway/Render — see below)
```

## Deployment

LeadFlow is two separate services deployed to two different hosts, connected by one environment variable (`VITE_API_URL`).

**Why not all-on-Vercel:** the backend stores data **in-memory** and runs a `setInterval` for the email automation tick (`server/src/index.js`). Neither survives Vercel's serverless functions — state resets on every cold start, and there's no long-lived process for the interval to run in. Deploy the backend to **Railway or Render** (normal long-running Node process, free tier); Vercel is for the frontend only.

### 1. GitHub

Already set up — this repo auto-tracks `master`. To push further changes:

```bash
git add -A && git commit -m "..." && git push
```

### 2. Backend → Railway

Already deployed (see live link above), project `harmonious-wholeness` → service `leadflow`.

**Important:** this is deployed via `railway up` (uploads the local `server/` folder directly), **not** GitHub auto-deploy. Railway's GitHub integration builds from the repo root, and this is a monorepo (`client/` + `server/` both at root) — without per-service root-directory config it would try to build the wrong thing. The GitHub source was deliberately disconnected from this service to prevent a future `git push` from triggering a broken auto-rebuild.

To redeploy the backend after making changes:

```bash
cd server && npx @railway/cli up -c
```

(First time on a new machine: `npx @railway/cli login` then `npx @railway/cli link` to select the `harmonious-wholeness` project / `leadflow` service.)

Environment variables (see `server/.env.example`), set via `npx @railway/cli variable set KEY=value`:
- `CLIENT_ORIGIN` — already set to the Vercel frontend URL (comma-separate multiple origins if needed).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `GOOGLE_REFRESH_TOKEN` — only once you wire real Gmail/Calendar sending.
- `MONGODB_URI` — only once you connect MongoDB Atlas.
- `CALENDLY_API_TOKEN` / Calendly OAuth client credentials — once you finish registering the Calendly OAuth app and the `/api/calendly/callback` route is built.

To get a public URL: `npx @railway/cli domain` (already done — see live link above).

### 3. Frontend → Vercel

Already deployed (see live link above), connected via `client/vercel.json`. To redeploy manually:

```bash
cd client && npx vercel --prod
```

Once the backend is deployed (step 2), set the **`VITE_API_URL`** environment variable in the Vercel project settings to the backend's URL (no trailing slash), then redeploy. Also set the backend's `CLIENT_ORIGIN` to the Vercel URL and redeploy the backend, so CORS allows it.

To connect the Vercel project to this GitHub repo for native auto-deploy-on-push (recommended over any custom Action): `vercel git connect` from `client/`, or via the Vercel dashboard → Project Settings → Git.

### 4. Verify

- Visit the Vercel URL → Dashboard should load with data (proves `VITE_API_URL` → backend connection).
- Leads page → Import CSV with a small test file → confirms the multipart upload path.
- Analytics page → Export leads CSV → confirms the cross-origin download path.

### CI

`.github/workflows/deploy.yml` runs a build/syntax check on every push and PR to `master` (validates the client builds and the server has no syntax errors). It does **not** perform the actual deploy — the frontend redeploys via Vercel CLI and the backend via Railway CLI, both described above (neither is on GitHub auto-deploy, see the backend note on why).

## Next steps

1. Wire real Gmail send + Calendar event creation using your Google OAuth credentials.
2. Set up MongoDB Atlas and swap the in-memory store for Mongoose models.
3. Add a Calendly webhook once you have API access.
