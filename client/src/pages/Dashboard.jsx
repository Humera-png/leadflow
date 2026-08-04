import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import SummaryCard from "../components/SummaryCard.jsx";
import StatusBadge from "../components/StatusBadge.jsx";

const FUNNEL_COLORS = {
  Cold: "bg-slate-400",
  Warm: "bg-amber-400",
  Hot: "bg-rose-400",
  Customer: "bg-emerald-400",
};

export default function Dashboard() {
  const [dashboard, setDashboard] = useState(null);
  const [funnel, setFunnel] = useState([]);
  const [recentLeads, setRecentLeads] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getFunnel(), api.getLeads()])
      .then(([d, f, leads]) => {
        setDashboard(d);
        setFunnel(f);
        setRecentLeads(leads.slice(0, 6));
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;
  if (!dashboard) return <p className="text-slate-500">Loading...</p>;

  const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Your pipeline at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <SummaryCard label="Total Leads" value={dashboard.totalLeads} />
        <SummaryCard label="Warm" value={dashboard.warmLeads} accent="text-amber-600" />
        <SummaryCard label="Hot" value={dashboard.hotLeads} accent="text-rose-600" />
        <SummaryCard label="Customers" value={dashboard.customers} accent="text-emerald-600" />
        <SummaryCard label="Calls Booked" value={dashboard.callsBooked} />
        <SummaryCard label="Deals Closed" value={dashboard.dealsClosed} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Funnel: Cold → Warm → Hot → Customer</h2>
          <div className="space-y-3">
            {funnel.map((stage) => (
              <div key={stage.stage}>
                <div className="mb-1 flex justify-between text-xs text-slate-500">
                  <span>{stage.stage}</span>
                  <span>{stage.count}</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-slate-100">
                  <div
                    className={`h-2.5 rounded-full ${FUNNEL_COLORS[stage.stage]}`}
                    style={{ width: `${(stage.count / maxFunnel) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Quick Actions</h2>
          <div className="flex flex-col gap-2">
            <Link to="/leads" className="btn-primary text-center">
              Add a Lead
            </Link>
            <Link to="/calendar" className="btn-secondary text-center">
              View Calendar
            </Link>
            <Link to="/analytics" className="btn-secondary text-center">
              Full Analytics
            </Link>
          </div>
          <div className="mt-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
            Conversion rate: <span className="font-medium text-slate-700">{dashboard.conversionRate}%</span>
            <br />
            Response rate: <span className="font-medium text-slate-700">{dashboard.responseRate}%</span>
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
          <Link to="/leads" className="text-xs font-medium text-indigo-600 hover:underline">
            View all leads
          </Link>
        </div>
        <ul className="divide-y divide-slate-100">
          {recentLeads.map((lead) => (
            <li key={lead._id}>
              <Link
                to={`/leads/${lead._id}`}
                className="flex items-center justify-between py-2.5 text-sm hover:bg-slate-50"
              >
                <div>
                  <p className="font-medium text-slate-900">{lead.name}</p>
                  <p className="text-slate-500">{lead.company}</p>
                </div>
                <StatusBadge status={lead.status} />
              </Link>
            </li>
          ))}
          {recentLeads.length === 0 && <p className="py-4 text-sm text-slate-500">No leads yet.</p>}
        </ul>
      </div>
    </div>
  );
}
