import { Router } from "express";
import { conversations, leads } from "../data/store.js";
import { sendEmail } from "../services/emailService.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

// 1x1 transparent GIF, used for open-tracking pixels.
const TRACKING_PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7",
  "base64"
);

router.post("/send", requireAuth, async (req, res) => {
  const { leadId, subject, body } = req.body;
  const lead = leads.get(leadId);
  if (!lead || lead.ownerId !== req.userId) return res.status(404).json({ error: "Lead not found" });

  const result = await sendEmail({ to: lead.email, subject, body, leadId });

  const convo =
    conversations.findOne((c) => c.leadId === leadId) ??
    conversations.insert({ ownerId: req.userId, leadId, messages: [], callNotes: [], dealValue: null, dealStatus: "open" });

  convo.messages.push({
    date: result.sentAt,
    from: "you",
    to: lead.email,
    content: `${subject}\n\n${body}`,
    type: "email",
  });
  conversations.update(convo._id, { messages: convo.messages });

  res.status(201).json(result);
});

router.get("/:leadId", requireAuth, (req, res) => {
  const lead = leads.get(req.params.leadId);
  if (!lead || lead.ownerId !== req.userId) return res.status(404).json({ error: "Lead not found" });

  const convo = conversations.findOne((c) => c.leadId === req.params.leadId);
  res.json(convo?.messages.filter((m) => m.type === "email" || m.type === "reply") ?? []);
});

// Deliberately unauthenticated — this URL is embedded as an <img> tag inside outgoing
// emails and hit by the recipient's mail client, which has no LeadFlow credentials.
router.get("/:leadId/open", (req, res) => {
  const convo = conversations.findOne((c) => c.leadId === req.params.leadId);
  if (convo) {
    convo.messages.push({
      date: new Date().toISOString(),
      from: req.params.leadId,
      to: "you",
      content: "Email opened",
      type: "open",
    });
    conversations.update(convo._id, { messages: convo.messages });
  }

  // Mark the earliest sent-but-unopened email as opened (pixel doesn't identify which email).
  const lead = leads.get(req.params.leadId);
  if (lead) {
    if (lead.emailOneSentDate && !lead.email1Opened) {
      leads.update(lead._id, { email1Opened: true, lastUpdated: new Date().toISOString() });
    } else if (lead.emailTwoSentDate && !lead.email2Opened) {
      leads.update(lead._id, { email2Opened: true, lastUpdated: new Date().toISOString() });
    } else if (lead.emailThreeSentDate && !lead.email3Opened) {
      leads.update(lead._id, { email3Opened: true, lastUpdated: new Date().toISOString() });
    }
  }

  res.set("Content-Type", "image/gif");
  res.send(TRACKING_PIXEL);
});

export default router;
