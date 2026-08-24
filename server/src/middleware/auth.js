import { users } from "../data/store.js";
import { verifySessionToken } from "../services/authService.js";

/**
 * Accepts either an "Authorization: Bearer <jwt>" header (browser login session)
 * or an "X-Api-Key: lf_..." header (Maia/scripts). Either way, sets req.userId
 * and req.user. Responds 401 if neither is present/valid.
 */
export function requireAuth(req, res, next) {
  const apiKey = req.get("X-Api-Key");
  if (apiKey) {
    const user = users.findOne((u) => u.apiKey === apiKey);
    if (!user) return res.status(401).json({ error: "Invalid API key" });
    req.userId = user._id;
    req.user = user;
    return next();
  }

  const authHeader = req.get("Authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Not authenticated" });

  const userId = verifySessionToken(token);
  if (!userId) return res.status(401).json({ error: "Invalid or expired session" });

  const user = users.get(userId);
  if (!user) return res.status(401).json({ error: "Account no longer exists" });

  req.userId = userId;
  req.user = user;
  next();
}
