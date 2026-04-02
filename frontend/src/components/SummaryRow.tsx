interface Props {
  label: string;
  value: string;
  valueColor?: string;
  mono?: boolean;
}

export function SummaryRow({ label, value, valueColor, mono }: Props) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px] text-text3">{label}</span>
      <span
        className={`text-[13px] ${mono ? "font-mono" : ""}`}
        style={{ color: valueColor || "var(--text1)" }}
      >
        {value}
      </span>
    </div>
  );
}
