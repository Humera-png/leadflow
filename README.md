# LeadFlow

Personal lead gen & automation MVP. React 18 + Tailwind v4 frontend, Express backend.

## Run it

```bash
npm run install:all   # first time only
npm run dev            # runs backend (:5000) + frontend (:5173) together
```

Open http://localhost:5173.

## Current state (MVP)

- **Backend** (`server/`): full REST API for Leads, Sequences, Conversations, Email Templates, Calendar/Meetings, and Analytics. Data lives **in-memory** (resets on restart) — swap `server/src/data/store.js` for Mongoose + MongoDB Atlas when ready.
- **Automation**: new lead → cold, email #1 auto-scheduled for next morning → auto follow-ups every 5 days (3-email sequence) → reply/call/deal-closed transitions update status automatically. Runs on a 60s interval tick in `server/src/index.js`.
- **Gmail / Google Calendar**: currently **mocked** — emails/events are logged to the server console and recorded in the data store, nothing is actually sent. You have Google OAuth credentials ready; wire real sending in `server/src/services/emailService.js` and `server/src/services/calendarService.js` (marked with `TODO` comments), then set `GOOGLE_CLIENT_ID` / `GOOGLE_REFRESH_TOKEN` in `server/.env` (copy from `server/.env.example`).
- **Calendly / MongoDB Atlas**: not connected yet — no credentials provided. Meetings collection is modeled so a real Calendly webhook can slot in later.
- **Frontend**: all 6 pages built — Dashboard, Leads, Lead Detail, Templates, Calendar, Analytics (funnel + conversion charts via Recharts, CSV export, template performance).

## Demo shortcuts (since Gmail/Calendar aren't live yet)

On a lead's detail page:
- **Simulate reply received** — stands in for the Gmail reply webhook, moves lead cold → warm.
- **Book a call** — creates a mock calendar event, moves lead → hot.
- **Mark deal closed** — moves lead → customer, records deal amount.

## Next steps

1. Wire real Gmail send + Calendar event creation using your existing Google OAuth credentials.
2. Set up MongoDB Atlas and swap the in-memory store for Mongoose models (same document shapes already match the schema).
3. Add Calendly webhook once you have API access.
