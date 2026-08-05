import express from "express";
import cors from "cors";
import leadsRouter from "./routes/leads.js";
import sequencesRouter from "./routes/sequences.js";
import emailsRouter from "./routes/emails.js";
import calendarRouter from "./routes/calendar.js";
import analyticsRouter from "./routes/analytics.js";
import templatesRouter from "./routes/templates.js";
import conversationsRouter from "./routes/conversations.js";
import authRouter from "./routes/auth.js";
import calendlyRouter from "./routes/calendly.js";
import { seed } from "./data/seed.js";
import { hydrateFromMongo, emailTemplates } from "./data/store.js";
import { processDueActions } from "./services/automation.js";
import { isGmailConfigured } from "./services/emailService.js";
import { isCalendarConfigured } from "./services/calendarService.js";
import { isMongoConfigured } from "./data/db.js";

const app = express();
const PORT = process.env.PORT || 5000;

// CLIENT_ORIGIN may be a single URL or a comma-separated list (e.g. local dev + prod).
const allowedOrigins = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    gmailConfigured: isGmailConfigured(),
    calendarConfigured: isCalendarConfigured(),
    mongoConfigured: isMongoConfigured(),
  });
});

app.use("/api/leads", leadsRouter);
app.use("/api/sequences", sequencesRouter);
app.use("/api/emails", emailsRouter);
app.use("/api/calendar", calendarRouter);
app.use("/api/analytics", analyticsRouter);
app.use("/api/templates", templatesRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/auth", authRouter);
app.use("/api/calendly", calendlyRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const AUTOMATION_INTERVAL_MS = 60 * 1000;

async function start() {
  const mongoHydrated = await hydrateFromMongo().catch((err) => {
    console.error("[mongo] connection failed, falling back to in-memory only:", err.message);
    return false;
  });

  // Only seed demo templates into a genuinely empty database (fresh in-memory
  // run, or a brand-new Mongo database with nothing in it yet) — never on top
  // of real data already loaded from Mongo.
  if (!mongoHydrated || emailTemplates.all().length === 0) {
    seed();
  }

  setInterval(() => {
    processDueActions().catch((err) => console.error("automation tick failed", err));
  }, AUTOMATION_INTERVAL_MS);

  app.listen(PORT, () => {
    console.log(`LeadFlow API running on http://localhost:${PORT}`);
    console.log(
      `Gmail: ${isGmailConfigured() ? "live" : "mock"} | Calendar: ${isCalendarConfigured() ? "live" : "mock"} | Mongo: ${mongoHydrated ? "connected" : "in-memory only"}`
    );
  });
}

start();
