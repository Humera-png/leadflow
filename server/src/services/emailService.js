import { google } from "googleapis";
import { newId } from "../utils/id.js";
import { getAuthorizedClient, isGoogleConfigured } from "./googleAuth.js";

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

function toHtml(plainTextBody) {
  return plainTextBody.replace(/\n/g, "<br>");
}

// Gmail's "raw" send format wants an RFC 2822 message, base64url-encoded.
function buildRawMessage({ to, subject, html }) {
  const message = [`To: ${to}`, `Subject: ${subject}`, "MIME-Version: 1.0", 'Content-Type: text/html; charset="UTF-8"', "", html].join(
    "\n"
  );
  return Buffer.from(message).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Sends an email. In MOCK mode (no Google OAuth env vars set) this just logs
 * and records the send — no real message goes out. Once configured, sends via
 * the Gmail API as whichever account completed the OAuth consent flow
 * (see routes/auth.js), with an invisible open-tracking pixel embedded.
 */
export async function sendEmail({ to, subject, body, leadId }) {
  const sentAt = new Date().toISOString();
  const messageId = newId();
  const configured = isGoogleConfigured();

  if (!configured) {
    console.log(`[email:mock] to=${to} subject="${subject}" at ${sentAt}`);
    return { messageId, sentAt, mock: true };
  }

  let html = toHtml(body);
  if (leadId && process.env.PUBLIC_BASE_URL) {
    const pixelUrl = `${process.env.PUBLIC_BASE_URL}/api/emails/${leadId}/open`;
    html += `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none" />`;
  }

  const gmail = google.gmail({ version: "v1", auth: getAuthorizedClient() });
  await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw: buildRawMessage({ to, subject, html }) },
  });
  console.log(`[email:live] to=${to} subject="${subject}"`);

  return { messageId, sentAt, mock: false };
}

export function isGmailConfigured() {
  return isGoogleConfigured();
}
