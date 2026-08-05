// Thin wrapper around Calendly's REST API (https://developer.calendly.com).
// Uses a stored access token + refresh token pair, refreshing when Calendly
// says the access token has expired (they're short-lived, ~2 hours).

const TOKEN_URL = "https://auth.calendly.com/oauth/token";
const API_BASE = "https://api.calendly.com";

export function isCalendlyConfigured() {
  return Boolean(
    process.env.CALENDLY_CLIENT_ID && process.env.CALENDLY_CLIENT_SECRET && process.env.CALENDLY_ACCESS_TOKEN
  );
}

// Access token is refreshed in-process and kept here; falls back to the env var on boot.
let currentAccessToken = process.env.CALENDLY_ACCESS_TOKEN ?? null;
let currentRefreshToken = process.env.CALENDLY_REFRESH_TOKEN ?? null;

export async function exchangeCodeForTokens(code) {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: process.env.CALENDLY_CLIENT_ID,
      client_secret: process.env.CALENDLY_CLIENT_SECRET,
      redirect_uri: process.env.CALENDLY_REDIRECT_URI,
      code,
    }),
  });
  if (!res.ok) throw new Error(`Calendly token exchange failed: ${await res.text()}`);
  return res.json(); // { access_token, refresh_token, ... }
}

async function refreshAccessToken() {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: process.env.CALENDLY_CLIENT_ID,
      client_secret: process.env.CALENDLY_CLIENT_SECRET,
      refresh_token: currentRefreshToken,
    }),
  });
  if (!res.ok) throw new Error(`Calendly token refresh failed: ${await res.text()}`);
  const tokens = await res.json();
  currentAccessToken = tokens.access_token;
  currentRefreshToken = tokens.refresh_token ?? currentRefreshToken;
  return tokens;
}

async function calendlyFetch(path, options = {}) {
  const doFetch = () =>
    fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { Authorization: `Bearer ${currentAccessToken}`, "Content-Type": "application/json", ...options.headers },
    });

  let res = await doFetch();
  if (res.status === 401 && currentRefreshToken) {
    await refreshAccessToken();
    res = await doFetch();
  }
  if (!res.ok) throw new Error(`Calendly API error (${path}): ${await res.text()}`);
  return res.json();
}

/** The logged-in Calendly user + their real scheduling (booking) link. */
export async function getCurrentUser() {
  const { resource } = await calendlyFetch("/users/me");
  return resource; // includes resource.scheduling_url, resource.uri
}

/** Registers our webhook receiver with Calendly so real bookings notify LeadFlow. Safe to call more than once. */
export async function ensureWebhookSubscription({ webhookUrl, organizationUri, userUri }) {
  const { collection } = await calendlyFetch(
    `/webhook_subscriptions?organization=${encodeURIComponent(organizationUri)}&user=${encodeURIComponent(userUri)}&scope=user`
  );
  const existing = collection.find((w) => w.callback_url === webhookUrl);
  if (existing) return existing;

  return calendlyFetch("/webhook_subscriptions", {
    method: "POST",
    body: JSON.stringify({
      url: webhookUrl,
      events: ["invitee.created", "invitee.canceled"],
      organization: organizationUri,
      user: userUri,
      scope: "user",
    }),
  });
}
