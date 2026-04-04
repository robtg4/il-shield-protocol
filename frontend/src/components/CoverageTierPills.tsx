"use client";

const tiers = [
  { value: 0, label: "50%" },
  { value: 1, label: "75%" },
  { value: 2, label: "100%" },
];

interface Props {
  selected: number;
  onSelect: (tier: number) => void;
}

export function CoverageTierPills({ selected, onSelect }: Props) {
  return (
    <div className="flex gap-2">
      {tiers.map((tier) => (
        <button
          key={tier.value}
          onClick={() => onSelect(tier.value)}
          className={`flex-1 rounded-2xl py-2.5 text-sm font-semibold transition-all duration-[120ms] ${
            selected === tier.value
              ? "bg-pink text-white"
              : "bg-input text-text2 hover:bg-input-hover"
          }`}
        >
          {tier.label}
        </button>
      ))}
    </div>
  );
}
