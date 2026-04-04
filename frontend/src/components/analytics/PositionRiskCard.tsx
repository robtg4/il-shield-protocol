"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";

export function PositionRiskCard({ data }: { data: PositionAnalytics }) {
  return (
    <div className="rounded-2xl bg-input p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text1">ETH / USDC</span>
          <span className="text-[11px] text-text3">{data.feeRate}</span>
          <span className="text-[11px] text-text3">{data.positionId}</span>
          <span className="text-[11px] text-text3">v4</span>
          <span className={`text-[11px] px-1.5 py-0.5 rounded ${data.inRange ? "bg-green-dim text-green" : "bg-red-dim text-red"}`}>
            {data.inRange ? "In \u2713" : "Out"}
          </span>
        </div>
      </div>

      {/* Position details */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-text3">Liquidity</span>
          <span className="font-mono text-text1">${data.liquidity.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text3">Entry</span>
          <span className="font-mono text-text1">${data.entryPrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text3">Current</span>
          <span className="font-mono text-text1">${data.currentPrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text3">Change</span>
          <span className={`font-mono ${data.priceChangePct >= 0 ? "text-green" : "text-red"}`}>
            {data.priceChangePct >= 0 ? "+" : ""}{data.priceChangePct.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* P&L Trifecta */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-card p-3 text-center">
          <div className="text-[11px] text-text3 mb-1">Current IL</div>
          <div className="font-mono text-base font-semibold text-red">
            -${data.currentIL.toFixed(2)}
          </div>
          <div className="font-mono text-[11px] text-text3">-{data.currentILPct.toFixed(2)}%</div>
        </div>
        <div className="rounded-xl bg-card p-3 text-center">
          <div className="text-[11px] text-text3 mb-1">Fee Income</div>
          <div className="font-mono text-base font-semibold text-green">
            +${data.feeIncome.toFixed(2)}
          </div>
          <div className="font-mono text-[11px] text-text3">+{data.feeIncomePct.toFixed(2)}%</div>
        </div>
        <div className="rounded-xl bg-card p-3 text-center">
          <div className="text-[11px] text-text3 mb-1">Net P&L</div>
          <div className={`font-mono text-base font-semibold ${data.isNetPositive ? "text-green" : "text-red"}`}>
            {data.isNetPositive ? "+" : "-"}${Math.abs(data.netPnL).toFixed(2)}
          </div>
          <div className={`font-mono text-[11px] ${data.isNetPositive ? "text-green" : "text-red"}`}>
            {data.isNetPositive ? "+" : ""}{data.netPnLPct.toFixed(2)}%
          </div>
        </div>
      </div>

      <div className="mt-3 text-[12px] text-text3">
        IL risk: {data.currentILPct.toFixed(2)}% current, {((data.ilAt50PctMove / data.liquidity) * 100).toFixed(1)}% at &plusmn;50%
      </div>
    </div>
  );
}
