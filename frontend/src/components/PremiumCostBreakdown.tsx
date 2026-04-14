"use client";

import type { PremiumQuotes } from "@/hooks/usePremiumQuote";
import { computeILAtMove, computePayout, tokenAmountToUSD } from "@/lib/ilmath";

const TIER_LABELS = ["50%", "75%", "100%"];
const TIER_DESCRIPTIONS = [
  "Covers half your IL",
  "Covers three-quarters",
  "Covers all your IL",
];
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
  sqrtPriceX96,
  tickLower,
  tickUpper,
  liquidity,
  token1Decimals,
  token1PriceUSD,
}: {
  quotes: PremiumQuotes;
  selectedTier: number;
  selectedDuration: string;
  sqrtPriceX96?: bigint;
  tickLower?: number;
  tickUpper?: number;
  liquidity?: bigint;
  token1Decimals?: number;
  token1PriceUSD?: number;
}) {
  const selected = quotes.selected;
  const durationLabel = DURATION_LABELS[selectedDuration] || selectedDuration;

  // Compute what each tier actually covers at a 20% move (representative scenario)
  const canComputeCoverage = sqrtPriceX96 && sqrtPriceX96 > BigInt(0) && liquidity && liquidity > BigInt(0) && tickLower !== undefined && tickUpper !== undefined;

  let coverageAmounts: [number, number, number] = [0, 0, 0];
  let ilAt20Pct = 0;

  if (canComputeCoverage && token1Decimals !== undefined && token1PriceUSD !== undefined) {
    const ilRaw = computeILAtMove(sqrtPriceX96, 20, tickLower!, tickUpper!, liquidity);
    ilAt20Pct = tokenAmountToUSD(ilRaw, token1Decimals, token1PriceUSD);

    coverageAmounts = [0, 1, 2].map((tier) => {
      const payoutRaw = computePayout(ilRaw, tier as 0 | 1 | 2, 200);
      return tokenAmountToUSD(payoutRaw, token1Decimals!, token1PriceUSD!);
    }) as [number, number, number];
  }

  if (quotes.isLoading) {
    return (
      <div className="rounded-2xl bg-input p-3 animate-pulse">
        <div className="h-4 w-32 rounded bg-card mb-2" />
        <div className="h-6 w-24 rounded bg-card" />
      </div>
    );
  }

  if (!quotes.tiers[0] && !quotes.tiers[1] && !quotes.tiers[2]) {
    return null;
  }

  return (
    <div className="rounded-2xl bg-input p-3">
      <div className="text-[13px] text-text3 mb-1">Choose your coverage</div>
      {ilAt20Pct > 0.001 && (
        <div className="text-[12px] text-text2 mb-3">
          At a &plusmn;20% price move, your estimated IL is <span className="font-mono text-red">${ilAt20Pct.toFixed(2)}</span>
        </div>
      )}

      {/* Tier comparison — user perspective */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {quotes.tiers.map((quote, i) => {
          const isSelected = i === selectedTier;
          const cost = quote?.totalCostUSD ?? 0;
          const daily = quote?.dailyCostUSD ?? 0;
          const coveredAmount = coverageAmounts[i];

          return (
            <div
              key={i}
              className={`rounded-xl p-2.5 text-center transition-all ${
                isSelected
                  ? "bg-pink-dim border border-pink/20"
                  : "bg-card"
              }`}
            >
              <div className={`text-[13px] font-semibold mb-1 ${isSelected ? "text-pink" : "text-text2"}`}>
                {TIER_LABELS[i]}
              </div>
              <div className="text-[11px] text-text3 mb-2">
                {TIER_DESCRIPTIONS[i]}
              </div>
              {coveredAmount > 0.001 ? (
                <div className={`font-mono text-sm font-semibold mb-0.5 ${isSelected ? "text-green" : "text-text2"}`}>
                  ${coveredAmount.toFixed(2)}
                </div>
              ) : null}
              <div className={`font-mono text-[12px] ${isSelected ? "text-text1" : "text-text3"}`}>
                {cost > 0.0001 ? `costs $${cost.toFixed(4)}` : cost > 0 ? `costs <$0.01` : "—"}
              </div>
              {daily > 0 && (
                <div className="text-[11px] text-text3 mt-0.5">
                  ${daily.toFixed(6)}/day
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Selected tier detail */}
      {selected && selected.totalCostUSD > 0 && (
        <div className="space-y-1 text-[12px] px-1">
          <div className="flex items-center justify-between">
            <span className="text-text3">
              {TIER_LABELS[selectedTier]} coverage &times; {durationLabel}
            </span>
            <span className="font-mono text-text1">
              ${selected.totalCostUSD.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text3">Recommended deposit</span>
            <span className="font-mono text-pink font-medium">
              ${selected.minDepositUSD.toLocaleString(undefined, { maximumFractionDigits: 4 })} USDC
            </span>
          </div>
        </div>
      )}

      {selected && selected.totalCostUSD > 0 && selected.totalCostUSD < 0.01 && (
        <div className="text-[12px] text-text3 px-1 mt-1">
          Premium is under $0.01 for this position size. Larger positions pay proportionally more.
        </div>
      )}

      {selected && selected.totalCostUSD === 0 && (
        <div className="text-[12px] text-green px-1">
          No minimum premium — premiumRate is 0
        </div>
      )}
    </div>
  );
}
