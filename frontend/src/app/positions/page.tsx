"use client";

import { useState, useMemo, useEffect } from "react";
import { useAccount, useChainId } from "wagmi";
import { BackgroundOrbs } from "@/components/BackgroundOrbs";
import { NavBar } from "@/components/NavBar";
import { StatusBadge } from "@/components/StatusBadge";
import { DexSelector } from "@/components/DexSelector";
import { DexLogo } from "@/components/DexLogo";
import { useUserPositions, type UserPosition } from "@/hooks/useUserPositions";
import { useActiveProtections } from "@/hooks/useActiveProtections";
import { ProtectionsList } from "@/components/ProtectionCard";
import { getDeployedDexesForChain, type DexConfig } from "@/config/dex-registry";

// ──────────────────────────────────────────────────────────────────
// LP Position Card
// ──────────────────────────────────────────────────────────────────

function LPPositionCard({
  position,
  dex,
  onProtect,
}: {
  position: UserPosition;
  dex: DexConfig;
  onProtect: (id: bigint) => void;
}) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-4 transition-colors hover:border-pink/20">
      <div className="flex items-center justify-between">
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
              <DexLogo dexId={dex.id} size={12} />
              <span>{dex.shortName}</span>
              <span>·</span>
              <span>{position.feePct} fee</span>
              <span>·</span>
              <span>#{position.tokenId.toString()}</span>
            </div>
          </div>
        </div>
        <StatusBadge status="in-range" />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-input px-3 py-2.5">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-text3">Tick range</div>
          <div className="font-mono text-sm text-text1">
            {position.tickLower.toLocaleString()} → {position.tickUpper.toLocaleString()}
          </div>
        </div>
        <button
          onClick={() => onProtect(position.tokenId)}
          className="rounded-[16px] bg-pink-cta px-5 py-2.5 text-sm font-semibold text-pink-cta-text transition-colors hover:brightness-110"
        >
          Protect
        </button>
      </div>
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
          type="text"
          inputMode="numeric"
          placeholder="e.g. 226129"
          value={manualId}
          onChange={(e) => {
            if (/^\d*$/.test(e.target.value)) setManualId(e.target.value);
          }}
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
// Main Page
// ──────────────────────────────────────────────────────────────────

export default function PositionsPage() {
  const { isConnected } = useAccount();
  const chainId = useChainId();

  // DEX selection
  const availableDexes = useMemo(() => getDeployedDexesForChain(chainId), [chainId]);
  const [selectedDex, setSelectedDex] = useState<DexConfig | null>(null);
  useEffect(() => {
    if (availableDexes.length > 0 && !selectedDex) setSelectedDex(availableDexes[0]);
  }, [availableDexes, selectedDex]);

  // LP positions from selected DEX
  const { positions, isLoading, hasPositionManager } = useUserPositions(selectedDex, chainId);

  // Active protections from ILShieldCore
  const { active, settled, isLoading: protectionsLoading } = useActiveProtections();

  const handleProtect = (positionId: bigint) => {
    window.location.href = `/?positionId=${positionId.toString()}`;
  };

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />
      <div className="relative z-10 flex min-h-screen flex-col">
        <NavBar />
        <main className="flex flex-1 flex-col items-center px-4 pt-10">
          <h1 className="mb-3 text-center text-4xl font-medium tracking-tight text-text1 md:text-[52px] md:leading-[1.1]">
            Your positions
          </h1>
          <p className="mb-8 text-center text-sm text-text2">
            View your LP positions and active IL protection.
          </p>

          <div className="w-full max-w-[600px] space-y-6">

            {/* ── Active Protections ── */}
            {isConnected && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  <span className="text-sm font-medium text-text1">
                    Your Protections
                    {active.length > 0 && (
                      <span className="ml-1.5 text-[12px] text-pink">({active.length} active)</span>
                    )}
                  </span>
                </div>
                <ProtectionsList
                  active={active}
                  settled={settled}
                  isLoading={protectionsLoading}
                />
              </div>
            )}

            {/* ── LP Positions ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-text1">LP Positions</span>
                {availableDexes.length > 0 && selectedDex && (
                  <DexSelector
                    available={availableDexes}
                    selected={selectedDex}
                    onSelect={setSelectedDex}
                  />
                )}
              </div>

              {!isConnected ? (
                <div className="rounded-3xl border border-card-border bg-card p-8 text-center">
                  <div className="mb-3 flex justify-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                  </div>
                  <div className="mb-1 text-base font-medium text-text1">Connect your wallet</div>
                  <div className="text-sm text-text3">
                    Connect to see your LP positions and active protections.
                  </div>
                </div>
              ) : isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <div key={i} className="animate-pulse rounded-2xl border border-card-border bg-card p-4">
                      <div className="h-5 w-32 rounded bg-input" />
                      <div className="mt-2 h-4 w-48 rounded bg-input" />
                    </div>
                  ))}
                </div>
              ) : positions.length === 0 ? (
                <div className="rounded-3xl border border-card-border bg-card p-8 text-center">
                  <div className="mb-1 text-base font-medium text-text1">
                    No {selectedDex?.name || "LP"} positions found
                  </div>
                  <div className="mb-4 text-sm text-text3">
                    {hasPositionManager
                      ? `No positions detected on ${selectedDex?.name || "this DEX"}. Try a different DEX or enter a position ID manually.`
                      : "Position manager not available on this chain."}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-[12px] text-text3">
                    {positions.length} position{positions.length !== 1 ? "s" : ""} on {selectedDex?.name}
                  </div>
                  {positions.map((pos) => (
                    <LPPositionCard
                      key={pos.tokenId.toString()}
                      position={pos}
                      dex={selectedDex!}
                      onProtect={handleProtect}
                    />
                  ))}
                </div>
              )}

              <div className="mt-3">
                <ManualEntry onProtect={handleProtect} />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
