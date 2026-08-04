import { Router } from "express";
import { conversations } from "../data/store.js";

const router = Router();

router.get("/:leadId", (req, res) => {
  const convo = conversations.findOne((c) => c.leadId === req.params.leadId);
  res.json(
    convo ?? { leadId: req.params.leadId, messages: [], callNotes: [], dealValue: null, dealStatus: "open" }
  );
});

router.post("/:leadId/call-notes", (req, res) => {
  const { notes, nextSteps } = req.body;
  let convo = conversations.findOne((c) => c.leadId === req.params.leadId);
  if (!convo) {
    convo = conversations.insert({
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
