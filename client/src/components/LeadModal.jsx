import { useState } from "react";
import Modal from "./Modal.jsx";
import { STATUS_LABELS } from "./StatusBadge.jsx";

const STATUSES = ["cold", "warm", "hot", "followup", "rejected", "customer"];
const DEAL_STATUSES = ["Pending", "Won", "Lost"];

// Edit-only modal (creation lives in QuickAddModal.jsx, which exposes more fields
// up front). `lead` is always required here.
export default function LeadModal({ lead, onClose, onSave }) {
  const [form, setForm] = useState({
    name: lead.name,
    company: lead.company,
    email: lead.email,
    phone: lead.phone ?? "",
    linkedinUrl: lead.linkedinUrl ?? "",
    icp: lead.icp ?? false,
    status: lead.status,
    notes: lead.notes ?? "",
    dealStatus: lead.dealStatus ?? "Pending",
    dealValue: lead.dealValue ?? 0,
    nextAction: lead.nextAction ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = (field) => (e) => {
    const value = e.target.type === "checkbox" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Edit Lead" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name *">
            <input className="input" value={form.name} onChange={update("name")} required />
          </Field>
          <Field label="Company">
            <input className="input" value={form.company} onChange={update("company")} />
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
          <label className="flex items-center gap-2 pt-6 text-sm text-slate-700">
            <input type="checkbox" checked={form.icp} onChange={update("icp")} />
            ICP match
          </label>
        </div>
        <Field label="Notes">
          <textarea className="input" rows={3} value={form.notes} onChange={update("notes")} />
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
        <Field label="Next Action">
          <input className="input" value={form.nextAction} onChange={update("nextAction")} />
        </Field>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Save changes"}
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
