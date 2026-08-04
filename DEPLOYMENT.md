# Deploying LeadFlow

LeadFlow is two separate services — a Vite/React frontend and an Express backend. They deploy to two different hosts and are connected by one environment variable (`VITE_API_URL`).

**Read this before you deploy:** the backend currently stores data **in-memory** (see `server/src/data/store.js`) and runs a `setInterval` for the email automation tick (`server/src/index.js`). Neither of those survives on Vercel's serverless functions — state resets on every cold start, and there's no long-lived process for the interval to run in. **Deploy the backend to Railway or Render** (both support a normal long-running Node process, free tier), not Vercel. Vercel is only for the frontend here. If/when you connect MongoDB Atlas, the store becomes swappable for a real database — the interval tick still needs a persistent host either way.

## 1. Push to GitHub

```bash
# from the project root (already git-initialized)
git remote add origin https://github.com/YOUR_USERNAME/leadflow.git
git branch -M main
git push -u origin main
```

(Create the empty repo on GitHub first — `gh repo create leadflow --private --source=. --remote=origin` if you have the GitHub CLI authenticated, or create it via github.com and use the URL above.)

## 2. Backend → Railway or Render

Either works the same way; steps shown for Railway.

1. New Project → Deploy from GitHub repo → select `leadflow`.
2. **Root directory**: `server`
3. **Start command**: `npm start` (already in `server/package.json`)
4. Environment variables (copy from `server/.env.example`):
   - `PORT` — Railway/Render set this automatically, you don't need to set it.
   - `CLIENT_ORIGIN` — your Vercel frontend URL once you have it, e.g. `https://leadflow.vercel.app` (needed for CORS).
   - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_REFRESH_TOKEN` — only once you wire real Gmail/Calendar sending (currently mocked).
   - `MONGODB_URI` — only once you connect MongoDB Atlas (currently in-memory).
5. Deploy. Note the resulting URL, e.g. `https://leadflow-api.up.railway.app`.
6. Auto-deploy on push is automatic once the GitHub repo is connected — no extra config needed.

## 3. Frontend → Vercel

1. [vercel.com/new](https://vercel.com/new) → import the `leadflow` GitHub repo.
2. **Root Directory**: `client` (important — this is a monorepo).
   Vercel will pick up `client/vercel.json` automatically once the root directory is set.
3. Environment variable:
   - `VITE_API_URL` = the backend URL from step 2 (e.g. `https://leadflow-api.up.railway.app`), **no trailing slash**.
4. Deploy. Vercel auto-deploys on every push to `main` once connected — that's the "auto-deploy on push" mechanism; no custom GitHub Action is needed for the deploy itself.
5. To get `leadflow.vercel.app` specifically: Project Settings → Domains → add/claim that subdomain (only available if unclaimed).

## 4. Connect them

Go back to the backend's `CLIENT_ORIGIN` env var (step 2.4) and set it to the real Vercel URL, then redeploy the backend so CORS allows requests from it.

## 5. Verify

- Visit the Vercel URL → Dashboard should load with data (proves `VITE_API_URL` → backend connection works).
- Leads page → Import CSV with a small test file → confirms the multipart upload path works through both hosts.
- Analytics page → Export leads CSV → confirms the download path works cross-origin.

## What's still mocked

- Gmail send / Google Calendar event creation are stubbed (logged, not real) — see `TODO` comments in `server/src/services/emailService.js` and `calendarService.js`. You have Google OAuth credentials ready; wire them in when you're ready.
- No MongoDB Atlas connection yet — data resets whenever the backend restarts/redeploys. Fine for a demo, not for real lead data — connect Atlas before relying on this in production.
- Calendly isn't connected — `meetings` are created directly via the in-app "Book a call" action instead of a webhook.

## CI

`.github/workflows/ci.yml` runs a build/syntax check on every push and PR to `main` — it validates the client builds and the server has no syntax errors, but it does **not** perform the deploy (Vercel/Railway's own GitHub integration does that, as above).
