import { Router } from "express";
import { notifications } from "../data/store.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Most recent 50, newest first.
router.get("/", (req, res) => {
  const results = notifications
    .find((n) => n.ownerId === req.userId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 50);
  res.json(results);
});

router.get("/unread-count", (req, res) => {
  const count = notifications.find((n) => n.ownerId === req.userId && !n.read).length;
  res.json({ count });
});

router.post("/:id/read", (req, res) => {
  const n = notifications.get(req.params.id);
  if (!n || n.ownerId !== req.userId) return res.status(404).json({ error: "Notification not found" });
  res.json(notifications.update(req.params.id, { read: true }));
});

router.post("/read-all", (req, res) => {
  const mine = notifications.find((n) => n.ownerId === req.userId && !n.read);
  mine.forEach((n) => notifications.update(n._id, { read: true }));
  res.json({ updated: mine.length });
});

export default router;
