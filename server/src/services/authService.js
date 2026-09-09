import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

const JWT_EXPIRY = "30d";

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return s;
}

export async function hashPassword(password) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function signSessionToken(userId) {
  return jwt.sign({ sub: userId }, secret(), { expiresIn: JWT_EXPIRY });
}

/** Returns the userId if the token is valid, otherwise null (never throws). */
export function verifySessionToken(token) {
  try {
    const payload = jwt.verify(token, secret());
    return payload.sub;
  } catch {
    return null;
  }
}

/** For programmatic access (Maia, scripts) — long-lived, sent as X-Api-Key, not a JWT. */
export function generateApiKey() {
  return `lf_${randomBytes(24).toString("hex")}`;
}

/** Low-privilege token safe to embed in a public capture-form URL — only identifies which
 * account new leads go to, grants no read/write access to existing data. */
export function generateCaptureToken() {
  return `cap_${randomBytes(16).toString("hex")}`;
}

/** Single-use, time-limited token for the forgot-password flow. */
export function generateResetToken() {
  return randomBytes(32).toString("hex");
}
