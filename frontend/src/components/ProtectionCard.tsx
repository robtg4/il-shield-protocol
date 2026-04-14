"use client";

import { useBlockNumber } from "wagmi";
import type { ActiveProtection } from "@/hooks/useActiveProtections";
import { ProgressBar } from "./ProgressBar";

const TIER_LABELS = ["50%", "75%", "100%"];
const BLOCKS_PER_DAY = 7200;

export function ProtectionCard({ protection }: { protection: ActiveProtection }) {
  const { data: blockNum } = useBlockNumber({ watch: true });
  const currentBlock = blockNum ? Number(blockNum) : 0;

  const tierLabel = TIER_LABELS[protection.coverageTier] || "?";
  const premiumBalUSD = Number(protection.premiumBalance) / 1e6;
  const premiumDepositUSD = Number(protection.premiumDeposit) / 1e6;
  const maxPayoutUSD = Number(protection.maxPayout) / 1e6;
  const isActive = !protection.settled && protection.premiumBalance > BigInt(0);
  const isDepleted = !protection.settled && protection.premiumBalance === BigInt(0);

  // Time calculations
  const coverageDurationBlocks = protection.coverageEndBlock - protection.coverageStartBlock;
  const coverageDurationDays = coverageDurationBlocks / BLOCKS_PER_DAY;
  const blocksRemaining = Math.max(0, protection.coverageEndBlock - currentBlock);
  const daysRemaining = blocksRemaining / BLOCKS_PER_DAY;
  const coverageElapsedPct = coverageDurationBlocks > 0
    ? Math.min(100, Math.max(0, ((currentBlock - protection.coverageStartBlock) / coverageDurationBlocks) * 100))
    : 0;

  // Premium streaming
  const ratePerBlockUSD = Number(protection.premiumRatePerBlock) * BLOCKS_PER_DAY / 1e12 / 1e6;
  const premiumStreamedUSD = premiumDepositUSD - premiumBalUSD;
  const premiumPctRemaining = premiumDepositUSD > 0 ? (premiumBalUSD / premiumDepositUSD) * 100 : 0;

  // ROI: if settled with max payout, net = maxPayout - premiumDeposit
  // Current "potential" ROI based on max coverage
  const potentialPayoutUSD = maxPayoutUSD;
  const netROI = potentialPayoutUSD - premiumDepositUSD;
  const roiPct = premiumDepositUSD > 0 ? (netROI / premiumDepositUSD) * 100 : 0;

  return (
    <div className={`rounded-2xl border p-4 ${
      protection.settled
        ? "border-card-border bg-card/50 opacity-50"
        : isActive
          ? "border-pink/30 bg-card"
          : "border-amber/30 bg-card"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${
            protection.settled ? "bg-card" : isActive ? "bg-pink-dim" : "bg-amber-dim"
          }`}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke={protection.settled ? "var(--text3)" : isActive ? "var(--pink)" : "var(--amber)"}
              strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              {isActive && <path d="m9 12 2 2 4-4" />}
            </svg>
          </div>
          <div>
            <div className="text-sm font-semibold text-text1">Protection #{protection.ilpnId}</div>
            <div className="text-[12px] text-text3">
              {tierLabel} coverage · {coverageDurationDays.toFixed(0)}d plan
            </div>
          </div>
        </div>
        <div className={`rounded-full px-3 py-1 text-[12px] font-medium ${
          protection.settled
            ? "bg-card text-text3"
            : isActive
              ? "bg-green-dim text-green"
              : "bg-amber-dim text-amber"
        }`}>
          {protection.settled ? "Settled" : isActive ? "Active" : "Depleted"}
        </div>
      </div>

      {/* Time remaining bar */}
      {!protection.settled && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-text3">Coverage period</span>
            <span className="font-mono text-text2">
              {daysRemaining > 1 ? `${daysRemaining.toFixed(1)}d left` : daysRemaining > 0 ? `${Math.round(daysRemaining * 24)}h left` : "Expired"}
            </span>
          </div>
          <ProgressBar percent={coverageElapsedPct} color={daysRemaining < 3 ? "amber" : "green"} />
        </div>
      )}

      {/* Key metrics */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-xl bg-input p-2.5">
          <div className="text-[12px] text-text3 mb-0.5">Premium remaining</div>
          <div className="font-mono text-sm font-semibold text-text1">
            ${premiumBalUSD.toLocaleString(undefined, { maximumFractionDigits: 4 })}
          </div>
          <div className="text-[11px] text-text3">
            of ${premiumDepositUSD.toLocaleString(undefined, { maximumFractionDigits: 4 })} deposited
          </div>
        </div>
        <div className="rounded-xl bg-input p-2.5">
          <div className="text-[12px] text-text3 mb-0.5">Max payout</div>
          <div className="font-mono text-sm font-semibold text-green">
            ${maxPayoutUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[11px] text-text3">
            {roiPct > 0 ? `${roiPct.toFixed(0)}x return on premium` : "—"}
          </div>
        </div>
      </div>

      {/* Premium streaming bar */}
      {!protection.settled && premiumDepositUSD > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-text3">Premium streaming</span>
            <span className="font-mono text-text3">${ratePerBlockUSD > 0 ? ratePerBlockUSD.toFixed(6) : "0"}/day</span>
          </div>
          <ProgressBar percent={Math.max(0, Math.min(100, premiumPctRemaining))} color={premiumPctRemaining < 20 ? "amber" : "pink"} />
        </div>
      )}

      {/* Position details */}
      <div className="space-y-1 text-[12px] px-0.5">
        <div className="flex justify-between">
          <span className="text-text3">Tick range</span>
          <span className="font-mono text-text2">{protection.tickLower} → {protection.tickUpper}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-text3">Coverage blocks</span>
          <span className="font-mono text-text2">{protection.coverageStartBlock} → {protection.coverageEndBlock}</span>
        </div>
        {premiumStreamedUSD > 0 && (
          <div className="flex justify-between">
            <span className="text-text3">Streamed so far</span>
            <span className="font-mono text-text2">${premiumStreamedUSD.toFixed(4)}</span>
          </div>
        )}
      </div>

      {protection.settled && (
        <div className="mt-2 text-center text-[12px] text-text3">Settled</div>
      )}
    </div>
  );
}

export function ProtectionsList({
  active,
  settled,
  isLoading,
}: {
  active: ActiveProtection[];
  settled: ActiveProtection[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="animate-pulse rounded-2xl border border-card-border bg-card p-4">
            <div className="h-5 w-32 rounded bg-input" />
            <div className="mt-2 h-4 w-48 rounded bg-input" />
          </div>
        ))}
      </div>
    );
  }

  if (active.length === 0 && settled.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-card-border bg-card/50 p-6 text-center">
        <div className="text-sm text-text3">No protections found</div>
        <div className="text-[12px] text-text3 mt-1">Protect a position to see it here</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {active.map((p) => (
        <ProtectionCard key={p.ilpnId} protection={p} />
      ))}
      {settled.length > 0 && (
        <div className="text-[12px] text-text3 mt-2 mb-1">Previously settled</div>
      )}
      {settled.map((p) => (
        <ProtectionCard key={p.ilpnId} protection={p} />
      ))}
    </div>
  );
}
