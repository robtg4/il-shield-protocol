"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";

export function PositionRiskCard({ data }: { data: PositionAnalytics }) {
  return (
    <div className="rounded-2xl bg-input p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-text1">{data.pair}</span>
          <span className="text-[12px] text-text3">{data.feeRate}</span>
          <span className="text-[12px] text-text3">{data.positionId}</span>
          <span className="text-[12px] text-text3">v4</span>
          <span className={`text-[12px] px-1.5 py-0.5 rounded ${data.inRange ? "bg-green-dim text-green" : "bg-red-dim text-red"}`}>
            {data.inRange ? "In \u2713" : "Out"}
          </span>
        </div>
      </div>

      {/* Position details */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mb-4 text-sm">
        <div className="flex justify-between">
          <span className="text-text3">Current price</span>
          <span className="font-mono text-text1">${data.currentPrice.toLocaleString()}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text3">Price change</span>
          <span className={`font-mono ${data.priceChangePct >= 0 ? "text-green" : "text-red"}`}>
            {data.priceChangePct >= 0 ? "+" : ""}{data.priceChangePct.toFixed(1)}%
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-text3">Tick range</span>
          <span className="font-mono text-text1">{data.tickLower} → {data.tickUpper}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text3">Fee tier</span>
          <span className="font-mono text-text1">{data.feeRate}</span>
        </div>
      </div>

      {/* IL metrics */}
      <div className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
        <div className="rounded-xl bg-card p-3 text-center">
          <div className="text-[12px] text-text3 mb-1">Current IL</div>
          <div className="font-mono text-base font-semibold text-red">
            {data.currentIL > 0 ? `-$${data.currentIL.toFixed(2)}` : "$0"}
          </div>
          <div className="font-mono text-[12px] text-text3">-{data.currentILPct.toFixed(2)}%</div>
        </div>
        <div className="rounded-xl bg-card p-3 text-center">
          <div className="text-[12px] text-text3 mb-1">IL at &plusmn;50%</div>
          <div className="font-mono text-base font-semibold text-amber">
            -${data.ilAt50PctMove.toFixed(2)}
          </div>
          <div className="font-mono text-[12px] text-text3">max risk estimate</div>
        </div>
      </div>
    </div>
  );
}
