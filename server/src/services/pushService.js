import webpush from "web-push";
import { users } from "../data/store.js";

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

if (isPushConfigured()) {
  webpush.setVapidDetails(
    "mailto:humerashaikhh605@gmail.com",
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
}

/**
 * Sends a real phone/browser push notification to every device this user has
 * subscribed from. Silently drops subscriptions that are no longer valid
 * (uninstalled, permission revoked, etc.) rather than erroring the caller.
 */
export async function sendPush(ownerId, { title, body, url }) {
  if (!isPushConfigured()) return;

  const user = users.get(ownerId);
  const subs = user?.pushSubscriptions ?? [];
  if (subs.length === 0) return;

  const payload = JSON.stringify({ title, body, url: url ?? "/" });
  const stillValid = [];

  for (const sub of subs) {
    try {
      await webpush.sendNotification(sub, payload);
      stillValid.push(sub);
    } catch (err) {
      // 404/410 = subscription is dead (uninstalled, permission revoked) — drop it.
      if (err.statusCode !== 404 && err.statusCode !== 410) {
        stillValid.push(sub);
        console.error(`[push] failed for user ${ownerId}:`, err.message);
      }
    }
  }

  if (stillValid.length !== subs.length) {
    users.update(ownerId, { pushSubscriptions: stillValid });
  }
}
