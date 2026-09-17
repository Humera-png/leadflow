import { Router } from "express";
import cors from "cors";
import multer from "multer";
import Papa from "papaparse";
import ExcelJS from "exceljs";
import { leads, sequences, conversations, users } from "../data/store.js";
import { onLeadCreated, hydrateFromImport } from "../services/automation.js";
import { requireAuth } from "../middleware/auth.js";
import { syncUserSheet } from "../services/sheetSync.js";

const router = Router();
const IMPORT_EXTENSIONS = [".csv", ".xlsx", ".xls"];
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf("."));
    if (!IMPORT_EXTENSIONS.includes(ext)) {
      return cb(new Error(`Unsupported file type "${ext}". Use one of: ${IMPORT_EXTENSIONS.join(", ")}`));
    }
    cb(null, true);
  },
});

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
    // AI-generated, per-lead personalized opening line (e.g. from a prospecting
    // pipeline that read the lead's website) — filled into templates via {{icebreaker}}.
    icebreaker: "",
    // When set, no auto-sequence email goes out to this lead until this date —
    // e.g. a prospect said "not now, check back in 6 months". Both LeadFlow's
    // own automation and any external automation (n8n, etc.) should check this
    // before sending anything.
    snoozeUntil: null,
    lastUpdated: new Date().toISOString(),
    source: "manual", // manual | import | webform | calendly — where this lead came from
    business: "", // free-text tag (e.g. "Freelance", "NaviaLabs") — one account, multiple businesses
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

router.get("/", requireAuth, (req, res) => {
  const { status, icp, company, search, business } = req.query;

  let results = leads.find((l) => l.ownerId === req.userId);
  console.log(
    `[DEBUG /api/leads] apiKey=${req.get("X-Api-Key")?.slice(0, 12)}... userId=${req.userId} totalLeadsInMemory=${leads.all().length} matchedForUser=${results.length} userAgent=${req.get("User-Agent")}`
  );
  if (status) results = results.filter((l) => l.status === status);
  if (business) results = results.filter((l) => l.business === business);
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
router.get("/export-csv", requireAuth, (req, res) => {
  const rows = leads.find((l) => l.ownerId === req.userId).map((l) => ({
    Name: l.name,
    Business: l.business ?? "",
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
    Icebreaker: l.icebreaker ?? "",
    "Next Action": l.nextAction ?? "",
    "Follow Up After": l.snoozeUntil ?? "",
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

// Flattens whatever a spreadsheet cell might contain (plain value, Date object,
// ExcelJS rich-text object, formula result) down to a plain string for the field
// parsers below, which all expect string-ish input the same way CSV rows give them.
function cellToString(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    if ("text" in value) return String(value.text);
    if (Array.isArray(value.richText)) return value.richText.map((r) => r.text).join("");
    if ("result" in value) return String(value.result); // formula cell
  }
  return String(value);
}

async function rowsFromExcel(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headers = [];
  sheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = cellToString(cell.value).trim();
  });

  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header row
    const obj = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (header) obj[header] = cellToString(cell.value);
    });
    rows.push(obj);
  });
  return rows;
}

export function rowsFromCsv(text) {
  // Strip a UTF-8 BOM if present — Excel's "CSV UTF-8" export prepends one, which
  // otherwise silently turns the first header ("Name") into an unmatchable
  // "﻿Name" and makes every row look like it's missing a name.
  const clean = text.replace(/^﻿/, "");
  const parsed = Papa.parse(clean, { header: true, skipEmptyLines: true });
  if (parsed.errors?.length) {
    const err = new Error("Failed to parse CSV");
    err.details = parsed.errors.slice(0, 5);
    throw err;
  }
  return parsed.data;
}

