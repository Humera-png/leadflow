import { leads, sequences, conversations, emailTemplates, meetings, notifications } from "../data/store.js";
import { sendPush } from "./pushService.js";
import { sendEmail, renderTemplate } from "./emailService.js";
import { createEvent } from "./calendarService.js";

const DAY_MS = 24 * 60 * 60 * 1000;

function nextMorning(from = new Date()) {
  const d = new Date(from);
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function daysFromNow(days) {
  return new Date(Date.now() + days * DAY_MS).toISOString();
}

/** All lead mutations go through here so `lastUpdated` always reflects reality. */
function touchLead(leadId, patch) {
  return leads.update(leadId, { ...patch, lastUpdated: new Date().toISOString() });
}

/**
 * In-app bell-icon alert + a real phone/browser push notification — both
 * independent of Slack. Push is fire-and-forget so a slow/failed push never
 * blocks the actual automation step that triggered it.
 */
function notify(ownerId, { type, message, leadId }) {
  if (!ownerId) return;
  notifications.insert({ ownerId, type, message, leadId: leadId ?? null, read: false, createdAt: new Date().toISOString() });
  sendPush(ownerId, { title: "LeadFlow", body: message, url: leadId ? `/leads/${leadId}` : "/" }).catch((err) =>
    console.error("[push] send failed:", err.message)
  );
}

function getOrCreateConversation(leadId) {
  let convo = conversations.findOne((c) => c.leadId === leadId);
  if (!convo) {
    convo = conversations.insert({
      ownerId: leads.get(leadId)?.ownerId ?? null,
      leadId,
      messages: [],
      callNotes: [],
      dealValue: null,
      dealStatus: "open",
    });
  }
  return convo;
}

function appendMessage(leadId, { from, to, content, type, templateId = null }) {
  const convo = getOrCreateConversation(leadId);
  convo.messages.push({ date: new Date().toISOString(), from, to, content, type, templateId });
  conversations.update(convo._id, { messages: convo.messages });
  return convo;
}

/** Step 1: lead added -> cold, sequence created, email #1 scheduled for tomorrow morning. */
export function onLeadCreated(lead) {
  const sequence = sequences.insert({
    ownerId: lead.ownerId,
    leadId: lead._id,
    email1Sent: { date: null, response: null },
    email2Sent: { date: null, response: null },
    email3Sent: { date: null, response: null },
    callBooked: { date: null, time: null },
    dealClosed: { date: null, amount: null },
    followUpDate: nextMorning(),
    lastActivity: new Date().toISOString(),
  });
  getOrCreateConversation(lead._id);
  return sequence;
}

const TEMPLATE_ORDER = [
  { field: "email1Sent", templateIndex: 0, delayDays: 5, sentDateField: "emailOneSentDate" },
  { field: "email2Sent", templateIndex: 1, delayDays: 5, sentDateField: "emailTwoSentDate" },
  { field: "email3Sent", templateIndex: 2, delayDays: null, sentDateField: "emailThreeSentDate" },
];

async function sendNextSequenceEmail(sequence) {
  const lead = leads.get(sequence.leadId);
  if (!lead || lead.status !== "cold") return null;
  // Snoozed lead ("not now, check back later") — skip until the date passes.
  if (lead.snoozeUntil && new Date(lead.snoozeUntil) > new Date()) return null;

  const step = TEMPLATE_ORDER.find((s) => !sequence[s.field]?.date);
  if (!step) return null;

  const templates = emailTemplates.all();
  const template = templates[step.templateIndex];
  if (!template) return null;

  const { subject, body } = renderTemplate(template, lead);
  const { sentAt } = await sendEmail({ to: lead.email, subject, body, leadId: lead._id });

  appendMessage(lead._id, {
    from: "you",
    to: lead.email,
    content: `${subject}\n\n${body}`,
    type: "email",
    templateId: template._id,
  });

  const updated = sequences.update(sequence._id, {
    [step.field]: { date: sentAt, response: null },
    followUpDate: step.delayDays ? daysFromNow(step.delayDays) : null,
    lastActivity: sentAt,
  });

  touchLead(lead._id, { [step.sentDateField]: sentAt });

  return updated;
}

/** Called on an interval (and manually) to fire any due sequence emails. */
export async function processDueActions(now = new Date()) {
  const due = sequences.find(
    (s) => s.followUpDate && new Date(s.followUpDate) <= now
  );
  const results = [];
  for (const sequence of due) {
    const updated = await sendNextSequenceEmail(sequence);
    if (updated) results.push(updated);
  }
  return results;
}

/**
 * Step: reply received -> lead goes warm, conversation logged, auto-sequence paused.
 * Idempotent against the exact same reply text being submitted again — protects
 * against an external automation (e.g. polling every 15 min without its own dedup)
 * re-detecting the same reply and re-firing this over and over.
 */
export function onReplyReceived(leadId, content) {
  const lead = leads.get(leadId);
  if (!lead) return null;
  if (lead.replyMessage === content) return { suggestion: "Schedule a call?", alreadyProcessed: true };

  const now = new Date().toISOString();
  touchLead(leadId, { status: "warm", lastReplyDate: now, replyMessage: content });
  appendMessage(leadId, { from: leadId, to: "you", content, type: "reply" });
  notify(lead.ownerId, { type: "reply", message: `${lead.name} replied: "${content}"`, leadId });

  const sequence = sequences.findOne((s) => s.leadId === leadId);
  if (sequence) {
    sequences.update(sequence._id, { followUpDate: null, lastActivity: now });
  }

  return { suggestion: "Schedule a call?" };
}

/**
 * Step: call booked -> Calendar event created, lead goes hot.
 * Idempotent against the exact same booking being submitted again — without this,
 * a redundant call (e.g. an external automation re-detecting "callBooked: true" on
 * every poll) would create a duplicate real Google Calendar event + duplicate real
 * invite email to the lead each time.
 */
export async function onCallBooked(leadId, { scheduledTime, duration = 30 }) {
  const lead = leads.get(leadId);
  if (!lead) return null;

  if (lead.callBooked && lead.meetingDatetime === scheduledTime) {
    const existing = meetings.findOne((m) => m.leadId === leadId && m.scheduledTime === scheduledTime);
    if (existing) return { ...existing, alreadyProcessed: true };
  }

  const meeting = await createEvent({ leadId, scheduledTime, duration });
  const now = new Date().toISOString();
  touchLead(leadId, {
    status: "hot",
    callBooked: true,
    meetingDatetime: scheduledTime,
    callDuration: duration,
  });

  const sequence = sequences.findOne((s) => s.leadId === leadId);
  if (sequence) {
    sequences.update(sequence._id, {
      callBooked: { date: now, time: scheduledTime },
      lastActivity: now,
    });
  }

  appendMessage(leadId, {
    from: "you",
    to: leadId,
    content: `Call booked for ${scheduledTime}`,
    type: "system",
  });
  notify(lead.ownerId, { type: "call_booked", message: `Call booked with ${lead.name} for ${new Date(scheduledTime).toLocaleString()}`, leadId });

  return meeting;
}

/**
 * Step: deal closed -> lead becomes a customer.
 * Idempotent once a deal is already Won — protects against duplicate "deal closed"
 * conversation entries/notifications from a redundant re-processing call.
 */
export function onDealClosed(leadId, amount) {
  const lead = leads.get(leadId);
  if (!lead) return null;
  if (lead.dealStatus === "Won") {
    return { ...sequences.findOne((s) => s.leadId === leadId), alreadyProcessed: true };
  }

  const now = new Date().toISOString();
  touchLead(leadId, { status: "customer", dealStatus: "Won", dealValue: amount });

  const sequence = sequences.findOne((s) => s.leadId === leadId);
  if (sequence) {
    sequences.update(sequence._id, { dealClosed: { date: now, amount }, lastActivity: now });
  }

  const convo = getOrCreateConversation(leadId);
  conversations.update(convo._id, { dealValue: amount, dealStatus: "won" });

  appendMessage(leadId, {
    from: "you",
    to: leadId,
    content: `Deal closed: ₹${amount}`,
    type: "system",
  });
  notify(lead.ownerId, { type: "deal_closed", message: `Deal closed with ${lead.name} — ₹${Number(amount).toLocaleString("en-IN")}`, leadId });

  return sequences.findOne((s) => s.leadId === leadId);
}

/**
 * Builds a Sequence/Conversation record from a fully-populated (e.g. CSV-imported)
 * lead so the Lead Detail timeline/history stay consistent with imported data.
 * Deliberately does NOT schedule further auto-sends (followUpDate: null) — imported
 * rows represent real contacts with real history, not brand-new leads to cold-email.
 */
export function hydrateFromImport(lead) {
  sequences.insert({
    ownerId: lead.ownerId,
    leadId: lead._id,
    email1Sent: { date: lead.emailOneSentDate || null, response: null },
    email2Sent: { date: lead.emailTwoSentDate || null, response: null },
    email3Sent: { date: lead.emailThreeSentDate || null, response: null },
    callBooked: { date: lead.callBooked ? lead.lastUpdated : null, time: lead.meetingDatetime || null },
    dealClosed: {
      date: lead.dealStatus === "Won" ? lead.lastUpdated : null,
      amount: lead.dealValue || null,
    },
    followUpDate: null,
    lastActivity: lead.lastUpdated,
  });

  const convo = getOrCreateConversation(lead._id);
  const messages = [];
  if (lead.emailOneSentDate) {
    messages.push({ date: lead.emailOneSentDate, from: "you", to: lead.email, content: "Email #1 (imported)", type: "email", templateId: null });
  }
  if (lead.emailTwoSentDate) {
    messages.push({ date: lead.emailTwoSentDate, from: "you", to: lead.email, content: "Email #2 (imported)", type: "email", templateId: null });
  }
  if (lead.emailThreeSentDate) {
    messages.push({ date: lead.emailThreeSentDate, from: "you", to: lead.email, content: "Email #3 (imported)", type: "email", templateId: null });
  }
  if (lead.replyMessage) {
    messages.push({ date: lead.lastReplyDate || lead.lastUpdated, from: lead._id, to: "you", content: lead.replyMessage, type: "reply", templateId: null });
  }
  messages.sort((a, b) => new Date(a.date) - new Date(b.date));
  conversations.update(convo._id, { messages });
}
