import { Router } from "express";
import cors from "cors";
import multer from "multer";
import Papa from "papaparse";
import { leads, sequences, conversations } from "../data/store.js";
import { onLeadCreated, hydrateFromImport } from "../services/automation.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// "followup" = they said "not now, maybe later" — distinct from "rejected" (hard no).
const VALID_STATUSES = ["cold", "warm", "hot", "followup", "rejected", "customer"];
const VALID_DEAL_STATUSES = ["Pending", "Won", "Lost"];

function newLeadDefaults() {
  return {
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
    source: "manual", // manual | import | webform — where this lead came from
  };
}

// Tiny in-memory sliding-window limiter for the public capture endpoint (no auth,
// reachable from anywhere it's embedded, so it needs some abuse protection).
const CAPTURE_WINDOW_MS = 60 * 60 * 1000;
const CAPTURE_MAX_PER_WINDOW = 10;
const captureHits = new Map(); // ip -> timestamps[]

function isRateLimited(ip) {
  const now = Date.now();
  const hits = (captureHits.get(ip) ?? []).filter((t) => now - t < CAPTURE_WINDOW_MS);
  hits.push(now);
  captureHits.set(ip, hits);
  return hits.length > CAPTURE_MAX_PER_WINDOW;
}

function parseDateOrNull(value) {
  if (!value || !String(value).trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function parseYesNo(value) {
  return ["yes", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
}

function parseNumber(value, fallback = 0) {
  if (value === null || value === undefined || value === "") return fallback;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? fallback : n;
}

// Accepts loose spreadsheet text ("Follow-up Later", "follow up later") and maps it
// to our internal status slug. Falls back to "cold" for anything unrecognized.
const STATUS_ALIASES = Object.fromEntries(
  VALID_STATUSES.map((s) => [s, s]).concat([["followuplater", "followup"]])
);
function normalizeStatus(raw) {
  const key = String(raw ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return STATUS_ALIASES[key] ?? "cold";
}

router.get("/", (req, res) => {
  const { status, icp, company, search } = req.query;

  let results = leads.all();
  if (status) results = results.filter((l) => l.status === status);
  if (icp) results = results.filter((l) => String(l.icp) === String(icp === "true"));
  if (company) {
    results = results.filter((l) =>
      l.company?.toLowerCase().includes(String(company).toLowerCase())
    );
  }
  if (search) {
    const q = String(search).toLowerCase();
    results = results.filter(
      (l) =>
        l.name?.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q)
    );
  }

  results = [...results].sort(
    (a, b) => new Date(b.dateAdded) - new Date(a.dateAdded)
  );

  res.json(results);
});

// CSV export/import must be declared before "/:id" so they aren't swallowed by that route.
router.get("/export-csv", (req, res) => {
  const rows = leads.all().map((l) => ({
    Name: l.name,
    Company: l.company,
    Email: l.email,
    Phone: l.phone,
    "LinkedIn URL": l.linkedinUrl,
    Status: l.status,
    "Date Added": l.dateAdded,
    "Email One Sent(Date)": l.emailOneSentDate ?? "",
    "Email 1 Opened": l.email1Opened ? "Yes" : "No",
    "Email Two Sent(Date)": l.emailTwoSentDate ?? "",
    "Email 2 Opened": l.email2Opened ? "Yes" : "No",
    "Email Three Sent(Date)": l.emailThreeSentDate ?? "",
    "Email 3 Opened": l.email3Opened ? "Yes" : "No",
    "Last Reply (Date)": l.lastReplyDate ?? "",
    "Reply Message": l.replyMessage ?? "",
    "Calendar Link Sent (Date)": l.calendarLinkSentDate ?? "",
    "Call Booked (Yes/No)": l.callBooked ? "Yes" : "No",
    "Meeting Date & Time": l.meetingDatetime ?? "",
    "Call Duration (mins)": l.callDuration ?? "",
    "Deal Status (Won/Lost/Pending)": l.dealStatus ?? "Pending",
    "Deal Value (₹)": l.dealValue ?? 0,
    Notes: l.notes ?? "",
    "Next Action": l.nextAction ?? "",
    "Last Updated": l.lastUpdated ?? "",
    Source: l.source ?? "manual",
  }));

  const csv = Papa.unparse(rows);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="leadflow-leads-${new Date().toISOString().slice(0, 10)}.csv"`
  );
  res.send(csv);
});

router.post("/import-csv", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No CSV file uploaded (field name: file)" });

  const parsed = Papa.parse(req.file.buffer.toString("utf-8"), {
    header: true,
    skipEmptyLines: true,
  });

  if (parsed.errors?.length) {
    return res.status(400).json({ error: "Failed to parse CSV", details: parsed.errors.slice(0, 5) });
  }

  let imported = 0;
  let skipped = 0;

  for (const row of parsed.data) {
    const name = row.Name?.trim();
    const email = row.Email?.trim();
    if (!name || !email) {
      skipped++;
      continue;
    }

    const status = normalizeStatus(row.Status);
    const dealStatus = VALID_DEAL_STATUSES.includes(row["Deal Status (Won/Lost/Pending)"])
      ? row["Deal Status (Won/Lost/Pending)"]
      : "Pending";

    const lead = leads.insert({
      name,
      company: row.Company ?? "",
      email,
      phone: row.Phone ?? "",
      linkedinUrl: row["LinkedIn URL"] ?? "",
      icp: false,
      status,
      dateAdded: parseDateOrNull(row["Date Added"]) ?? new Date().toISOString(),
      notes: row.Notes ?? "",

      emailOneSentDate: parseDateOrNull(row["Email One Sent(Date)"]),
      email1Opened: parseYesNo(row["Email 1 Opened"]),
      emailTwoSentDate: parseDateOrNull(row["Email Two Sent(Date)"]),
      email2Opened: parseYesNo(row["Email 2 Opened"]),
      emailThreeSentDate: parseDateOrNull(row["Email Three Sent(Date)"]),
      email3Opened: parseYesNo(row["Email 3 Opened"]),

      lastReplyDate: parseDateOrNull(row["Last Reply (Date)"]),
      replyMessage: row["Reply Message"] ?? "",

      calendarLinkSentDate: parseDateOrNull(row["Calendar Link Sent (Date)"]),
      callBooked: parseYesNo(row["Call Booked (Yes/No)"]),
      meetingDatetime: parseDateOrNull(row["Meeting Date & Time"]),
      callDuration: row["Call Duration (mins)"] ? parseNumber(row["Call Duration (mins)"], null) : null,

      dealStatus,
      dealValue: parseNumber(row["Deal Value (₹)"], 0),
      nextAction: row["Next Action"] ?? "",
      lastUpdated: parseDateOrNull(row["Last Updated"]) ?? new Date().toISOString(),
      source: "import",
    });

    hydrateFromImport(lead);
    imported++;
  }

  res.status(201).json({ imported, skipped, total: parsed.data.length });
});

// Public inbound lead-capture form endpoint — meant to be embedded on an external site
// (see client CapturePage.jsx), so it gets its own permissive CORS and light rate
// limiting rather than sharing the app-wide CLIENT_ORIGIN restriction in index.js.
router.options("/capture", cors());
router.post("/capture", cors(), (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many submissions, try again later" });
  }

  const { name, email, company, phone, message, website } = req.body;

  // Honeypot: real visitors never see or fill this hidden field, bots often do.
  // Pretend success so bots don't learn to avoid the field.
  if (website) {
    return res.status(201).json({ ok: true });
  }

  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  const now = new Date().toISOString();
  const lead = leads.insert({
    name,
    company: company ?? "",
    email,
    phone: phone ?? "",
    linkedinUrl: "",
    icp: false,
    status: "cold",
    dateAdded: now,
    notes: message ?? "",
    ...newLeadDefaults(),
    source: "webform",
  });

  onLeadCreated(lead); // fresh inbound lead -> normal auto-sequence applies
  res.status(201).json({ ok: true });
});

router.get("/:id", (req, res) => {
  const lead = leads.get(req.params.id);
  if (!lead) return res.status(404).json({ error: "Lead not found" });
  res.json(lead);
});

// Powers both the plain "Add Lead" flow and the richer Quick Add modal (which can
// pre-fill status/reply/deal info for a lead that already has some history).
router.post("/", (req, res) => {
  const {
    name,
    company,
    email,
    phone,
    linkedinUrl,
    icp,
    notes,
    status,
    messageSent, // Quick Add's "message sent or not" toggle
    lastReplyDate,
    replyMessage,
    nextAction,
    dealStatus,
    dealValue,
  } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: "name and email are required" });
  }

  const resolvedStatus = VALID_STATUSES.includes(status) ? status : "cold";
  const now = new Date().toISOString();

  const lead = leads.insert({
    name,
    company: company ?? "",
    email,
    phone: phone ?? "",
    linkedinUrl: linkedinUrl ?? "",
    icp: Boolean(icp),
    status: resolvedStatus,
    dateAdded: now,
    notes: notes ?? "",
    ...newLeadDefaults(),
    emailOneSentDate: messageSent ? now : null,
    lastReplyDate: parseDateOrNull(lastReplyDate),
    replyMessage: replyMessage ?? "",
    nextAction: nextAction ?? "",
    dealStatus: VALID_DEAL_STATUSES.includes(dealStatus) ? dealStatus : "Pending",
    dealValue: parseNumber(dealValue, 0),
  });

  // A brand-new, never-contacted cold lead hands off to the normal automation engine
  // (schedules email #1 for tomorrow morning). Anything with prior history — already
  // emailed, already replied, or starting at a later status — skips auto-send and just
  // gets its Sequence/Conversation records hydrated instead, same as a CSV import.
  const isFreshLead = resolvedStatus === "cold" && !messageSent && !lastReplyDate;
  if (isFreshLead) {
    onLeadCreated(lead);
  } else {
    hydrateFromImport(lead);
  }

  res.status(201).json(lead);
});

router.put("/:id", (req, res) => {
  const existing = leads.get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Lead not found" });

  const { _id, dateAdded, ...patch } = req.body;
  const updated = leads.update(req.params.id, { ...patch, lastUpdated: new Date().toISOString() });
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const existing = leads.get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Lead not found" });

  leads.remove(req.params.id);
  const sequence = sequences.findOne((s) => s.leadId === req.params.id);
  if (sequence) sequences.remove(sequence._id);
  const convo = conversations.findOne((c) => c.leadId === req.params.id);
  if (convo) conversations.remove(convo._id);

  res.status(204).end();
});

/** Bulk actions: change status or add a note-tag across multiple leads at once. */
router.patch("/bulk", (req, res) => {
  const { ids, status, tag } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
  }

  const updated = ids.map((id) => {
    const patch = { lastUpdated: new Date().toISOString() };
    if (status) patch.status = status;
    if (tag) {
      const lead = leads.get(id);
      patch.notes = lead ? `${lead.notes ? lead.notes + " " : ""}#${tag}` : `#${tag}`;
    }
    return leads.update(id, patch);
  });

  res.json(updated.filter(Boolean));
});

export default router;
