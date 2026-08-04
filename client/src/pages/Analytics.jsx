import { useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { api } from "../api/client.js";

// Matches StatusBadge.jsx's palette so a status reads the same color everywhere.
const STATUS_COLORS = {
  cold: "#94a3b8",
  warm: "#f59e0b",
  hot: "#f43f5e",
  followup: "#0ea5e9",
  rejected: "#ef4444",
  customer: "#10b981",
};

export default function Analytics() {
  const [funnel, setFunnel] = useState([]);
  const [statusBreakdown, setStatusBreakdown] = useState([]);
  const [conversion, setConversion] = useState([]);
  const [templatePerf, setTemplatePerf] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api.getFunnel(),
      api.getStatusBreakdown(),
      api.getConversion(),
      api.getTemplatePerformance(),
    ])
      .then(([f, sb, c, t]) => {
        setFunnel(f);
        setStatusBreakdown(sb);
        setConversion(c);
        setTemplatePerf(t);
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <p className="text-red-600">{error}</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Analytics</h1>
          <p className="text-sm text-slate-500">Status breakdown, funnel, conversion, and template performance.</p>
        </div>
        <a className="btn-secondary" href={api.exportLeadsCsvUrl()} download>
          Export leads CSV
        </a>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Leads by Status</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={statusBreakdown}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {statusBreakdown.map((s) => (
                <Cell key={s.status} fill={STATUS_COLORS[s.status] ?? "#6366f1"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Conversion Funnel <span className="font-normal text-slate-400">(Cold → Warm → Hot → Customer)</span>
          </h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={funnel}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="stage" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Conversion Rate by Month</h2>
          {conversion.length === 0 ? (
            <p className="text-sm text-slate-500">Not enough data yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={conversion}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="conversionRate" name="Conversion %" stroke="#059669" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">Best Performing Templates</h2>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4 font-medium">Template</th>
              <th className="py-2 pr-4 font-medium">Sent</th>
              <th className="py-2 pr-4 font-medium">Progressed past cold</th>
              <th className="py-2 pr-4 font-medium">Response rate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {templatePerf.map((t) => (
              <tr key={t.templateId}>
                <td className="py-2 pr-4 font-medium text-slate-900">{t.name}</td>
                <td className="py-2 pr-4 text-slate-600">{t.sent}</td>
                <td className="py-2 pr-4 text-slate-600">{t.responded}</td>
                <td className="py-2 pr-4 text-slate-600">{t.responseRate}%</td>
              </tr>
            ))}
            {templatePerf.length === 0 && (
              <tr>
                <td colSpan={4} className="py-4 text-center text-slate-500">
                  No template sends recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
