"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { BackgroundOrbs } from "@/components/BackgroundOrbs";
import { NavBar } from "@/components/NavBar";
import { StatusBadge } from "@/components/StatusBadge";
import { DexLogo } from "@/components/DexLogo";
import { ProgressBar } from "@/components/ProgressBar";
import { useUserPositions, type UserPosition } from "@/hooks/useUserPositions";
import { useActiveProtections, type ActiveProtection } from "@/hooks/useActiveProtections";
import { ProtectionCard } from "@/components/ProtectionCard";
import { getDeployedDexesForChain, type DexConfig } from "@/config/dex-registry";

// ──────────────────────────────────────────────────────────────────
// Position + linked protection
// ──────────────────────────────────────────────────────────────────

interface PositionWithDex extends UserPosition {
  dex: DexConfig;
}

function findLinkedProtection(
  pos: UserPosition,
  protections: ActiveProtection[],
): ActiveProtection | null {
  // Match by tick range — the Core stores the same ticks from the adapter
  return protections.find(
    (p) => p.tickLower === pos.tickLower && p.tickUpper === pos.tickUpper && !p.settled
  ) ?? null;
}

// ──────────────────────────────────────────────────────────────────
// LP Position Card with linked protection
// ──────────────────────────────────────────────────────────────────

