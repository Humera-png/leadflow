// In local dev, Vite proxies "/api" to the backend (see vite.config.js). In production
// (e.g. frontend on Vercel, backend on Railway/Render) set VITE_API_URL to the backend's
// origin and requests go straight there instead of relying on a dev-only proxy.
const API_ORIGIN = import.meta.env.VITE_API_URL ?? "";
const BASE = `${API_ORIGIN}/api`;
const TOKEN_KEY = "leadflow_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const token = getToken();
  const headers = options.body instanceof FormData ? {} : { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { ...options, headers: { ...headers, ...options.headers } });

  if (res.status === 401 && path !== "/account/login") {
    clearToken();
    window.dispatchEvent(new Event("leadflow:unauthorized"));
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  // Account
  signup: (data) => request("/account/signup", { method: "POST", body: JSON.stringify(data) }),
  login: (data) => request("/account/login", { method: "POST", body: JSON.stringify(data) }),
  getMe: () => request("/account/me"),
  regenerateApiKey: () => request("/account/api-key/regenerate", { method: "POST" }),
  regenerateCaptureToken: () => request("/account/capture-token/regenerate", { method: "POST" }),
  setSheetSyncUrl: (url) => request("/account/sheet-sync", { method: "PUT", body: JSON.stringify({ url }) }),

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
  syncSheetNow: () => request("/leads/sync-sheet", { method: "POST" }),
  submitCapture: (data, captureToken) =>
    request(`/leads/capture?key=${encodeURIComponent(captureToken)}`, { method: "POST", body: JSON.stringify(data) }),

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
  getCalendlyBookingLink: () => request("/calendly/booking-link"),

  // Notifications
  getNotifications: () => request("/notifications"),
  getUnreadCount: () => request("/notifications/unread-count"),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => request("/notifications/read-all", { method: "POST" }),

  // Analytics
  getDashboard: () => request("/analytics/dashboard"),
  getFunnel: () => request("/analytics/funnel"),
  getStatusBreakdown: () => request("/analytics/status-breakdown"),
  getConversion: () => request("/analytics/conversion"),
  getTemplatePerformance: () => request("/analytics/templates"),
};
