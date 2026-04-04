"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";

export function VaultHealthCard({ data }: { data: PositionAnalytics }) {
  const srPct = 100; // simplified - no claims tracked client-side
  const jrPct = 100;
  const totalCapacity = data.seniorTVL + data.juniorTVL;

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-4">Vault health</div>

      {/* Senior */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-text2">Senior tranche</span>
          <span className="font-mono text-text1">${(data.seniorTVL).toLocaleString()}</span>
        </div>
        <div className="h-2 rounded-full bg-card overflow-hidden">
          <div className="h-full rounded-full bg-green" style={{ width: `${srPct}%` }} />
        </div>
        <div className="flex justify-between text-[12px] text-text3 mt-1">
          <span>8-12% target APY &middot; last-loss</span>
          <span className="font-mono">Share price: 1.0004</span>
        </div>
      </div>

      {/* Junior */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-text2">Junior tranche</span>
          <span className="font-mono text-text1">${(data.juniorTVL).toLocaleString()}</span>
        </div>
        <div className="h-2 rounded-full bg-card overflow-hidden">
          <div className="h-full rounded-full bg-amber" style={{ width: `${jrPct}%` }} />
        </div>
        <div className="flex justify-between text-[12px] text-text3 mt-1">
          <span>20-50% target APY &middot; first-loss</span>
          <span className="font-mono">Share price: 1.0021</span>
        </div>
      </div>

      {/* Stats */}
      <div className="space-y-1.5 text-[12px] mb-4">
        <Row label="Utilization" value={`${data.utilization}%`} />
        <Row label="Active positions" value={data.activePositions.toString()} />
        <Row label="Combined ratio" value={`${data.combinedRatio}%`} />
        <Row label="S/J ratio" value={`${data.sjRatio.toFixed(1)}:1`} />
        <Row label="Claim capacity" value={`$${totalCapacity.toLocaleString()}`} />
        <Row label="Your max payout" value={`$${data.maxPayout.toLocaleString()} (10x cap)`} />
      </div>

      {/* Oracle */}
      <div className="rounded-xl bg-card p-3 space-y-1 text-[12px]">
        <Row label="Oracle" value="Chainlink ETH/USD" />
        <Row label="Feed" value={`${data.chainlinkAddress.slice(0, 6)}...${data.chainlinkAddress.slice(-5)} (live, ${data.chainlinkDecimals} dec)`} />
        <Row label="Last update" value={`${data.chainlinkLastUpdate} sec ago`} />
        <Row label="TWAP" value={data.twapConfigured ? "configured" : "not configured"} />
      </div>
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
