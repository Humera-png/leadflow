import { Router } from "express";
import { newOAuthClient, GOOGLE_SCOPES } from "../services/googleAuth.js";

const router = Router();

/**
 * One-time setup flow: visit /api/auth/google, sign in with the Google account you
 * want LeadFlow sending email / creating calendar events as, and it redirects back
 * to /api/auth/google/callback with a refresh token to copy into GOOGLE_REFRESH_TOKEN.
 * Requires GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI to already be set.
 */
router.get("/google", (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    return res
      .status(400)
      .send("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars first, then reload this page.");
  }

  const url = newOAuthClient().generateAuthUrl({
    access_type: "offline", // required to receive a refresh_token
    prompt: "consent", // forces a fresh refresh_token even if you've consented before
    scope: GOOGLE_SCOPES,
  });
  res.redirect(url);
});

router.get("/google/callback", async (req, res) => {
  if (req.query.error) {
    return res.status(400).send(`Google OAuth error: ${req.query.error}`);
  }

  try {
    const { tokens } = await newOAuthClient().getToken(req.query.code);

    if (!tokens.refresh_token) {
      return res.status(200).send(`
        <html><body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
          <h2>No refresh token returned</h2>
          <p>Google only issues a refresh token the <em>first</em> time you consent, or when you force it.
          Revoke LeadFlow's access at
          <a href="https://myaccount.google.com/permissions" target="_blank">myaccount.google.com/permissions</a>
          and visit <a href="/api/auth/google">/api/auth/google</a> again.</p>
        </body></html>
      `);
    }

    res.send(`
      <html><body style="font-family: sans-serif; padding: 40px; max-width: 600px; margin: 0 auto;">
        <h2>Google connected ✅</h2>
        <p>Copy this into your <code>GOOGLE_REFRESH_TOKEN</code> environment variable
        (<code>server/.env</code> locally, <code>railway variable set GOOGLE_REFRESH_TOKEN=...</code> in production),
        then restart the server:</p>
        <pre style="background:#f4f4f4; padding:16px; border-radius:8px; word-break:break-all;">${tokens.refresh_token}</pre>
        <p>This page never stores the token anywhere — copy it now.</p>
      </body></html>
    `);
  } catch (err) {
    res.status(500).send(`OAuth exchange failed: ${err.message}`);
  }
});

export default router;
