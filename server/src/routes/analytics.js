import { Router } from "express";
import { leads, sequences, meetings, conversations, emailTemplates } from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

function countByStatus(ownerId) {
  const counts = { cold: 0, warm: 0, hot: 0, followup: 0, rejected: 0, customer: 0 };
  for (const lead of leads.find((l) => l.ownerId === ownerId)) {
    if (counts[lead.status] !== undefined) counts[lead.status]++;
  }
  return counts;
}

router.get("/dashboard", (req, res) => {
  const myLeads = leads.find((l) => l.ownerId === req.userId);
  const total = myLeads.length;
  const counts = countByStatus(req.userId);
  const callsBooked = meetings.find((m) => m.ownerId === req.userId).length;
  const dealsClosed = sequences.find((s) => s.ownerId === req.userId && s.dealClosed?.amount).length;
  // Reply tracking lives on the flat Lead record (lastReplyDate), not the Sequence —
  // the Sequence's email*Sent.response field is legacy and never actually populated.
  const repliedLeads = myLeads.filter((l) => l.lastReplyDate).length;
  const contactedLeads = myLeads.filter((l) => l.emailOneSentDate).length;

  res.json({
    totalLeads: total,
    coldLeads: counts.cold,
    warmLeads: counts.warm,
    hotLeads: counts.hot,
    customers: counts.customer,
    followupLeads: counts.followup,
    rejectedLeads: counts.rejected,
    callsBooked,
    dealsClosed,
    conversionRate: total ? Number(((counts.customer / total) * 100).toFixed(1)) : 0,
    responseRate: contactedLeads
      ? Number(((repliedLeads / contactedLeads) * 100).toFixed(1))
      : 0,
  });
});

router.get("/funnel", (req, res) => {
  const counts = countByStatus(req.userId);
  res.json([
    { stage: "Cold", count: counts.cold },
    { stage: "Warm", count: counts.warm },
    { stage: "Hot", count: counts.hot },
    { stage: "Customer", count: counts.customer },
  ]);
});

// Full 6-status breakdown for the Analytics page (separate from the 4-stage funnel,
// which intentionally only tracks the Cold -> Warm -> Hot -> Customer conversion path).
router.get("/status-breakdown", (req, res) => {
  const counts = countByStatus(req.userId);
  res.json([
    { status: "cold", label: "Cold", count: counts.cold },
    { status: "warm", label: "Warm", count: counts.warm },
    { status: "hot", label: "Hot", count: counts.hot },
    { status: "followup", label: "Follow-up Later", count: counts.followup },
    { status: "rejected", label: "Rejected", count: counts.rejected },
    { status: "customer", label: "Customer", count: counts.customer },
  ]);
});

router.get("/conversion", (req, res) => {
  const byMonth = new Map();

  for (const lead of leads.find((l) => l.ownerId === req.userId)) {
    const key = lead.dateAdded.slice(0, 7); // YYYY-MM
    if (!byMonth.has(key)) byMonth.set(key, { total: 0, customers: 0 });
    byMonth.get(key).total++;
    if (lead.status === "customer") byMonth.get(key).customers++;
  }

  const result = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { total, customers }]) => ({
      month,
      totalLeads: total,
      customers,
      conversionRate: total ? Number(((customers / total) * 100).toFixed(1)) : 0,
    }));

  res.json(result);
});

router.get("/templates", (req, res) => {
  const stats = new Map(); // templateId -> { sent: Set<leadId>, progressed: Set<leadId> }

  for (const convo of conversations.find((c) => c.ownerId === req.userId)) {
    for (const msg of convo.messages) {
      if (msg.type !== "email" || !msg.templateId) continue;
      if (!stats.has(msg.templateId)) stats.set(msg.templateId, { sent: new Set(), progressed: new Set() });
      const entry = stats.get(msg.templateId);
      entry.sent.add(convo.leadId);
      const lead = leads.get(convo.leadId);
      if (lead && lead.status !== "cold" && lead.status !== "rejected") {
        entry.progressed.add(convo.leadId);
      }
    }
  }

  const result = [...stats.entries()].map(([templateId, entry]) => {
    const template = emailTemplates.get(templateId);
    return {
      templateId,
      name: template?.name ?? "Deleted template",
      sent: entry.sent.size,
      responded: entry.progressed.size,
      responseRate: entry.sent.size
        ? Number(((entry.progressed.size / entry.sent.size) * 100).toFixed(1))
        : 0,
    };
  });

  res.json(result.sort((a, b) => b.responseRate - a.responseRate));
});

export default router;
