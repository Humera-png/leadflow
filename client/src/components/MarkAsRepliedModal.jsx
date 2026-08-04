import { useState } from "react";
import Modal from "./Modal.jsx";

/**
 * Logs an inbound reply from a lead — stands in for the real Gmail reply webhook
 * (see server/src/services/automation.js: onReplyReceived). Moves the lead to
 * "Warm", stamps lastReplyDate, and stores the message text.
 */
export default function MarkAsRepliedModal({ leadName, onClose, onConfirm }) {
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setError("Enter what they said — it gets saved as the reply message.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onConfirm(message);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Mark ${leadName} as Replied`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <p className="text-sm text-slate-500">
          This sets status to <strong>Warm</strong> and records today as their last reply date.
        </p>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Reply message</span>
          <textarea
            className="input"
            rows={4}
            placeholder="Paste or type what they replied..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            autoFocus
          />
        </label>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? "Saving..." : "Mark as Replied"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
