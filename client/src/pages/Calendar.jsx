import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";

export default function Calendar() {
  const [events, setEvents] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [leads, setLeads] = useState([]);
  const [selectedLead, setSelectedLead] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => {
    Promise.all([api.getEvents(), api.getAvailability(), api.getLeads()])
      .then(([ev, avail, ls]) => {
        setEvents(ev);
        setAvailability(avail);
        setLeads(ls);
      })
      .catch((err) => setError(err.message));
  };

  useEffect(load, []);

  const book = async (e) => {
    e.preventDefault();
    if (!selectedLead || !selectedSlot) return;
    setBusy(true);
    try {
      await api.bookMeeting({ leadId: selectedLead, scheduledTime: selectedSlot, duration: 30 });
      setSelectedLead("");
      setSelectedSlot("");
      load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.scheduledTime).getTime() >= now);
  const past = events.filter((e) => new Date(e.scheduledTime).getTime() < now);
  const today = new Date().toDateString();
  const todayEvents = upcoming.filter((e) => new Date(e.scheduledTime).toDateString() === today);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Calendar</h1>
        <p className="text-sm text-slate-500">Discovery calls booked with leads.</p>
      </div>

      {error && <p className="text-red-600">{error}</p>}

      {todayEvents.length > 0 && (
        <div className="card border-indigo-200 bg-indigo-50 p-5">
          <h2 className="mb-2 text-sm font-semibold text-indigo-900">Today's Calls</h2>
          <ul className="space-y-1 text-sm text-indigo-800">
            {todayEvents.map((e) => (
              <li key={e._id}>
                {new Date(e.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} —{" "}
                <Link to={`/leads/${e.leadId}`} className="underline">
                  {e.lead?.name ?? "Unknown lead"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Book a Free Slot</h2>
          <form onSubmit={book} className="space-y-3">
            <select className="input" value={selectedLead} onChange={(e) => setSelectedLead(e.target.value)} required>
              <option value="" disabled>
                Choose a lead...
              </option>
              {leads.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name} ({l.company})
                </option>
              ))}
            </select>
            <select className="input" value={selectedSlot} onChange={(e) => setSelectedSlot(e.target.value)} required>
              <option value="" disabled>
                Choose a free slot...
              </option>
              {availability.slice(0, 20).map((slot) => (
                <option key={slot} value={slot}>
                  {new Date(slot).toLocaleString([], {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </option>
              ))}
            </select>
            <button className="btn-primary" disabled={busy}>
              Book call
            </button>
          </form>
          <p className="mt-3 text-xs text-slate-400">
            Share your booking link with leads once Calendly/Google Calendar OAuth is connected — for now, book
            directly from here.
          </p>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Upcoming Calls</h2>
          <ul className="space-y-2">
            {upcoming.map((e) => (
              <li key={e._id} className="flex items-center justify-between rounded-md border border-slate-100 p-3 text-sm">
                <div>
                  <Link to={`/leads/${e.leadId}`} className="font-medium text-indigo-600 hover:underline">
                    {e.lead?.name ?? "Unknown lead"}
                  </Link>
                  <p className="text-slate-500">{e.lead?.company}</p>
                </div>
                <div className="text-right text-slate-500">
                  <p>{new Date(e.scheduledTime).toLocaleDateString()}</p>
                  <p>{new Date(e.scheduledTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                </div>
              </li>
            ))}
            {upcoming.length === 0 && <p className="text-sm text-slate-500">No upcoming calls.</p>}
          </ul>
        </div>
      </div>

      {past.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Past Calls</h2>
          <ul className="space-y-1 text-sm text-slate-500">
            {past.map((e) => (
              <li key={e._id}>
                {new Date(e.scheduledTime).toLocaleString()} —{" "}
                <Link to={`/leads/${e.leadId}`} className="text-indigo-600 hover:underline">
                  {e.lead?.name ?? "Unknown lead"}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
