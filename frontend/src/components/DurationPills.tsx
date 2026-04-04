"use client";

const durations = ["7d", "30d", "90d", "180d"];

interface Props {
  selected: string;
  onSelect: (duration: string) => void;
}

export function DurationPills({ selected, onSelect }: Props) {
  return (
    <div className="flex gap-2">
      {durations.map((d) => (
        <button
          key={d}
          onClick={() => onSelect(d)}
          className={`flex-1 rounded-xl py-2.5 text-[13px] font-medium transition-all duration-[120ms] ${
            selected === d
              ? "bg-pink-dim text-pink"
              : "text-text3 hover:text-text2"
          }`}
        >
          {d}
        </button>
      ))}
    </div>
  );
}
