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
- **Inbound lead capture**: a public, no-login form at `/capture` — embed it on an external landing page/website via `<iframe>` and every submission becomes a new Cold lead (`source: "webform"`) that flows straight into the normal auto-sequence. See "Embedding the capture form" below.

## Current state

All four integrations below are **fully coded** — they run in mock mode with zero setup, and switch to the real thing automatically the moment their env vars are set (no code changes needed). See "Turning on real integrations" for exact setup steps per service.

- **Data persistence**: in-memory by default (resets on restart/redeploy). Set `MONGODB_URI` and it becomes a write-through cache instead — reads still hit memory (fast, zero risk to existing code), every write also goes to MongoDB, and the app reloads everything from Mongo on boot. Data survives restarts once this is set.
- **Gmail**: mocked (logged to console) until `GOOGLE_CLIENT_ID`/`SECRET`/`REFRESH_TOKEN` are set — then it really sends via the Gmail API as whichever account completed the one-time OAuth flow, with an invisible open-tracking pixel embedded (reuses the existing `/api/emails/:leadId/open` endpoint).
- **Google Calendar**: same OAuth credentials — once set, "Book a call" creates a real event on your primary Google Calendar and emails a real invite to the lead.
- **Calendly**: mocked until `CALENDLY_CLIENT_ID`/`SECRET`/tokens are set — then the Calendar page shows your real Calendly scheduling link, and real bookings on it automatically create/update leads via a webhook.

## Turning on real integrations

### Google (Gmail send + Calendar events)

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project (or use an existing one), enable the **Gmail API** and **Google Calendar API**.
2. Create an OAuth Client ID (Application type: **Web application**). Add `GOOGLE_REDIRECT_URI`'s value (see `.env.example`) as an authorized redirect URI — locally that's `http://localhost:5000/api/auth/google/callback`, in production `https://leadflow-production-a9e7.up.railway.app/api/auth/google/callback`.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (locally in `server/.env`, in production via `railway variable set`).
4. Restart the server, then visit `/api/auth/google` in a browser (e.g. `https://leadflow-production-a9e7.up.railway.app/api/auth/google`) and sign in with whichever Google account you want sending email/creating events. It redirects back with a `GOOGLE_REFRESH_TOKEN` to copy.
5. Set `GOOGLE_REFRESH_TOKEN`, restart. Check `GET /api/health` → `gmailConfigured`/`calendarConfigured` should now be `true`.

### Calendly

1. Finish (or redo) the OAuth app registration at Calendly's developer portal — redirect URI is `CALENDLY_REDIRECT_URI` from `.env.example`.
2. Set `CALENDLY_CLIENT_ID`, `CALENDLY_CLIENT_SECRET`, `CALENDLY_REDIRECT_URI`.
3. Restart, visit `/api/calendly/connect`, authorize. Copy the `CALENDLY_ACCESS_TOKEN`/`CALENDLY_REFRESH_TOKEN` it shows you into env vars, restart again.
4. Visit `/api/calendly/setup-webhook` once (registers the webhook — needs `PUBLIC_BASE_URL` set to the backend's own public URL first, so Calendly knows where to send booking notifications).
5. The Calendar page will now show your real scheduling link at the top.

### MongoDB Atlas

1. Create a free cluster at [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas), create a database user, and allow network access from anywhere (or Railway's IP range).
2. Copy the connection string, set it as `MONGODB_URI`.
3. Restart — first boot with an empty database seeds the 3 templates once; every subsequent boot loads whatever's actually in Mongo instead.

## Embedding the capture form

Drop this on any external site (your marketing site, a landing page builder, etc.) to actually generate new leads instead of only managing ones you already have:

```html
<iframe
  src="https://leadflowtool.vercel.app/capture"
  style="width: 100%; max-width: 420px; height: 480px; border: 0;"
  title="Get in touch"
></iframe>
```

Notes:
- The form posts to `POST /api/leads/capture` on the backend directly (not through the frontend's normal `/api` proxy), with its own permissive CORS so it works embedded on any domain.
- Basic abuse protection: a hidden honeypot field (bots tend to fill every field they find; real visitors never see it) and a 10-submissions-per-hour-per-IP rate limit (`server/src/routes/leads.js`).
- Every submission lands as a new **Cold** lead with `source: "webform"` (visible on Lead Detail) and goes through the same auto-sequence as any other fresh lead.
- Not a scraper/prospecting tool — it captures people who come to you (inbound). For outbound prospecting (searching for companies/contacts matching your ICP), the legitimate path is a paid B2B data API (e.g. Apollo, Hunter, Clearbit) rather than scraping — ask if you want that wired in next.

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
- `PUBLIC_BASE_URL` — already set to this backend's own Railway URL (needed for the email tracking pixel and the Calendly webhook URL).
- `GOOGLE_CLIENT_ID` / `SECRET` / `REDIRECT_URI` / `REFRESH_TOKEN`, `CALENDLY_CLIENT_ID` / `SECRET` / tokens, `MONGODB_URI` — see "Turning on real integrations" above.

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

1. **Multi-user / client-facing (Phase 3)** — separate login per client, each seeing only their own leads, plus white-label branding. This is a genuinely separate architecture change (auth system, an ownership field added to every collection, protecting every route) rather than an incremental add — worth its own dedicated pass rather than bolting onto the integrations above.
2. Real inbound reply *detection* (a Gmail webhook that notices when a lead replies and calls "Mark as Replied" automatically) — right now that's still a manual button; outbound send is real, inbound parsing isn't.
3. Outbound prospecting (finding new leads matching your ICP via a paid B2B data API like Apollo/Hunter/Clearbit) — the capture form covers inbound; this would cover outbound.
