"use client";

import { DexLogo } from "./DexLogo";
import type { DexConfig } from "@/config/dex-registry";

export function DexSelector({
  available,
  selected,
  onSelect,
}: {
  available: DexConfig[];
  selected: DexConfig;
  onSelect: (dex: DexConfig) => void;
}) {
  if (available.length === 0) return null;

  return (
    <div className="flex gap-1 bg-card rounded-xl p-1 overflow-x-auto">
      {available.map((dex) => (
        <button
          key={dex.id}
          onClick={() => onSelect(dex)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
            selected.id === dex.id
              ? "bg-input text-text1 shadow-sm"
              : "text-text3 hover:text-text2"
          }`}
        >
          <DexLogo dexId={dex.id} size={16} />
          {dex.shortName}
        </button>
      ))}
    </div>
  );
}
