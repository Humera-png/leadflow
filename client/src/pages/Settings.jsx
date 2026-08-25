import { useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../AuthContext.jsx";

export default function Settings() {
  const { user, refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [captureBusiness, setCaptureBusiness] = useState("");

  if (!user) return null;

  const captureUrl = `${window.location.origin}/capture?key=${user.captureToken}${captureBusiness ? `&business=${encodeURIComponent(captureBusiness)}` : ""}`;

  const regenerate = async (fn) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">{user.email}</p>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">API Key</h2>
        <p className="mb-3 text-sm text-slate-500">
          For programmatic access (Maia, scripts, etc.) — send as an <code className="rounded bg-slate-100 px-1">X-Api-Key</code> header instead of logging in.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-slate-50 p-2.5 text-sm">{user.apiKey}</code>
          <button className="btn-secondary" disabled={busy} onClick={() => regenerate(api.regenerateApiKey)}>
            Regenerate
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Regenerating invalidates the old key immediately — update anywhere it's in use (e.g. Maia).</p>
      </div>

      <div className="card p-5">
        <h2 className="mb-1 text-sm font-semibold text-slate-900">Lead Capture Form</h2>
        <p className="mb-3 text-sm text-slate-500">
          Embed this URL on your website (e.g. in an <code className="rounded bg-slate-100 px-1">&lt;iframe&gt;</code>) — every
          submission becomes a new Cold lead in this account.
        </p>
        <label className="mb-2 block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Tag submissions from this embed as business (optional)</span>
          <input
            className="input"
            list="settings-business-options"
            value={captureBusiness}
            onChange={(e) => setCaptureBusiness(e.target.value)}
            placeholder="e.g. Freelance — leave blank for untagged"
          />
          <datalist id="settings-business-options">
            <option value="Freelance" />
            <option value="NaviaLabs" />
          </datalist>
        </label>
        <div className="flex items-center gap-2">
          <code className="flex-1 overflow-x-auto rounded-md bg-slate-50 p-2.5 text-sm">{captureUrl}</code>
          <button className="btn-secondary" disabled={busy} onClick={() => regenerate(api.regenerateCaptureToken)}>
            Regenerate
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Use a separate embed per business (same key, different <code className="rounded bg-slate-100 px-0.5">&amp;business=</code> value)
          if you want each site's form to land in the right bucket. Regenerating invalidates the old embed link — update it anywhere it's embedded.
        </p>
      </div>
    </div>
  );
}
