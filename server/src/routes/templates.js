import { Router } from "express";
import { emailTemplates } from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

router.get("/", (req, res) => {
  let results = emailTemplates.find((t) => t.ownerId === req.userId);
  if (req.query.business) results = results.filter((t) => t.business === req.query.business);
  res.json(results);
});

router.get("/:id", (req, res) => {
  const template = emailTemplates.get(req.params.id);
  if (!template || template.ownerId !== req.userId) return res.status(404).json({ error: "Template not found" });
  res.json(template);
});

router.post("/", (req, res) => {
  const { name, business, subject, body } = req.body;
  if (!name || !subject || !body) {
    return res.status(400).json({ error: "name, subject and body are required" });
  }
  const variables = [...`${subject} ${body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  const template = emailTemplates.insert({
    ownerId: req.userId,
    name,
    business: business ?? "",
    subject,
    body,
    variables: [...new Set(variables)],
  });
  res.status(201).json(template);
});

router.put("/:id", (req, res) => {
  const existing = emailTemplates.get(req.params.id);
  if (!existing || existing.ownerId !== req.userId) return res.status(404).json({ error: "Template not found" });

  const { _id, ownerId, ...patch } = req.body;
  if (patch.subject || patch.body) {
    const subject = patch.subject ?? existing.subject;
    const body = patch.body ?? existing.body;
    patch.variables = [
      ...new Set([...`${subject} ${body}`.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1])),
    ];
  }
  const updated = emailTemplates.update(req.params.id, patch);
  res.json(updated);
});

router.delete("/:id", (req, res) => {
  const existing = emailTemplates.get(req.params.id);
  if (!existing || existing.ownerId !== req.userId) return res.status(404).json({ error: "Template not found" });
  emailTemplates.remove(req.params.id);
  res.status(204).end();
});

export default router;
