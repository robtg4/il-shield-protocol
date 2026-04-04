"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";

export function PremiumEconomicsCard({ data }: { data: PositionAnalytics }) {
  const probPct = Math.round(data.historicalMoveProb * 100);

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-3">Premium economics</div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl bg-card p-3 text-center">
          <div className="text-[12px] text-text3 mb-1">Monthly premium</div>
          <div className="font-mono text-lg font-semibold text-text1">
            ${data.monthlyPremium.toFixed(2)}
          </div>
        </div>
        <div className="rounded-xl bg-card p-3 text-center">
          <div className="text-[12px] text-text3 mb-1">Break-even</div>
          <div className="font-mono text-lg font-semibold text-text1">
            {data.breakEvenMove > 0 ? `\u00b1${data.breakEvenMove}%` : "\u2014"}
          </div>
          <div className="font-mono text-[12px] text-text3">IL &gt; premium</div>
        </div>
      </div>

      <div className="space-y-1.5 text-[12px]">
        <Row label="Premium rate" value={`${data.premiumPerBlock.toFixed(4)} USDC/block`} />
        <Row label="Streaming rate" value={`$${(data.dailyCost / 24).toFixed(3)}/hr`} />
        <Row label="Activation delay" value="10 blocks (~2 min)" />
        <Row label="Coverage ramp" value="50 blocks (~10 min)" />
        <Row label="Settlement fee" value="2%" />
        <Row label="Max payout cap" value="10\u00d7 premium deposit" />
      </div>

      {probPct > 0 && (
        <div className="mt-4 rounded-xl bg-card p-3">
          <div className="text-[12px] text-text3 font-medium mb-2">Historical context</div>
          <div className="space-y-1 text-[12px]">
            <Row label={`ETH >${data.breakEvenMove}% moves in 30d`} value={`${probPct}%`} />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text3">{label}</span>
      <span className="font-mono text-text2">{value}</span>
    </div>
  );
}
