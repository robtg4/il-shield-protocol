"use client";

export function PositionHookCard({
  il,
  ilAt10Pct,
  historicalProb,
  pair,
  inRange,
}: {
  il: number;
  ilAt10Pct: number;
  historicalProb: number;
  pair: string;
  inRange: boolean;
}) {
  const probPct = Math.round(historicalProb * 100);
  const [t0, t1] = pair.split("/");

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-1">
            <div className="w-6 h-6 rounded-full bg-[#627EEA] flex items-center justify-center text-[10px] font-bold">{t0?.[0]}</div>
            <div className="w-6 h-6 rounded-full bg-[#2775CA] flex items-center justify-center text-[10px] font-bold">{t1?.[0]}</div>
          </div>
          <span className="text-sm text-text1 font-medium">{pair}</span>
        </div>
        <span className={`text-[12px] px-2 py-0.5 rounded-lg ${inRange ? "bg-green-dim text-green" : "bg-red-dim text-red"}`}>
          {inRange ? "In range" : "Out of range"}
        </span>
      </div>

      <div className="text-center py-4">
        <div className="text-[13px] text-text3 mb-1">
          {il > 0 ? "Estimated impermanent loss" : "No impermanent loss detected"}
        </div>
        <div className={`font-mono text-[36px] font-semibold ${il > 0 ? "text-red" : "text-green"}`}>
          {il > 0 ? `-$${il.toFixed(0)}` : "$0"}
        </div>
        {il > 0 && (
          <div className="text-[13px] text-text3">based on current price vs tick range midpoint</div>
        )}
      </div>

      {/* Projection */}
      {ilAt10Pct > 0 && (
        <div className="rounded-xl bg-amber-dim p-3">
          <div className="text-sm text-amber">
            If the price moves another 10%, your IL could reach ${ilAt10Pct.toLocaleString(undefined, { maximumFractionDigits: 0 })}.
            {probPct > 0 && ` This has happened in ${probPct}% of months since 2024.`}
          </div>
        </div>
      )}
    </div>
  );
}
