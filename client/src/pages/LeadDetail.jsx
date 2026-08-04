import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../api/client.js";
import StatusBadge from "../components/StatusBadge.jsx";
import LeadModal from "../components/LeadModal.jsx";

function fmtDateTime(value) {
  return value ? new Date(value).toLocaleString() : "—";
}

function nextActionSuggestion(lead, sequence) {
  if (!lead) return "";
  if (lead.nextAction) return lead.nextAction;
  switch (lead.status) {
    case "cold":
      return sequence?.followUpDate
        ? `Next auto follow-up scheduled for ${new Date(sequence.followUpDate).toLocaleString()}.`
        : "Sequence complete — consider a manual check-in.";
    case "warm":
      return "They replied — schedule a discovery call?";
    case "hot":
      return "Call is booked — follow up right after with next steps.";
    case "customer":
      return "Deal closed — keep them warm for referrals/upsells.";
    case "rejected":
      return "Marked as rejected — no further action needed.";
    default:
      return "";
  }
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [sequence, setSequence] = useState(null);
  const [conversation, setConversation] = useState(null);
  const [error, setError] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [noteForm, setNoteForm] = useState({ notes: "", nextSteps: "" });
  const [busy, setBusy] = useState(false);

  const load = () => {
    Promise.all([api.getLead(id), api.getSequence(id).catch(() => null), api.getConversation(id)])
      .then(([l, s, c]) => {
        setLead(l);
        setSequence(s);
        setConversation(c);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, [id]);

  const runAction = async (fn) => {
    setBusy(true);
    try {
      await fn();
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async (form) => {
    await api.updateLead(id, form);
    setShowEdit(false);
    load();
  };

  const submitNote = async (e) => {
    e.preventDefault();
    if (!noteForm.notes) return;
    await runAction(() => api.addCallNote(id, noteForm));
    setNoteForm({ notes: "", nextSteps: "" });
  };

  const deleteLead = async () => {
    if (!window.confirm(`Delete ${lead.name}? This cannot be undone.`)) return;
    await api.deleteLead(id);
    navigate("/leads");
  };

  if (error) return <p className="text-red-600">{error}</p>;
  if (!lead) return <p className="text-slate-500">Loading...</p>;

  return (
    <div className="space-y-6">
      <Link to="/leads" className="text-sm text-indigo-600 hover:underline">
        ← Back to Leads
      </Link>

      {/* BASIC INFO */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">{lead.name}</h1>
            <p className="text-slate-500">
              {lead.company} {lead.icp && <span className="ml-1 text-emerald-600">• ICP match</span>}
            </p>
          </div>
          <StatusBadge status={lead.status} />
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Info label="Email" value={lead.email} />
          <Info label="Phone" value={lead.phone || "—"} />
          <Info
            label="LinkedIn"
            value={
              lead.linkedinUrl ? (
                <a href={lead.linkedinUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                  Profile
                </a>
              ) : (
                "—"
              )
            }
          />
          <Info label="Added" value={new Date(lead.dateAdded).toLocaleDateString()} />
          <Info label="Last Updated" value={fmtDateTime(lead.lastUpdated)} />
        </dl>
        {lead.notes && <p className="mt-3 rounded-md bg-slate-50 p-3 text-sm text-slate-600">{lead.notes}</p>}

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => setShowEdit(true)}>
            Edit
          </button>
          <button className="btn-secondary text-red-600" onClick={deleteLead}>
            Delete
          </button>
          {lead.status === "cold" && (
            <button
              disabled={busy}
              className="btn-secondary"
              onClick={() => runAction(() => api.simulateReply(id, "Thanks for reaching out, tell me more!"))}
            >
              Simulate reply received
            </button>
          )}
          {(lead.status === "warm" || lead.status === "cold") && (
            <button
              disabled={busy}
              className="btn-primary"
              onClick={() => {
                const time = window.prompt(
                  "Call date/time (e.g. 2026-08-10T15:00)",
                  new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 16)
                );
                if (time) runAction(() => api.bookCall(id, { scheduledTime: new Date(time).toISOString() }));
              }}
            >
              Book a call
            </button>
          )}
          {lead.status === "hot" && (
            <button
              disabled={busy}
              className="btn-primary"
              onClick={() => {
                const amount = window.prompt("Deal amount (₹):", "5000");
                if (amount) runAction(() => api.closeDeal(id, Number(amount)));
              }}
            >
              Mark deal closed
            </button>
          )}
        </div>

        <p className="mt-3 text-sm italic text-slate-500">💡 {nextActionSuggestion(lead, sequence)}</p>
      </div>

      {/* EMAIL SEQUENCE */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Email Sequence</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <EmailStep label="Email 1" sentDate={lead.emailOneSentDate} opened={lead.email1Opened} />
          <EmailStep label="Email 2" sentDate={lead.emailTwoSentDate} opened={lead.email2Opened} />
          <EmailStep label="Email 3" sentDate={lead.emailThreeSentDate} opened={lead.email3Opened} />
        </div>
      </div>

      {/* CONVERSATION */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Conversation</h2>
        <dl className="mb-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Info label="Last Reply" value={fmtDateTime(lead.lastReplyDate)} />
          <Info label="Reply Message" value={lead.replyMessage || "—"} />
        </dl>

        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Full History</h3>
        <div className="space-y-3">
          {conversation?.messages?.length ? (
            conversation.messages.map((m, i) => (
              <div key={i} className="rounded-md border border-slate-100 p-3 text-sm">
                <div className="mb-1 flex justify-between text-xs text-slate-400">
                  <span className="font-medium uppercase">{m.type}</span>
                  <span>{new Date(m.date).toLocaleString()}</span>
                </div>
                <p className="whitespace-pre-wrap text-slate-700">{m.content}</p>
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No messages yet.</p>
          )}
        </div>

        <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-slate-400">Call Notes</h3>
        <div className="mb-4 space-y-2">
          {conversation?.callNotes?.length ? (
            conversation.callNotes.map((n, i) => (
              <div key={i} className="rounded-md bg-slate-50 p-3 text-sm">
                <p className="text-xs text-slate-400">{new Date(n.date).toLocaleString()}</p>
                <p className="text-slate-700">{n.notes}</p>
                {n.nextSteps && <p className="mt-1 text-slate-500">Next: {n.nextSteps}</p>}
              </div>
            ))
          ) : (
            <p className="text-sm text-slate-500">No call notes yet.</p>
          )}
        </div>
        <form onSubmit={submitNote} className="space-y-2">
          <textarea
            className="input"
            rows={2}
            placeholder="What happened on the call?"
            value={noteForm.notes}
            onChange={(e) => setNoteForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <input
            className="input"
            placeholder="Next steps"
            value={noteForm.nextSteps}
            onChange={(e) => setNoteForm((f) => ({ ...f, nextSteps: e.target.value }))}
          />
          <button className="btn-primary" disabled={busy}>
            Add note
          </button>
        </form>
      </div>

      {/* CALENDAR */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Calendar</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Info label="Calendar Link Sent" value={fmtDateTime(lead.calendarLinkSentDate)} />
          <Info label="Call Booked" value={lead.callBooked ? "Yes" : "No"} />
          <Info label="Meeting Date & Time" value={fmtDateTime(lead.meetingDatetime)} />
          <Info label="Call Duration" value={lead.callDuration ? `${lead.callDuration} mins` : "—"} />
        </dl>
      </div>

      {/* DEAL */}
      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Deal</h2>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <Info label="Deal Status" value={lead.dealStatus || "Pending"} />
          <Info label="Deal Value" value={lead.dealValue ? `₹${Number(lead.dealValue).toLocaleString("en-IN")}` : "—"} />
          <Info label="Next Action" value={lead.nextAction || "—"} />
          <Info label="Notes" value={lead.notes || "—"} />
        </dl>
      </div>

      {showEdit && <LeadModal lead={lead} onClose={() => setShowEdit(false)} onSave={saveEdit} />}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <dt className="text-xs uppercase text-slate-400">{label}</dt>
      <dd className="text-slate-700">{value}</dd>
    </div>
  );
}

function EmailStep({ label, sentDate, opened }) {
  const done = Boolean(sentDate);
  return (
    <div className={`rounded-lg border p-3 ${done ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
      <p className={`text-sm font-medium ${done ? "text-emerald-800" : "text-slate-400"}`}>{label}</p>
      <p className="mt-1 text-xs text-slate-500">
        {done ? new Date(sentDate).toLocaleString() : "Not sent yet"}
      </p>
      {done && <p className="mt-1 text-xs text-slate-500">{opened ? "👁 Opened" : "Not opened yet"}</p>}
    </div>
  );
}
