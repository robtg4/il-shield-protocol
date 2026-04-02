interface Props {
  status: "in-range" | "out-of-range" | "active" | "warming";
  warmingPercent?: number;
}

const config = {
  "in-range": { bg: "bg-green-dim", text: "text-green", label: "In range" },
  "out-of-range": { bg: "bg-red-dim", text: "text-red", label: "Out of range" },
  active: { bg: "bg-green-dim", text: "text-green", label: "Active" },
  warming: { bg: "bg-amber-dim", text: "text-amber", label: "Warming" },
};

export function StatusBadge({ status, warmingPercent }: Props) {
  const c = config[status];
  const label =
    status === "warming" && warmingPercent !== undefined
      ? `${warmingPercent}%`
      : c.label;

  return (
    <span
      className={`inline-flex rounded-[10px] px-2.5 py-1 text-[13px] font-medium ${c.bg} ${c.text}`}
    >
      {label}
    </span>
  );
}
