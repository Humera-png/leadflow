// In local dev, Vite proxies "/api" to the backend (see vite.config.js). In production
// (e.g. frontend on Vercel, backend on Railway/Render) set VITE_API_URL to the backend's
// origin and requests go straight there instead of relying on a dev-only proxy.
const API_ORIGIN = import.meta.env.VITE_API_URL ?? "";
const BASE = `${API_ORIGIN}/api`;

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: options.body instanceof FormData ? undefined : { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Leads
  getLeads: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/leads${qs ? `?${qs}` : ""}`);
  },
  getLead: (id) => request(`/leads/${id}`),
  createLead: (data) => request("/leads", { method: "POST", body: JSON.stringify(data) }),
  updateLead: (id, data) => request(`/leads/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteLead: (id) => request(`/leads/${id}`, { method: "DELETE" }),
  bulkUpdateLeads: (data) => request("/leads/bulk", { method: "PATCH", body: JSON.stringify(data) }),
  importLeadsCsv: (file) => {
    const form = new FormData();
    form.append("file", file);
    return request("/leads/import-csv", { method: "POST", body: form });
  },
  exportLeadsCsvUrl: () => `${BASE}/leads/export-csv`,
  submitCapture: (data) => request("/leads/capture", { method: "POST", body: JSON.stringify(data) }),

  // Sequences
  getSequence: (leadId) => request(`/sequences/${leadId}`),
  simulateReply: (leadId, content) =>
    request(`/sequences/${leadId}/simulate-reply`, { method: "POST", body: JSON.stringify({ content }) }),
  bookCall: (leadId, data) =>
    request(`/sequences/${leadId}/book-call`, { method: "POST", body: JSON.stringify(data) }),
  closeDeal: (leadId, amount) =>
    request(`/sequences/${leadId}/close-deal`, { method: "POST", body: JSON.stringify({ amount }) }),

  // Conversations
  getConversation: (leadId) => request(`/conversations/${leadId}`),
  addCallNote: (leadId, data) =>
    request(`/conversations/${leadId}/call-notes`, { method: "POST", body: JSON.stringify(data) }),

  // Templates
  getTemplates: () => request("/templates"),
  createTemplate: (data) => request("/templates", { method: "POST", body: JSON.stringify(data) }),
  updateTemplate: (id, data) => request(`/templates/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteTemplate: (id) => request(`/templates/${id}`, { method: "DELETE" }),

  // Calendar
  getAvailability: () => request("/calendar/availability"),
  getEvents: () => request("/calendar/events"),
  bookMeeting: (data) => request("/calendar/book", { method: "POST", body: JSON.stringify(data) }),

  // Analytics
  getDashboard: () => request("/analytics/dashboard"),
  getFunnel: () => request("/analytics/funnel"),
  getStatusBreakdown: () => request("/analytics/status-breakdown"),
  getConversion: () => request("/analytics/conversion"),
  getTemplatePerformance: () => request("/analytics/templates"),
};
