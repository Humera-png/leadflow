const STYLES = {
  cold: "bg-slate-100 text-slate-600",
  warm: "bg-amber-100 text-amber-700",
  hot: "bg-rose-100 text-rose-700",
  customer: "bg-emerald-100 text-emerald-700",
  rejected: "bg-red-100 text-red-500 line-through",
};

export default function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${STYLES[status] ?? "bg-slate-100 text-slate-600"}`}
    >
      {status}
    </span>
  );
}
