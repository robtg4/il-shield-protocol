interface Props {
  percent: number;
  color?: "green" | "amber" | "pink";
}

const colorMap = {
  green: "bg-green",
  amber: "bg-amber",
  pink: "bg-pink",
};

export function ProgressBar({ percent, color = "green" }: Props) {
  return (
    <div className="h-1 w-full rounded-full bg-input">
      <div
        className={`h-1 rounded-full transition-all duration-300 ${colorMap[color]}`}
        style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
      />
    </div>
  );
}
