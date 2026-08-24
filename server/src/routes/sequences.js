import { Router } from "express";
import { sequences, leads } from "../data/store.js";
import {
  onLeadCreated,
  processDueActions,
  onReplyReceived,
  onCallBooked,
  onDealClosed,
} from "../services/automation.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function ownedLead(leadId, userId) {
  const lead = leads.get(leadId);
  return lead && lead.ownerId === userId ? lead : null;
}

router.post("/", (req, res) => {
  const { leadId } = req.body;
  const lead = ownedLead(leadId, req.userId);
  if (!lead) return res.status(404).json({ error: "Lead not found" });

  const existing = sequences.findOne((s) => s.leadId === leadId);
  if (existing) return res.status(200).json(existing);

  const sequence = onLeadCreated(lead);
  res.status(201).json(sequence);
});

router.get("/:leadId", (req, res) => {
  if (!ownedLead(req.params.leadId, req.userId)) return res.status(404).json({ error: "Lead not found" });
  const sequence = sequences.findOne((s) => s.leadId === req.params.leadId);
  if (!sequence) return res.status(404).json({ error: "Sequence not found" });
  res.json(sequence);
});

router.put("/:leadId", (req, res) => {
  if (!ownedLead(req.params.leadId, req.userId)) return res.status(404).json({ error: "Lead not found" });
  const sequence = sequences.findOne((s) => s.leadId === req.params.leadId);
  if (!sequence) return res.status(404).json({ error: "Sequence not found" });

  const { _id, leadId, ...patch } = req.body;
  const updated = sequences.update(sequence._id, patch);
  res.json(updated);
});

/** Manually trigger whichever send-email/etc. is next due, instead of waiting for the automation tick. */
router.post("/:leadId/send-email", async (req, res) => {
  if (!ownedLead(req.params.leadId, req.userId)) return res.status(404).json({ error: "Lead not found" });
  const sequence = sequences.findOne((s) => s.leadId === req.params.leadId);
  if (!sequence) return res.status(404).json({ error: "Sequence not found" });

  await processDueActions(
    new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // force "due" regardless of schedule
  );
  const updated = sequences.get(sequence._id);
  res.json(updated);
});

/** Demo helper standing in for the real Gmail reply webhook. */
router.post("/:leadId/simulate-reply", (req, res) => {
  if (!ownedLead(req.params.leadId, req.userId)) return res.status(404).json({ error: "Lead not found" });
  const { content = "Thanks for reaching out, tell me more!" } = req.body;
  const result = onReplyReceived(req.params.leadId, content);
  if (!result) return res.status(404).json({ error: "Lead not found" });
  res.json(result);
});

router.post("/:leadId/book-call", async (req, res) => {
  if (!ownedLead(req.params.leadId, req.userId)) return res.status(404).json({ error: "Lead not found" });
  const { scheduledTime, duration } = req.body;
  if (!scheduledTime) {
    return res.status(400).json({ error: "scheduledTime is required" });
  }
  const meeting = await onCallBooked(req.params.leadId, { scheduledTime, duration });
  if (!meeting) return res.status(404).json({ error: "Lead not found" });
  res.status(201).json(meeting);
});

router.post("/:leadId/close-deal", (req, res) => {
  if (!ownedLead(req.params.leadId, req.userId)) return res.status(404).json({ error: "Lead not found" });
  const { amount } = req.body;
  const sequence = onDealClosed(req.params.leadId, amount);
  if (!sequence) return res.status(404).json({ error: "Lead not found" });
  res.json(sequence);
});

export default router;
