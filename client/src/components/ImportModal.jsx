import { useState } from "react";
import Modal from "./Modal.jsx";
import { api } from "../api/client.js";

export default function ImportModal({ onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const res = await api.importLeadsCsv(file);
      setResult(res);
      onImported?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Import Leads from CSV" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <p className="mb-2 text-sm text-slate-600">
            Upload a CSV exported from your lead sheet. Expected columns include Name, Company, Email,
            Phone, LinkedIn URL, Status, Date Added, Email One/Two/Three Sent(Date), Email 1/2/3 Opened,
            Last Reply (Date), Reply Message, Calendar Link Sent (Date), Call Booked (Yes/No), Meeting
            Date &amp; Time, Call Duration (mins), Deal Status (Won/Lost/Pending), Deal Value (₹), Notes,
            Next Action, Last Updated.
          </p>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-indigo-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          <p className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700">
            Imported {result.imported} of {result.total} rows
            {result.skipped > 0 && ` (${result.skipped} skipped — missing name/email)`}.
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            {result ? "Close" : "Cancel"}
          </button>
          {!result && (
            <button type="submit" disabled={!file || busy} className="btn-primary">
              {busy ? "Importing..." : "Import"}
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
