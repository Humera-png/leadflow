import { newId } from "../utils/id.js";

const GMAIL_CONFIGURED = Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_REFRESH_TOKEN
);

export function renderTemplate(template, lead) {
  const fill = (text) =>
    text
      .replaceAll("{{name}}", lead.name ?? "there")
      .replaceAll("{{company}}", lead.company ?? "your company");

  return {
    subject: fill(template.subject),
    body: fill(template.body),
  };
}

/**
 * Sends an email. In MOCK mode (no Gmail OAuth env vars set) this just logs
 * and records the send — no real message goes out. Once GOOGLE_CLIENT_ID /
 * GOOGLE_REFRESH_TOKEN are set, swap this body for a real `gmail.users.messages.send` call.
 */
export async function sendEmail({ to, subject, body }) {
  const sentAt = new Date().toISOString();
  const messageId = newId();

  if (!GMAIL_CONFIGURED) {
    console.log(`[email:mock] to=${to} subject="${subject}" at ${sentAt}`);
  } else {
    // TODO: real Gmail API send via googleapis client using GOOGLE_REFRESH_TOKEN
    console.log(`[email:live-not-implemented] to=${to} subject="${subject}"`);
  }

  return { messageId, sentAt, mock: !GMAIL_CONFIGURED };
}

export function isGmailConfigured() {
  return GMAIL_CONFIGURED;
}
