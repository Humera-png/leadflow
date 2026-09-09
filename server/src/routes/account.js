import { Router } from "express";
import { users } from "../data/store.js";
import { seedTemplatesForUser } from "../data/seed.js";
import { requireAuth } from "../middleware/auth.js";
import {
  hashPassword,
  verifyPassword,
  signSessionToken,
  generateApiKey,
  generateCaptureToken,
  generateResetToken,
} from "../services/authService.js";
import { sendEmail } from "../services/emailService.js";

const router = Router();

function publicUser(user) {
  const { passwordHash, resetToken, resetTokenExpiresAt, ...safe } = user;
  return safe;
}

router.post("/signup", async (req, res) => {
  const { email, password, name } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: "email and a password (8+ chars) are required" });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (users.findOne((u) => u.email === normalizedEmail)) {
    return res.status(409).json({ error: "An account with that email already exists" });
  }

  const passwordHash = await hashPassword(password);
  const user = users.insert({
    email: normalizedEmail,
    name: name?.trim() || normalizedEmail.split("@")[0],
    passwordHash,
    apiKey: generateApiKey(),
    captureToken: generateCaptureToken(),
    createdAt: new Date().toISOString(),
  });

  seedTemplatesForUser(user._id);

  const token = signSessionToken(user._id);
  res.status(201).json({ token, user: publicUser(user) });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = users.findOne((u) => u.email === String(email ?? "").trim().toLowerCase());
  if (!user || !(await verifyPassword(password ?? "", user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signSessionToken(user._id);
  res.json({ token, user: publicUser(user) });
});

router.get("/me", requireAuth, (req, res) => {
  res.json(publicUser(req.user));
});

router.post("/api-key/regenerate", requireAuth, (req, res) => {
  const updated = users.update(req.userId, { apiKey: generateApiKey() });
  res.json(publicUser(updated));
});

router.post("/capture-token/regenerate", requireAuth, (req, res) => {
  const updated = users.update(req.userId, { captureToken: generateCaptureToken() });
  res.json(publicUser(updated));
});

// Connects (or disconnects, with an empty url) a Google Sheet as a live lead source.
// The sheet must be shared as "Anyone with the link -> Viewer" — see services/sheetSync.js.
router.put("/sheet-sync", requireAuth, (req, res) => {
  const url = String(req.body?.url ?? "").trim();
  const updated = users.update(req.userId, {
    sheetSyncUrl: url || null,
    sheetSyncLastRunAt: null,
    sheetSyncLastResult: null,
    sheetSyncLastError: null,
  });
  res.json(publicUser(updated));
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Always responds the same way whether or not the email exists, so this can't
// be used to check which emails have LeadFlow accounts.
router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const genericReply = { ok: true, message: "If that email has an account, a reset link has been sent." };
  if (!email) return res.json(genericReply);

  const user = users.findOne((u) => u.email === email);
  if (user) {
    const token = generateResetToken();
    users.update(user._id, {
      resetToken: token,
      resetTokenExpiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
    });

    const origin = (process.env.CLIENT_ORIGIN || "").split(",")[0].trim() || "http://localhost:5173";
    const resetUrl = `${origin}/reset-password?token=${token}`;

    await sendEmail({
      to: user.email,
      subject: "Reset your LeadFlow password",
      body: `Hi ${user.name || ""},\n\nSomeone (hopefully you) requested a password reset for your LeadFlow account.\n\nClick here to set a new password (link expires in 1 hour):\n${resetUrl}\n\nIf you didn't request this, you can safely ignore this email — your password won't change.`,
    }).catch((err) => console.error("[forgot-password] email send failed:", err.message));
  }

  res.json(genericReply);
});

router.post("/reset-password", async (req, res) => {
  const { token, password } = req.body ?? {};
  if (!token || !password || password.length < 8) {
    return res.status(400).json({ error: "A valid token and a password (8+ chars) are required" });
  }

  const user = users.findOne((u) => u.resetToken === token);
  if (!user || !user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired — request a new one" });
  }

  const passwordHash = await hashPassword(password);
  users.update(user._id, { passwordHash, resetToken: null, resetTokenExpiresAt: null });
  res.json({ ok: true });
});

// Real phone/browser push notifications — separate from the in-app bell icon.
router.get("/vapid-public-key", (req, res) => {
  res.json({ key: process.env.VAPID_PUBLIC_KEY ?? null });
});

router.post("/push-subscribe", requireAuth, (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint) return res.status(400).json({ error: "Invalid push subscription" });

  const existing = req.user.pushSubscriptions ?? [];
  const alreadySaved = existing.some((s) => s.endpoint === sub.endpoint);
  const updated = alreadySaved ? existing : [...existing, sub];
  users.update(req.userId, { pushSubscriptions: updated });
  res.json({ ok: true });
});

router.post("/push-unsubscribe", requireAuth, (req, res) => {
  const endpoint = req.body?.endpoint;
  const existing = req.user.pushSubscriptions ?? [];
  users.update(req.userId, { pushSubscriptions: existing.filter((s) => s.endpoint !== endpoint) });
  res.json({ ok: true });
});

export default router;
