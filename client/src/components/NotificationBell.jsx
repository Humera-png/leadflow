import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

const TYPE_ICON = { reply: "💬", call_booked: "📅", deal_closed: "🎉" };

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const POLL_MS = 20000; // check every 20s — much faster than Slack's current delay

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  const loadCount = () => {
    api.getUnreadCount().then((r) => setUnread(r.count)).catch(() => {});
  };

  const loadList = () => {
    api.getNotifications().then(setItems).catch(() => {});
  };

  useEffect(() => {
    loadCount();
    const interval = setInterval(loadCount, POLL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (open) loadList();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  const openNotification = async (n) => {
    if (!n.read) {
      await api.markNotificationRead(n._id).catch(() => {});
      setUnread((c) => Math.max(0, c - 1));
      setItems((list) => list.map((i) => (i._id === n._id ? { ...i, read: true } : i)));
    }
    setOpen(false);
    if (n.leadId) navigate(`/leads/${n.leadId}`);
  };

  const markAllRead = async () => {
    await api.markAllNotificationsRead().catch(() => {});
    setUnread(0);
    setItems((list) => list.map((i) => ({ ...i, read: true })));
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
        aria-label="Notifications"
      >
        <span className="text-lg">🔔</span>
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <span className="text-sm font-semibold text-slate-900">Notifications</span>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-indigo-600 hover:underline">
                Mark all read
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="p-4 text-center text-sm text-slate-400">No notifications yet.</p>}
            {items.map((n) => (
              <button
                key={n._id}
                onClick={() => openNotification(n)}
                className={`flex w-full items-start gap-2 border-b border-slate-50 px-3 py-2.5 text-left text-sm hover:bg-slate-50 ${
                  n.read ? "" : "bg-indigo-50/50"
                }`}
              >
                <span>{TYPE_ICON[n.type] ?? "🔔"}</span>
                <span className="flex-1">
                  <span className={`block ${n.read ? "text-slate-600" : "font-medium text-slate-900"}`}>{n.message}</span>
                  <span className="text-xs text-slate-400">{timeAgo(n.createdAt)}</span>
                </span>
                {!n.read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