function normalizeHeader(key) {
  return key
    .replace(/^﻿/, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Forgiving column lookup: matches a header regardless of case, surrounding
 * whitespace, punctuation, or a stray BOM — real-world spreadsheet exports are
 * rarely byte-for-byte identical to our template headers.
 */
function field(row, ...names) {
  const targets = names.map(normalizeHeader);
  for (const key of Object.keys(row)) {
    if (targets.includes(normalizeHeader(key))) return row[key];
  }
  return undefined;
}

/** Same column mapping as the CSV template (see export-csv above), reused for every import format. */
export function insertLeadsFromRows(rows, ownerId) {
  let imported = 0;
  let skipped = 0;
  let duplicates = 0;

  // Case-insensitive lookup of this owner's existing emails, built once — re-importing
  // the same file (or syncing the same Sheet repeatedly) must never create duplicate
  // leads, it should just leave the existing one alone.
  const existingEmails = new Set(
    leads.find((l) => l.ownerId === ownerId).map((l) => l.email.toLowerCase())
  );

  for (const row of rows) {
    // Apollo (and some other CRMs) export "First Name"/"Last Name" as separate
    // columns instead of one combined "Name" column — fall back to joining them.
    const combinedName = [field(row, "First Name"), field(row, "Last Name")]
      .filter(Boolean)
      .join(" ")
      .trim();
    const name = String(field(row, "Name", "Full Name") ?? combinedName ?? "").trim();
    const email = String(field(row, "Email", "Email Address") ?? "").trim();
    if (!name || !email) {
      skipped++;
      continue;
    }
    if (existingEmails.has(email.toLowerCase())) {
      duplicates++;
      continue;
    }

    const status = normalizeStatus(field(row, "Status"));
    const dealStatusRaw = field(row, "Deal Status (Won/Lost/Pending)", "Deal Status");
    const dealStatus = VALID_DEAL_STATUSES.includes(dealStatusRaw) ? dealStatusRaw : "Pending";

    const lead = leads.insert({
      ownerId,
      name,
      business: field(row, "Business") ?? "",
      company: field(row, "Company") ?? "",
      email,
      phone: field(row, "Phone") ?? "",
      linkedinUrl: field(row, "LinkedIn URL") ?? "",
      icp: false,
      status,
      dateAdded: parseDateOrNull(field(row, "Date Added")) ?? new Date().toISOString(),
      notes: field(row, "Notes") ?? "",

      emailOneSentDate: parseDateOrNull(field(row, "Email One Sent(Date)", "Email One Sent")),
      email1Opened: parseYesNo(field(row, "Email 1 Opened")),
      emailTwoSentDate: parseDateOrNull(field(row, "Email Two Sent(Date)", "Email Two Sent")),
      email2Opened: parseYesNo(field(row, "Email 2 Opened")),
      emailThreeSentDate: parseDateOrNull(field(row, "Email Three Sent(Date)", "Email Three Sent")),
      email3Opened: parseYesNo(field(row, "Email 3 Opened")),

      lastReplyDate: parseDateOrNull(field(row, "Last Reply (Date)", "Last Reply")),
      replyMessage: field(row, "Reply Message") ?? "",

      calendarLinkSentDate: parseDateOrNull(field(row, "Calendar Link Sent (Date)", "Calendar Link Sent")),
      callBooked: parseYesNo(field(row, "Call Booked (Yes/No)", "Call Booked")),
      meetingDatetime: parseDateOrNull(field(row, "Meeting Date & Time", "Meeting Date and Time")),
      callDuration: field(row, "Call Duration (mins)", "Call Duration")
        ? parseNumber(field(row, "Call Duration (mins)", "Call Duration"), null)
        : null,

      dealStatus,
      dealValue: parseNumber(field(row, "Deal Value (₹)", "Deal Value"), 0),
      nextAction: field(row, "Next Action") ?? "",
      icebreaker: field(row, "Icebreaker") ?? "",
      snoozeUntil: parseDateOrNull(field(row, "Follow Up After", "Snooze Until")),
      lastUpdated: parseDateOrNull(field(row, "Last Updated")) ?? new Date().toISOString(),
      source: "import",
    });

    hydrateFromImport(lead);
    existingEmails.add(email.toLowerCase()); // guards against duplicate rows within the same file/sheet
    imported++;
  }

  return { imported, skipped, duplicates, total: rows.length };
}

// Accepts .csv, .xlsx, or .xls — same column mapping either way (see export-csv above
// for the exact header names). Route name kept as "import-csv" for backward
// compatibility with the existing frontend, even though it now accepts more formats.
router.post("/import-csv", requireAuth, upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: `No file uploaded (field name: file). Accepted: ${IMPORT_EXTENSIONS.join(", ")}` });
  }

  const ext = req.file.originalname.toLowerCase().slice(req.file.originalname.lastIndexOf("."));

  try {
    const rows =
      ext === ".csv" ? rowsFromCsv(req.file.buffer.toString("utf-8")) : await rowsFromExcel(req.file.buffer);
    res.status(201).json(insertLeadsFromRows(rows, req.userId));
  } catch (err) {
    res.status(400).json({ error: err.message, details: err.details });
  }
});

