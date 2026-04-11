"use client";

import type { ActiveProtection } from "@/hooks/useActiveProtections";

const TIER_LABELS = ["50%", "75%", "100%"];

export function ProtectionCard({ protection }: { protection: ActiveProtection }) {
  const tierLabel = TIER_LABELS[protection.coverageTier] || "?";
  const premiumUSD = Number(protection.premiumBalance) / 1e6;
  const maxPayoutUSD = Number(protection.maxPayout) / 1e6;
  const isActive = !protection.settled && protection.premiumBalance > BigInt(0);
  const isDepleted = !protection.settled && protection.premiumBalance === BigInt(0);

  return (
    <div className={`rounded-2xl border p-4 ${
      protection.settled
        ? "border-card-border bg-card/50 opacity-50"
        : isActive
          ? "border-pink/30 bg-card"
          : "border-amber/30 bg-card"
    }`}>
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
            <div className="text-sm font-semibold text-text1">
              Protection #{protection.ilpnId}
            </div>
            <div className="text-[12px] text-text3">
              {tierLabel} coverage · ticks {protection.tickLower} → {protection.tickUpper}
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

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-input p-2.5">
          <div className="text-[12px] text-text3 mb-0.5">Premium remaining</div>
          <div className="font-mono text-sm font-semibold text-text1">
            ${premiumUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
        </div>
        <div className="rounded-xl bg-input p-2.5">
          <div className="text-[12px] text-text3 mb-0.5">Max payout</div>
          <div className="font-mono text-sm font-semibold text-text1">
            ${maxPayoutUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
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
