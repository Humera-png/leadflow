import { Router } from "express";
import { meetings, leads } from "../data/store.js";
import { getAvailability } from "../services/calendarService.js";
import { onCallBooked } from "../services/automation.js";

const router = Router();

router.post("/book", (req, res) => {
  const { leadId, scheduledTime, duration } = req.body;
  if (!leadId || !scheduledTime) {
    return res.status(400).json({ error: "leadId and scheduledTime are required" });
  }
  const meeting = onCallBooked(leadId, { scheduledTime, duration });
  if (!meeting) return res.status(404).json({ error: "Lead not found" });
  res.status(201).json(meeting);
});

router.get("/availability", (req, res) => {
  res.json(getAvailability());
});

router.get("/events", (req, res) => {
  const events = meetings.all().map((m) => ({
    ...m,
    lead: leads.get(m.leadId),
  }));
  res.json(events.sort((a, b) => new Date(a.scheduledTime) - new Date(b.scheduledTime)));
});

export default router;
