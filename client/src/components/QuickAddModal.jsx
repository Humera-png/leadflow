import { useState } from "react";
import Modal from "./Modal.jsx";
import { STATUS_LABELS } from "./StatusBadge.jsx";

// Order matches the lead lifecycle (see Leads.jsx STATUS_ORDER) rather than alphabetical.
const STATUSES = ["cold", "warm", "hot", "followup", "rejected", "customer"];
const DEAL_STATUSES = ["Pending", "Won", "Lost"];

/**
 * "+ Add Lead" flow. Unlike the plain Edit modal, this one lets you back-fill a lead
 * that already has some history (e.g. you already emailed them once outside the app,
 * or they already said "maybe later") — the backend uses `messageSent`/`lastReplyDate`
 * to decide whether to hand the lead to the auto-sequence engine or just record history.
 */
export default function QuickAddModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    name: "",
    company: "",
    email: "",
    phone: "",
    linkedinUrl: "",
    status: "cold",
    messageSent: false, // "Message sent or not" toggle
    lastReplyDate: "",
    replyMessage: "",
    nextAction: "",
    dealStatus: "Pending",
    dealValue: 0,
    notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.company || !form.email) {
      setError("Name, company and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form); // parent handles the API call + success toast
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add New Lead" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *">
            <input className="input" value={form.name} onChange={update("name")} required />
          </Field>
          <Field label="Company *">
            <input className="input" value={form.company} onChange={update("company")} required />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Email *">
            <input className="input" type="email" value={form.email} onChange={update("email")} required />
          </Field>
          <Field label="Phone">
            <input className="input" value={form.phone} onChange={update("phone")} />
          </Field>
        </div>

        <Field label="LinkedIn URL">
          <input className="input" value={form.linkedinUrl} onChange={update("linkedinUrl")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Status">
            <select className="input" value={form.status} onChange={update("status")}>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </Field>
          {/* Date Added is always set by the server to "now" — shown read-only for clarity. */}
          <Field label="Date Added">
            <input className="input bg-slate-50 text-slate-400" value={new Date().toLocaleDateString()} readOnly />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={form.messageSent} onChange={update("messageSent")} />
          Message already sent to this lead
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Last Reply Date">
            <input className="input" type="date" value={form.lastReplyDate} onChange={update("lastReplyDate")} />
          </Field>
          <Field label="Next Action">
            <input className="input" value={form.nextAction} onChange={update("nextAction")} />
          </Field>
        </div>

        <Field label="Reply Message">
          <textarea className="input" rows={2} value={form.replyMessage} onChange={update("replyMessage")} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Deal Status">
            <select className="input" value={form.dealStatus} onChange={update("dealStatus")}>
              {DEAL_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deal Value (₹)">
            <input
              className="input"
              type="number"
              min="0"
              value={form.dealValue}
              onChange={(e) => setForm((f) => ({ ...f, dealValue: Number(e.target.value) }))}
            />
          </Field>
        </div>

        <Field label="Notes">
          <textarea className="input" rows={2} value={form.notes} onChange={update("notes")} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Adding..." : "Add lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
