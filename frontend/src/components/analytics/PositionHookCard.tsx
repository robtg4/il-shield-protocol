"use client";

import { formatUSD } from "@/lib/scenarios";

export function PositionHookCard({
  il,
  netPnL,
  isPositive,
  ilAt10Pct,
  historicalProb,
  positionValue,
}: {
  il: number;
  netPnL: number;
  isPositive: boolean;
  ilAt10Pct: number;
  historicalProb: number;
  positionValue: number;
}) {
  const probPct = Math.round(historicalProb * 100);

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex -space-x-1">
          <div className="w-6 h-6 rounded-full bg-[#627EEA] flex items-center justify-center text-[10px] font-bold">E</div>
          <div className="w-6 h-6 rounded-full bg-[#2775CA] flex items-center justify-center text-[10px] font-bold">U</div>
        </div>
        <span className="text-sm text-text1 font-medium">ETH / USDC</span>
      </div>
      <div className="text-[13px] text-text3 mb-1">
        ${positionValue.toLocaleString()} position
      </div>

      <div className="text-center py-4">
        <div className="text-[13px] text-text3 mb-1">
          {il > 0 ? "You're currently losing" : "No impermanent loss"}
        </div>
        <div className={`font-mono text-[36px] font-semibold ${il > 0 ? "text-red" : "text-green"}`}>
          {il > 0 ? `-$${il.toFixed(0)}` : "$0"}
        </div>
        {il > 0 && (
          <div className="text-[13px] text-text3">to impermanent loss</div>
        )}
      </div>

      {/* Net P&L callout */}
      <div className={`rounded-xl p-3 mb-3 ${isPositive ? "bg-green-dim" : "bg-red-dim"}`}>
        <div className={`text-sm ${isPositive ? "text-green" : "text-red"}`}>
          {isPositive
            ? `Your fee income still covers it \u2014 you're net positive: ${formatUSD(netPnL)}`
            : `Your fees can't cover this anymore \u2014 you're losing: ${formatUSD(netPnL)}`}
        </div>
      </div>

      {/* Warning / projection */}
      <div className="rounded-xl bg-amber-dim p-3">
        <div className="text-sm text-amber">
          {il > 0
            ? `But if ETH drops another 10%, your IL jumps to $${ilAt10Pct.toLocaleString(undefined, { maximumFractionDigits: 0 })}+ and wipes out your fees. This has happened in ${probPct}% of months since 2024.`
            : `If ETH moves \u00b110%, your IL could reach $${ilAt10Pct.toLocaleString(undefined, { maximumFractionDigits: 0 })}. This has happened in ${probPct}% of months since 2024.`}
        </div>
      </div>
    </div>
  );
}