function PositionRow({
  position,
  protection,
  onProtect,
}: {
  position: PositionWithDex;
  protection: ActiveProtection | null;
  onProtect: (id: bigint) => void;
}) {
  const tierLabels = ["50%", "75%", "100%"];

  return (
    <div className="rounded-2xl border border-card-border bg-card p-4 transition-colors hover:border-pink/20">
      {/* Position header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#627EEA] text-xs font-bold text-white">
              {position.token0[0]}
            </div>
            <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#2775CA] text-xs font-bold text-white" style={{ border: "2px solid var(--card)" }}>
              {position.token1[0]}
            </div>
          </div>
          <div>
            <div className="text-base font-semibold text-text1">
              {position.token0}/{position.token1}
            </div>
            <div className="flex items-center gap-1.5 text-[12px] text-text3">
              <DexLogo dexId={position.dex.id} size={12} />
              <span>{position.dex.shortName}</span>
              <span>·</span>
              <span>{position.feePct}</span>
              <span>·</span>
              <span className="font-mono">#{position.tokenId.toString()}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {protection ? (
            <div className="flex items-center gap-1.5 rounded-full bg-green-dim px-3 py-1 text-[12px] font-medium text-green">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Protected
            </div>
          ) : (
            <StatusBadge status="in-range" />
          )}
        </div>
      </div>

      {/* Tick range */}
      <div className="flex items-center justify-between rounded-xl bg-input px-3 py-2 text-[12px] mb-3">
        <div>
          <span className="text-text3">Tick range: </span>
          <span className="font-mono text-text1">{position.tickLower.toLocaleString()} → {position.tickUpper.toLocaleString()}</span>
        </div>
      </div>

      {/* Linked protection detail */}
      {protection ? (
        <div className="rounded-xl border border-pink/20 bg-pink-dim/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              <span className="text-[12px] font-medium text-pink">
                ILPN #{protection.ilpnId} · {tierLabels[protection.coverageTier]} coverage
              </span>
            </div>
            <span className="font-mono text-[12px] text-text2">
              ${(Number(protection.premiumBalance) / 1e6).toFixed(4)} remaining
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-text3">Max payout</span>
              <div className="font-mono text-text1">${(Number(protection.maxPayout) / 1e6).toFixed(2)}</div>
            </div>
            <div>
              <span className="text-text3">Rate</span>
              <div className="font-mono text-text1">${(Number(protection.premiumRatePerBlock) * 7200 / 1e12 / 1e6).toFixed(6)}/d</div>
            </div>
            <div>
              <span className="text-text3">Coverage</span>
              <div className="font-mono text-text1">{Math.round((protection.coverageEndBlock - protection.coverageStartBlock) / 7200)}d plan</div>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => onProtect(position.tokenId)}
          className="w-full rounded-xl bg-pink-cta py-2.5 text-sm font-semibold text-pink-cta-text transition-colors hover:brightness-110"
        >
          Protect this position
        </button>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Manual Entry
// ──────────────────────────────────────────────────────────────────

function ManualEntry({ onProtect }: { onProtect: (id: bigint) => void }) {
  const [manualId, setManualId] = useState("");
  return (
    <div className="rounded-2xl border border-dashed border-card-border bg-card/50 p-4">
      <div className="mb-2 text-sm font-medium text-text2">Enter position ID manually</div>
      <div className="flex gap-2">
        <input
          type="text" inputMode="numeric" placeholder="e.g. 226129"
          value={manualId}
          onChange={(e) => { if (/^\d*$/.test(e.target.value)) setManualId(e.target.value); }}
          className="flex-1 rounded-xl bg-input px-3 py-2.5 text-sm text-text1 outline-none placeholder:text-text3 focus:ring-1 focus:ring-pink/30"
        />
        <button
          onClick={() => { if (manualId) onProtect(BigInt(manualId)); }}
          disabled={!manualId}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
            manualId ? "bg-pink-cta text-pink-cta-text hover:brightness-110" : "bg-input text-text3"
          }`}
        >
          Protect
        </button>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────
// Main Page — scans ALL DEXs automatically
// ──────────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const availableDexes = useMemo(() => getDeployedDexesForChain(chainId), [chainId]);

  // Scan ALL deployed DEXs
  const dex0 = availableDexes[0] ?? null;
  const dex1 = availableDexes[1] ?? null;
  const dex2 = availableDexes[2] ?? null;
  const dex3 = availableDexes[3] ?? null;

  const r0 = useUserPositions(dex0, chainId);
  const r1 = useUserPositions(dex1, chainId);
  const r2 = useUserPositions(dex2, chainId);
  const r3 = useUserPositions(dex3, chainId);

  // Merge all positions with their DEX source
  const allPositions: PositionWithDex[] = useMemo(() => {
    const merged: PositionWithDex[] = [];
    const addFromDex = (positions: typeof r0.positions, dex: DexConfig | null) => {
      if (!dex) return;
      for (const p of positions) {
        merged.push({ ...p, dex });
      }
    };
    addFromDex(r0.positions, dex0);
    addFromDex(r1.positions, dex1);
    addFromDex(r2.positions, dex2);
    addFromDex(r3.positions, dex3);
    return merged;
  }, [r0.positions, r1.positions, r2.positions, r3.positions, dex0, dex1, dex2, dex3]);

  const isLoading = r0.isLoading || r1.isLoading || r2.isLoading || r3.isLoading;

  // Active protections
  const { active: activeProtections, settled: settledProtections, isLoading: protectionsLoading } = useActiveProtections();
  const allProtections = [...activeProtections, ...settledProtections];

  const handleProtect = (positionId: bigint) => {
    window.location.href = `/?positionId=${positionId.toString()}`;
  };

  // Count positions per DEX for summary
  const dexCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of allPositions) {
      counts[p.dex.shortName] = (counts[p.dex.shortName] || 0) + 1;
    }
    return counts;
  }, [allPositions]);

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />
      <div className="relative z-10 flex min-h-screen flex-col">
        <NavBar />
        <main className="flex flex-1 flex-col items-center px-4 pt-10 pb-20">
          <h1 className="mb-3 text-center text-4xl font-medium tracking-tight text-text1 md:text-[52px] md:leading-[1.1]">
            Your positions
          </h1>
          <p className="mb-8 text-center text-sm text-text2">
            All your LP positions across supported DEXs, with linked IL Shield protections.
          </p>

          <div className="w-full max-w-[600px] space-y-6">

            {!isConnected ? (
              <div className="rounded-3xl border border-card-border bg-card p-8 text-center">
                <div className="mb-3 flex justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="mb-1 text-base font-medium text-text1">Connect your wallet</div>
                <div className="text-sm text-text3">
                  Connect to see your LP positions and active protections across all supported DEXs.
                </div>
              </div>
            ) : (
              <>
                {/* Summary bar */}
                {allPositions.length > 0 && (
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-sm text-text2">{allPositions.length} position{allPositions.length !== 1 ? "s" : ""}</span>
                    {Object.entries(dexCounts).map(([dex, count]) => (
                      <span key={dex} className="rounded-full bg-input px-2.5 py-1 text-[12px] text-text3">
                        {dex}: {count}
                      </span>
                    ))}
                    {activeProtections.length > 0 && (
                      <span className="rounded-full bg-green-dim px-2.5 py-1 text-[12px] text-green">
                        {activeProtections.length} protected
                      </span>
                    )}
                  </div>
                )}

                {/* Loading */}
                {isLoading && (
                  <div className="space-y-3">
                    {[1, 2].map((i) => (
                      <div key={i} className="animate-pulse rounded-2xl border border-card-border bg-card p-4">
                        <div className="h-5 w-32 rounded bg-input" />
                        <div className="mt-2 h-4 w-48 rounded bg-input" />
                      </div>
                    ))}
                    <div className="text-[12px] text-text3 text-center">
                      Scanning {availableDexes.map((d) => d.shortName).join(", ")}...
                    </div>
                  </div>
                )}

                {/* Position list */}
                {!isLoading && allPositions.length > 0 && (
                  <div className="space-y-3">
                    {allPositions.map((pos) => (
                      <PositionRow
                        key={`${pos.dex.id}-${pos.tokenId.toString()}`}
                        position={pos}
                        protection={findLinkedProtection(pos, allProtections)}
                        onProtect={handleProtect}
                      />
                    ))}
                  </div>
                )}

                {/* No positions */}
                {!isLoading && allPositions.length === 0 && (
                  <div className="rounded-3xl border border-card-border bg-card p-8 text-center">
                    <div className="mb-1 text-base font-medium text-text1">No LP positions found</div>
                    <div className="mb-2 text-sm text-text3">
                      Scanned {availableDexes.map((d) => d.shortName).join(", ")} — no positions detected.
                    </div>
                    <div className="flex items-center justify-center gap-3 mb-4">
                      {availableDexes.map((d) => (
                        <div key={d.id} className="flex items-center gap-1 text-[12px] text-text3">
                          <DexLogo dexId={d.id} size={14} />
                          <span>{d.shortName}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Orphan protections — protections without a matching position */}
                {activeProtections.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3 mt-4">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <span className="text-sm font-medium text-text1">
                        Active protections
                        <span className="ml-1 text-[12px] text-pink">({activeProtections.length})</span>
                      </span>
                    </div>
                    <div className="space-y-2">
                      {activeProtections.map((p) => (
                        <ProtectionCard key={p.ilpnId} protection={p} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Manual entry */}
                <div className="mt-3">
                  <ManualEntry onProtect={handleProtect} />
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
