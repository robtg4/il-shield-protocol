"use client";

import { useState } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { BackgroundOrbs } from "@/components/BackgroundOrbs";
import { NavBar } from "@/components/NavBar";
import { StatusBadge } from "@/components/StatusBadge";
import {
  POSITION_MANAGER_ADDRESS,
  POSITION_MANAGER_ABI,
  decodePositionInfo,
} from "@/lib/positionManager";

// Known token addresses on Unichain Sepolia (expand as needed)
const TOKEN_LABELS: Record<string, string> = {
  "0x0000000000000000000000000000000000000000": "ETH",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0x31d0220469e10c4e71834a79b1f276d740d3768f": "USDC",
};

function tokenLabel(addr: string): string {
  return TOKEN_LABELS[addr.toLowerCase()] || `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function PositionCard({
  tokenId,
  onProtect,
}: {
  tokenId: bigint;
  onProtect: (id: bigint) => void;
}) {
  const { data, isLoading, isError } = useReadContract({
    address: POSITION_MANAGER_ADDRESS,
    abi: POSITION_MANAGER_ABI,
    functionName: "getPoolAndPositionInfo",
    args: [tokenId],
  });

  if (isLoading) {
    return (
      <div className="animate-pulse rounded-2xl border border-card-border bg-card p-4">
        <div className="h-5 w-32 rounded bg-input" />
        <div className="mt-2 h-4 w-48 rounded bg-input" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="rounded-2xl border border-card-border bg-card p-4">
        <div className="text-sm text-text3">Position #{tokenId.toString()} — unable to load</div>
      </div>
    );
  }

  const [poolKey, packedInfo] = data as [
    { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string },
    bigint,
  ];
  const info = decodePositionInfo(packedInfo);
  const token0 = tokenLabel(poolKey.currency0);
  const token1 = tokenLabel(poolKey.currency1);
  const feePct = (Number(poolKey.fee) / 10000).toFixed(2);

  return (
    <div className="rounded-2xl border border-card-border bg-card p-4 transition-colors hover:border-pink/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Token pair logos */}
          <div className="flex items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#627EEA] text-xs font-bold text-white">
              {token0[0]}
            </div>
            <div className="-ml-2 flex h-8 w-8 items-center justify-center rounded-full bg-[#2775CA] text-xs font-bold text-white" style={{ border: "2px solid var(--card)" }}>
              {token1[0]}
            </div>
          </div>
          <div>
            <div className="text-base font-semibold text-text1">
              {token0}/{token1}
            </div>
            <div className="text-xs text-text3">{feePct}% fee · ID #{tokenId.toString()}</div>
          </div>
        </div>
        <StatusBadge status="in-range" />
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl bg-input px-3 py-2">
        <div>
          <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-text3">Tick range</div>
          <div className="font-mono text-sm text-text1">
            {info.tickLower.toLocaleString()} → {info.tickUpper.toLocaleString()}
          </div>
        </div>
        <button
          onClick={() => onProtect(tokenId)}
          className="rounded-[16px] bg-pink-cta px-5 py-2.5 text-sm font-semibold text-pink-cta-text transition-colors hover:brightness-110"
        >
          Protect
        </button>
      </div>
    </div>
  );
}

function ManualEntry({ onProtect }: { onProtect: (id: bigint) => void }) {
  const [manualId, setManualId] = useState("");

  return (
    <div className="rounded-2xl border border-dashed border-card-border bg-card/50 p-4">
      <div className="mb-2 text-sm font-medium text-text2">Enter position ID manually</div>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          placeholder="e.g. 12345"
          value={manualId}
          onChange={(e) => {
            if (/^\d*$/.test(e.target.value)) setManualId(e.target.value);
          }}
          className="flex-1 rounded-xl bg-input px-3 py-2 text-sm text-text1 outline-none placeholder:text-text3 focus:ring-1 focus:ring-pink/30"
        />
        <button
          onClick={() => {
            if (manualId) onProtect(BigInt(manualId));
          }}
          disabled={!manualId}
          className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
            manualId
              ? "bg-pink-cta text-pink-cta-text hover:brightness-110"
              : "bg-input text-text3"
          }`}
        >
          Protect
        </button>
      </div>
    </div>
  );
}

export default function PositionsPage() {
  const { address, isConnected } = useAccount();

  // Read user's position count from PositionManager
  const { data: balanceData } = useReadContract({
    address: POSITION_MANAGER_ADDRESS,
    abi: POSITION_MANAGER_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const positionCount = balanceData ? Number(balanceData as bigint) : 0;

  // Build calls to get each tokenId
  const tokenIdCalls = Array.from({ length: Math.min(positionCount, 50) }, (_, i) => ({
    address: POSITION_MANAGER_ADDRESS,
    abi: POSITION_MANAGER_ABI,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)] as const,
  }));

  const { data: tokenIdsData } = useReadContracts({
    contracts: tokenIdCalls,
    query: { enabled: positionCount > 0 && !!address },
  });

  const tokenIds: bigint[] = (tokenIdsData || [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => r.result as bigint);

  const handleProtect = (positionId: bigint) => {
    // Navigate to protect page with position ID as query param
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
            Select a Uniswap v4 position to protect against impermanent loss.
          </p>

          <div className="w-full max-w-[520px] space-y-3">
            {!isConnected ? (
              <div className="rounded-3xl border border-card-border bg-card p-8 text-center">
                <div className="mb-3 flex justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <div className="mb-1 text-base font-medium text-text1">Connect your wallet</div>
                <div className="text-sm text-text3">
                  Connect to see your Uniswap v4 LP positions eligible for IL protection.
                </div>
              </div>
            ) : positionCount === 0 ? (
              <>
                <div className="rounded-3xl border border-card-border bg-card p-8 text-center">
                  <div className="mb-3 flex justify-center">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M8 12h8M12 8v8" />
                    </svg>
                  </div>
                  <div className="mb-1 text-base font-medium text-text1">No positions found</div>
                  <div className="mb-4 text-sm text-text3">
                    No Uniswap v4 positions detected for this wallet on Unichain Sepolia.
                    You can enter a position ID manually below.
                  </div>
                </div>
                <ManualEntry onProtect={handleProtect} />
              </>
            ) : (
              <>
                <div className="mb-1 text-sm text-text3">
                  {positionCount} position{positionCount !== 1 ? "s" : ""} found
                </div>
                {tokenIds.map((id) => (
                  <PositionCard key={id.toString()} tokenId={id} onProtect={handleProtect} />
                ))}
                <div className="mt-2 border-t border-card-border pt-3">
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
