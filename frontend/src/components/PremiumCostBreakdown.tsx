"use client";

import type { PremiumQuotes } from "@/hooks/usePremiumQuote";

const TIER_LABELS = ["50%", "75%", "100%"];
const DURATION_LABELS: Record<string, string> = {
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "180d": "180 days",
};

export function PremiumCostBreakdown({
  quotes,
  selectedTier,
  selectedDuration,
}: {
  quotes: PremiumQuotes;
  selectedTier: number;
  selectedDuration: string;
}) {
  const selected = quotes.selected;
  const durationLabel = DURATION_LABELS[selectedDuration] || selectedDuration;

  if (quotes.isLoading) {
    return (
      <div className="rounded-2xl bg-input p-3 animate-pulse">
        <div className="h-4 w-32 rounded bg-card mb-2" />
        <div className="h-6 w-24 rounded bg-card" />
      </div>
    );
  }

  // If all quotes are null, the pool isn't configured in the oracle
  if (!quotes.tiers[0] && !quotes.tiers[1] && !quotes.tiers[2]) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-input p-3">
      <div className="text-[13px] text-text3 mb-3">Estimated premium</div>

      {/* Tier comparison */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {quotes.tiers.map((quote, i) => {
          const isSelected = i === selectedTier;
          const cost = quote?.totalCostUSD ?? 0;
          const daily = quote?.dailyCostUSD ?? 0;

          return (
            <div
              key={i}
              className={`rounded-xl p-2.5 text-center transition-all ${
                isSelected
                  ? "bg-pink-dim border border-pink/20"
                  : "bg-card"
              }`}
            >
              <div className={`text-[12px] font-medium mb-1 ${isSelected ? "text-pink" : "text-text3"}`}>
                {TIER_LABELS[i]} cover
              </div>
              <div className={`font-mono text-base font-semibold ${isSelected ? "text-text1" : "text-text2"}`}>
                {cost > 0 ? `$${cost.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "Free"}
              </div>
              <div className="text-[11px] text-text3 mt-0.5">
                {daily > 0 ? `$${daily.toFixed(4)}/day` : "—"}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected tier detail */}
      {selected && selected.totalCostUSD > 0 && (
        <div className="flex items-center justify-between text-[12px] px-1">
          <span className="text-text3">
            {TIER_LABELS[selectedTier]} coverage × {durationLabel}
          </span>
          <span className="font-mono text-text1">
            min. ${selected.totalCostUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC
          </span>
        </div>
      )}

      {selected && selected.totalCostUSD === 0 && (
        <div className="text-[12px] text-green px-1">
          No minimum premium — premiumRate is 0 on testnet
        </div>
      )}
    </div>
  );
}
