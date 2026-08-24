import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api/client.js";

// Public, unauthenticated page — no Layout/sidebar (see App.jsx route). Meant to be
// embedded on an external site via <iframe src=".../capture?key=cap_..."> — the "key"
// is the account's low-privilege capture token (from Settings), which tells the
// backend which account a submission belongs to. Every submission becomes a new
// Cold lead with source: "webform" and goes straight into the normal auto-sequence.
export default function CapturePage() {
  const [searchParams] = useSearchParams();
  const captureToken = searchParams.get("key");
  const [form, setForm] = useState({ name: "", email: "", company: "", phone: "", message: "", website: "" });
  const [status, setStatus] = useState("idle"); // idle | submitting | done | error
  const [error, setError] = useState("");

  const update = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      setError("Name and email are required.");
      return;
    }
    if (!captureToken) {
      setError("This form is missing its account key — check the embed URL includes ?key=...");
      return;
    }
    setStatus("submitting");
    setError("");
    try {
      await api.submitCapture(form, captureToken);
      setStatus("done");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  };

  if (status === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white p-6">
        <div className="max-w-sm text-center">
          <p className="text-lg font-semibold text-slate-900">Thanks — got it!</p>
          <p className="mt-1 text-sm text-slate-500">We'll be in touch shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-white p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-3">
        <div className="mb-2">
          <h1 className="text-lg font-semibold text-slate-900">Get in touch</h1>
          <p className="text-sm text-slate-500">Tell us a bit about you and we'll reach out.</p>
        </div>

        {/* Honeypot — hidden from real visitors via CSS, most bots fill every field they find. */}
        <input
          type="text"
          name="website"
          value={form.website}
          onChange={update("website")}
          tabIndex={-1}
          autoComplete="off"
          className="absolute left-[-9999px]"
          aria-hidden="true"
        />

        <input className="input" placeholder="Name *" value={form.name} onChange={update("name")} required />
        <input
          className="input"
          type="email"
          placeholder="Email *"
          value={form.email}
          onChange={update("email")}
          required
        />
        <input className="input" placeholder="Company" value={form.company} onChange={update("company")} />
        <input className="input" placeholder="Phone" value={form.phone} onChange={update("phone")} />
        <textarea
          className="input"
          rows={3}
          placeholder="What are you looking for?"
          value={form.message}
          onChange={update("message")}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={status === "submitting"} className="btn-primary w-full">
          {status === "submitting" ? "Sending..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
