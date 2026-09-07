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
} from "../services/authService.js";

const router = Router();

function publicUser(user) {
  const { passwordHash, ...safe } = user;
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

export default router;
