import { google } from "googleapis";

// Scopes needed for real Gmail sending + Calendar event creation with invites.
export const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar.events",
];

export function isGoogleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REFRESH_TOKEN
  );
}

/** OAuth2 client for the one-time consent flow (routes/auth.js) — no refresh token needed yet. */
export function newOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

/** OAuth2 client pre-loaded with the stored refresh token — used by emailService/calendarService
 * to make authenticated Gmail/Calendar API calls. googleapis auto-refreshes the access token. */
export function getAuthorizedClient() {
  const client = newOAuthClient();
  client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
  return client;
}
