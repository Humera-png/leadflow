import { Router } from "express";
import { conversations, leads } from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function ownedLead(leadId, userId) {
  const lead = leads.get(leadId);
  return lead && lead.ownerId === userId ? lead : null;
}

router.get("/:leadId", (req, res) => {
  if (!ownedLead(req.params.leadId, req.userId)) return res.status(404).json({ error: "Lead not found" });

  const convo = conversations.findOne((c) => c.leadId === req.params.leadId);
  res.json(
    convo ?? { leadId: req.params.leadId, messages: [], callNotes: [], dealValue: null, dealStatus: "open" }
  );
});

router.post("/:leadId/call-notes", (req, res) => {
  if (!ownedLead(req.params.leadId, req.userId)) return res.status(404).json({ error: "Lead not found" });

  const { notes, nextSteps } = req.body;
  let convo = conversations.findOne((c) => c.leadId === req.params.leadId);
  if (!convo) {
    convo = conversations.insert({
      ownerId: req.userId,
      leadId: req.params.leadId,
      messages: [],
      callNotes: [],
      dealValue: null,
      dealStatus: "open",
    });
  }
  convo.callNotes.push({ date: new Date().toISOString(), notes, nextSteps });
  const updated = conversations.update(convo._id, { callNotes: convo.callNotes });
  res.status(201).json(updated);
});

export default router;
