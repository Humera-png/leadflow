import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import StatusBadge from "../components/StatusBadge.jsx";
import LeadModal from "../components/LeadModal.jsx";
import ImportModal from "../components/ImportModal.jsx";

const STATUS_OPTIONS = ["", "cold", "warm", "hot", "customer", "rejected"];

function fmtDate(value) {
  return value ? new Date(value).toLocaleDateString() : "—";
}

export default function Leads() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [icpOnly, setIcpOnly] = useState(false);
  const [selected, setSelected] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const load = () => {
    setLoading(true);
    const params = {};
    if (status) params.status = status;
    if (search) params.search = search;
    if (icpOnly) params.icp = "true";
    api
      .getLeads(params)
      .then(setLeads)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search, icpOnly]);

  const toggleSelected = (id) => {
    setSelected((sel) => (sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id]));
  };

  const toggleSelectAll = () => {
    setSelected(selected.length === leads.length ? [] : leads.map((l) => l._id));
  };

  const addLead = async (form) => {
    await api.createLead(form);
    setShowAddModal(false);
    load();
  };

  const bulkSetStatus = async (newStatus) => {
    await api.bulkUpdateLeads({ ids: selected, status: newStatus });
    setSelected([]);
    load();
  };

  const bulkTag = async () => {
    const tag = window.prompt("Tag to add to selected leads:");
    if (!tag) return;
    await api.bulkUpdateLeads({ ids: selected, tag });
    setSelected([]);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Leads</h1>
          <p className="text-sm text-slate-500">{leads.length} leads</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowImportModal(true)}>
            Import CSV
          </button>
          <button className="btn-primary" onClick={() => setShowAddModal(true)}>
            + Add Lead
          </button>
        </div>
      </div>

      <div className="card flex flex-wrap items-center gap-3 p-4">
        <input
          className="input max-w-xs"
          placeholder="Search name, company, email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="input w-auto" value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s ? s[0].toUpperCase() + s.slice(1) : "All statuses"}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={icpOnly} onChange={(e) => setIcpOnly(e.target.checked)} />
          ICP only
        </label>

        {selected.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-sm">
            <span className="text-slate-500">{selected.length} selected</span>
            <select
              className="input w-auto"
              defaultValue=""
              onChange={(e) => {
                if (e.target.value) bulkSetStatus(e.target.value);
                e.target.value = "";
              }}
            >
              <option value="" disabled>
                Change status...
              </option>
              {STATUS_OPTIONS.filter(Boolean).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button className="btn-secondary" onClick={bulkTag}>
              Add tag
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-red-600">{error}</p>}

      <div className="card overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={leads.length > 0 && selected.length === leads.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Name</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Company</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Email</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Phone</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Status</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Email 1 Sent</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Email 2 Sent</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Email 3 Sent</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Last Reply</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Call Booked</th>
              <th className="px-4 py-2.5 text-left font-medium text-slate-500">Deal Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {leads.map((lead) => (
              <tr key={lead._id} className="hover:bg-slate-50">
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.includes(lead._id)}
                    onChange={() => toggleSelected(lead._id)}
                  />
                </td>
                <td className="px-4 py-2.5">
                  <Link to={`/leads/${lead._id}`} className="font-medium text-indigo-600 hover:underline">
                    {lead.name}
                  </Link>
                  {lead.icp && <span className="ml-1 text-xs text-emerald-600" title="ICP match">●</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-700">{lead.company}</td>
                <td className="px-4 py-2.5 text-slate-500">{lead.email}</td>
                <td className="px-4 py-2.5 text-slate-500">{lead.phone || "—"}</td>
                <td className="px-4 py-2.5">
                  <StatusBadge status={lead.status} />
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {fmtDate(lead.emailOneSentDate)}
                  {lead.email1Opened && <span className="ml-1 text-emerald-600" title="Opened">👁</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {fmtDate(lead.emailTwoSentDate)}
                  {lead.email2Opened && <span className="ml-1 text-emerald-600" title="Opened">👁</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">
                  {fmtDate(lead.emailThreeSentDate)}
                  {lead.email3Opened && <span className="ml-1 text-emerald-600" title="Opened">👁</span>}
                </td>
                <td className="px-4 py-2.5 text-slate-500">{fmtDate(lead.lastReplyDate)}</td>
                <td className="px-4 py-2.5">{lead.callBooked ? "✅" : "—"}</td>
                <td className="px-4 py-2.5 text-slate-700">
                  {lead.dealValue ? `₹${Number(lead.dealValue).toLocaleString("en-IN")}` : "—"}
                </td>
              </tr>
            ))}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                  No leads match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {showAddModal && <LeadModal onClose={() => setShowAddModal(false)} onSave={addLead} />}
      {showImportModal && (
        <ImportModal onClose={() => setShowImportModal(false)} onImported={load} />
      )}
    </div>
  );
}