// Manually trigger a sync against whichever Google Sheet the account has connected
// (see /api/account/sheet-sync). Also runs automatically on an interval — see index.js.
router.post("/sync-sheet", requireAuth, async (req, res) => {
  try {
    const result = await syncUserSheet(req.user);
    if (!result) {
      return res.status(400).json({ error: "No Google Sheet connected yet — add one in Settings first." });
    }
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public inbound lead-capture form endpoint — meant to be embedded on an external site
// (see client CapturePage.jsx), so it gets its own permissive CORS and light rate
// limiting rather than sharing the app-wide CLIENT_ORIGIN restriction in index.js.
// Resolves which account a lead belongs to via a low-privilege "capture token" in the
// URL (?key=...) — safe to expose in a public embed, unlike the full API key.
router.options("/capture", cors());
router.post("/capture", cors(), (req, res) => {
  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many submissions, try again later" });
  }

  const captureToken = req.query.key || req.body.key;
  const owner = users.findOne((u) => u.captureToken === captureToken);
  if (!owner) {
    return res.status(400).json({ error: "Invalid or missing capture key" });
  }

  // Optional — lets you run separate embeds per business (e.g. ?key=...&business=Freelance)
  // while still landing in the same account.
  const business = req.query.business || req.body.business || "";

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
    ownerId: owner._id,
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
    business,
    source: "webform",
  });

  onLeadCreated(lead); // fresh inbound lead -> normal auto-sequence applies
  res.status(201).json({ ok: true });
});

router.get("/:id", requireAuth, (req, res) => {
  const lead = leads.get(req.params.id);
  if (!lead || lead.ownerId !== req.userId) return res.status(404).json({ error: "Lead not found" });
  res.json(lead);
});

// Powers both the plain "Add Lead" flow and the richer Quick Add modal (which can
// pre-fill status/reply/deal info for a lead that already has some history).
router.post("/", requireAuth, (req, res) => {
  const {
    name,
    business,
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
    ownerId: req.userId,
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
    business: business ?? "",
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

router.put("/:id", requireAuth, (req, res) => {
  const existing = leads.get(req.params.id);
  if (!existing || existing.ownerId !== req.userId) return res.status(404).json({ error: "Lead not found" });

  const { _id, dateAdded, ownerId, ...patch } = req.body;
  const updated = leads.update(req.params.id, { ...patch, lastUpdated: new Date().toISOString() });
  res.json(updated);
});

router.delete("/:id", requireAuth, (req, res) => {
  const existing = leads.get(req.params.id);
  if (!existing || existing.ownerId !== req.userId) return res.status(404).json({ error: "Lead not found" });

  leads.remove(req.params.id);
  const sequence = sequences.findOne((s) => s.leadId === req.params.id);
  if (sequence) sequences.remove(sequence._id);
  const convo = conversations.findOne((c) => c.leadId === req.params.id);
  if (convo) conversations.remove(convo._id);

  res.status(204).end();
});

/** Bulk actions: change status or add a note-tag across multiple leads at once. */
router.patch("/bulk", requireAuth, (req, res) => {
  const { ids, status, tag, business } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array is required" });
  }

  const updated = ids.map((id) => {
    const lead = leads.get(id);
    if (!lead || lead.ownerId !== req.userId) return null;

    const patch = { lastUpdated: new Date().toISOString() };
    if (status) patch.status = status;
    if (business !== undefined) patch.business = business;
    if (tag) {
      patch.notes = lead.notes ? `${lead.notes} #${tag}` : `#${tag}`;
    }
    return leads.update(id, patch);
  });

  res.json(updated.filter(Boolean));
});

export default router;
