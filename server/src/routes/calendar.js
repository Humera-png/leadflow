import { Router } from "express";
import { meetings, leads } from "../data/store.js";
import { getAvailability } from "../services/calendarService.js";
import { onCallBooked } from "../services/automation.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.post("/book", async (req, res) => {
  const { leadId, scheduledTime, duration } = req.body;
  if (!leadId || !scheduledTime) {
    return res.status(400).json({ error: "leadId and scheduledTime are required" });
  }
  const lead = leads.get(leadId);
  if (!lead || lead.ownerId !== req.userId) return res.status(404).json({ error: "Lead not found" });

  const meeting = await onCallBooked(leadId, { scheduledTime, duration });
  res.status(201).json(meeting);
});

router.get("/availability", (req, res) => {
  res.json(getAvailability(req.userId));
});

router.get("/events", (req, res) => {
  const events = meetings
    .find((m) => m.ownerId === req.userId)
    .map((m) => ({ ...m, lead: leads.get(m.leadId) }));
  res.json(events.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)));
});

export default router;
