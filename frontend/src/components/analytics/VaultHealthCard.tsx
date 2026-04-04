"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";

export function VaultHealthCard({ data }: { data: PositionAnalytics }) {
  const totalCapacity = data.seniorTVL + data.juniorTVL;
  const hasTVL = totalCapacity > 0;

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-4">Vault health</div>

      {/* Senior */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-text2">Senior tranche</span>
          <span className="font-mono text-text1">
            {hasTVL ? `$${data.seniorTVL.toLocaleString()}` : "\u2014"}
          </span>
        </div>
        <div className="h-2 rounded-full bg-card overflow-hidden">
          <div className="h-full rounded-full bg-green" style={{ width: hasTVL ? "100%" : "0%" }} />
        </div>
        <div className="text-[12px] text-text3 mt-1">Last-loss position</div>
      </div>

      {/* Junior */}
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-text2">Junior tranche</span>
          <span className="font-mono text-text1">
            {hasTVL ? `$${data.juniorTVL.toLocaleString()}` : "\u2014"}
          </span>
        </div>
        <div className="h-2 rounded-full bg-card overflow-hidden">
          <div className="h-full rounded-full bg-amber" style={{ width: hasTVL ? "100%" : "0%" }} />
        </div>
        <div className="text-[12px] text-text3 mt-1">First-loss position</div>
      </div>

      {/* Stats */}
      <div className="space-y-1.5 text-[12px] mb-4">
        {data.sjRatio > 0 && <Row label="S/J ratio" value={`${data.sjRatio.toFixed(1)}:1`} />}
        <Row label="Claim capacity" value={hasTVL ? `$${totalCapacity.toLocaleString()}` : "\u2014"} />
        <Row label="Your max payout" value={data.maxPayout > 0 ? `$${data.maxPayout.toLocaleString()}` : "\u2014"} />
      </div>

      {/* Oracle */}
      <div className="rounded-xl bg-card p-3 space-y-1 text-[12px]">
        <Row label="Oracle" value="Chainlink ETH/USD" />
        <Row label="Feed" value={`${data.chainlinkAddress.slice(0, 6)}...${data.chainlinkAddress.slice(-5)} (${data.chainlinkDecimals} dec)`} />
        <Row label="Last update" value={data.chainlinkLastUpdate > 0 ? `${data.chainlinkLastUpdate} sec ago` : "\u2014"} />
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
