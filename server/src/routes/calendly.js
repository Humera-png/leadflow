import { Router } from "express";
import { leads } from "../data/store.js";
import { onCallBooked, onLeadCreated } from "../services/automation.js";
import {
  exchangeCodeForTokens,
  getCurrentUser,
  ensureWebhookSubscription,
  isCalendlyConfigured,
} from "../services/calendlyService.js";

const router = Router();

function authorizeUrl() {
  const params = new URLSearchParams({
    client_id: process.env.CALENDLY_CLIENT_ID,
    response_type: "code",
    redirect_uri: process.env.CALENDLY_REDIRECT_URI,
  });
  return `https://auth.calendly.com/oauth/authorize?${params}`;
}

/** One-time setup: visit this to connect your Calendly account. */
router.get("/connect", (req, res) => {
  if (!process.env.CALENDLY_CLIENT_ID || !process.env.CALENDLY_CLIENT_SECRET) {
    return res.status(400).send("Set CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET env vars first.");
  }
  res.redirect(authorizeUrl());
});

router.get("/callback", async (req, res) => {
  if (req.query.error) return res.status(400).send(`Calendly OAuth error: ${req.query.error}`);

  try {
    const tokens = await exchangeCodeForTokens(req.query.code);
    res.send(`
      <html><body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h2>Calendly connected ✅</h2>
        <p>Copy these into your environment variables (<code>server/.env</code> locally,
        <code>railway variable set</code> in production), then restart the server:</p>
        <pre style="background:#f4f4f4; padding:16px; border-radius:8px; word-break:break-all;">CALENDLY_ACCESS_TOKEN=${tokens.access_token}
CALENDLY_REFRESH_TOKEN=${tokens.refresh_token}</pre>
        <p>After restarting, visit <a href="/api/calendly/setup-webhook">/api/calendly/setup-webhook</a>
        once to register the booking webhook.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`Calendly token exchange failed: ${err.message}`);
  }
});

/** Registers the webhook so real Calendly bookings notify this app. Run once after connecting. */
router.get("/setup-webhook", async (req, res) => {
  if (!isCalendlyConfigured()) {
    return res.status(400).json({ error: "Calendly isn't configured yet — connect via /api/calendly/connect first" });
  }
  try {
    const me = await getCurrentUser();
    const webhookUrl = `${process.env.PUBLIC_BASE_URL ?? ""}/api/calendly/webhook`;
    const subscription = await ensureWebhookSubscription({
      webhookUrl,
      organizationUri: me.current_organization,
      userUri: me.uri,
    });
    res.json({ ok: true, webhookUrl, schedulingUrl: me.scheduling_url, subscription });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Real scheduling link to share with leads — shown on the Calendar page. */
router.get("/booking-link", async (req, res) => {
  if (!isCalendlyConfigured()) return res.json({ schedulingUrl: null });
  try {
    const me = await getCurrentUser();
    res.json({ schedulingUrl: me.scheduling_url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** Calendly calls this when a lead books/cancels a real meeting on your scheduling link. */
router.post("/webhook", async (req, res) => {
  const { event, payload } = req.body;
  if (event !== "invitee.created") return res.status(200).end(); // ack cancellations etc without action

  const email = payload?.email;
  const name = payload?.name ?? "Calendly booking";
  const scheduledTime = payload?.scheduled_event?.start_time;
  if (!email || !scheduledTime) return res.status(200).end();

  let lead = leads.findOne((l) => l.email === email);
  if (!lead) {
    lead = leads.insert({
      name,
      company: "",
      email,
      phone: "",
      linkedinUrl: "",
      icp: false,
      status: "cold",
      dateAdded: new Date().toISOString(),
      notes: "Booked via Calendly",
      emailOneSentDate: null,
      email1Opened: false,
      emailTwoSentDate: null,
      email2Opened: false,
      emailThreeSentDate: null,
      email3Opened: false,
      lastReplyDate: null,
      replyMessage: "",
      calendarLinkSentDate: null,
      callBooked: false,
      meetingDatetime: null,
      callDuration: null,
      dealStatus: "Pending",
      dealValue: 0,
      nextAction: "",
      lastUpdated: new Date().toISOString(),
      source: "calendly",
    });
    onLeadCreated(lead);
  }

  await onCallBooked(lead._id, { scheduledTime, duration: 30 });
  res.status(200).end();
});

export default router;
