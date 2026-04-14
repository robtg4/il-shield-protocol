"use client";

import { useBlockNumber } from "wagmi";
import type { ActiveProtection } from "@/hooks/useActiveProtections";
import { useChainlinkPrice } from "@/hooks/useChainlinkPrice";
import { computeILExact, computePayout, tokenAmountToUSD, tickToSqrtPriceX96 } from "@/lib/ilmath";
import { ProgressBar } from "./ProgressBar";

const TIER_LABELS = ["50%", "75%", "100%"];
const BLOCKS_PER_DAY = 7200;

/**
 * Derive a sqrtPriceX96 from Chainlink ETH/USD price.
 * For a USDC/WETH pool (token0=USDC, token1=WETH): price = ethPriceUSD
 * sqrtPriceX96 = sqrt(price) * 2^96
 */
function ethPriceToSqrtPriceX96(ethPriceUSD: number): bigint {
  if (ethPriceUSD <= 0) return BigInt(0);
  const sqrtPrice = Math.sqrt(ethPriceUSD);
  const Q96 = Number(BigInt(2) ** BigInt(96));
  return BigInt(Math.round(sqrtPrice * Q96));
}

export function ProtectionCard({ protection }: { protection: ActiveProtection }) {
  const { data: blockNum } = useBlockNumber({ watch: true });
  const currentBlock = blockNum ? Number(blockNum) : 0;
  const chainlink = useChainlinkPrice();

  const tierLabel = TIER_LABELS[protection.coverageTier] || "?";
  const premiumBalUSD = Number(protection.premiumBalance) / 1e6;
  const premiumDepositUSD = Number(protection.premiumDeposit) / 1e6;
  const maxPayoutUSD = Number(protection.maxPayout) / 1e6;
  const isActive = !protection.settled && protection.premiumBalance > BigInt(0);

  // Time calculations
  const coverageDurationBlocks = protection.coverageEndBlock - protection.coverageStartBlock;
  const coverageDurationDays = coverageDurationBlocks / BLOCKS_PER_DAY;
  const blocksRemaining = Math.max(0, protection.coverageEndBlock - currentBlock);
  const daysRemaining = blocksRemaining / BLOCKS_PER_DAY;
  const coverageElapsedPct = coverageDurationBlocks > 0
    ? Math.min(100, Math.max(0, ((currentBlock - protection.coverageStartBlock) / coverageDurationBlocks) * 100))
    : 0;

  // Premium streaming
  const ratePerDayUSD = Number(protection.premiumRatePerBlock) * BLOCKS_PER_DAY / 1e12 / 1e6;
  const premiumStreamedUSD = premiumDepositUSD - premiumBalUSD;
  const premiumPctRemaining = premiumDepositUSD > 0 ? (premiumBalUSD / premiumDepositUSD) * 100 : 0;

  // ── Current IL + payout computation ──
  // Use Chainlink price to derive current sqrtPriceX96, then compute IL
  const currentSqrtPriceX96 = chainlink.price > 0
    ? ethPriceToSqrtPriceX96(chainlink.price)
    : BigInt(0);

  const hasEntryPrice = protection.entrySqrtPriceX96 > BigInt(0);
  const hasLiquidity = protection.liquidity > BigInt(0);
  const canComputeIL = hasEntryPrice && hasLiquidity && currentSqrtPriceX96 > BigInt(0);

  let currentILRaw = BigInt(0);
  let currentPayoutRaw = BigInt(0);
  let currentILUSD = 0;
  let currentPayoutUSD = 0;

  if (canComputeIL) {
    currentILRaw = computeILExact(
      protection.entrySqrtPriceX96,
      currentSqrtPriceX96,
      protection.tickLower,
      protection.tickUpper,
      protection.liquidity,
    );
    currentPayoutRaw = computePayout(
      currentILRaw,
      protection.coverageTier as 0 | 1 | 2,
      200, // 2% settlement fee
    );

    // Cap at maxPayout
    if (currentPayoutRaw > protection.maxPayout) {
      currentPayoutRaw = protection.maxPayout;
    }

    // Convert to USD — token1 is WETH (18 dec) for USDC/WETH pool
    // IL is in token1 terms. For USDC/WETH: token1 = WETH, so multiply by ETH price
    // For WETH/USDC (token0=WETH): token1 = USDC (6 dec, $1)
    // Detect from entry price magnitude — if entry sqrtPrice is very large, token0 is USDC
    const entryPrice = Number(protection.entrySqrtPriceX96);
    const isToken1WETH = entryPrice > 1e30; // USDC/WETH pools have very large sqrtPriceX96

    if (isToken1WETH) {
      // IL is in WETH terms (18 dec)
      currentILUSD = tokenAmountToUSD(currentILRaw, 18, chainlink.price);
      currentPayoutUSD = tokenAmountToUSD(currentPayoutRaw, 18, chainlink.price);
    } else {
      // IL is in USDC terms (6 dec)
      currentILUSD = tokenAmountToUSD(currentILRaw, 6, 1);
      currentPayoutUSD = tokenAmountToUSD(currentPayoutRaw, 6, 1);
    }
  }

  // Net ROI if settled now
  const netIfSettledNow = currentPayoutUSD - premiumStreamedUSD;

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

      {/* ── Current IL + Payout (the hero section) ── */}
      {!protection.settled && canComputeIL && (
        <div className="rounded-xl bg-input p-3 mb-3">
          <div className="text-[12px] text-text3 mb-2">If you settled now</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center">
              <div className="text-[11px] text-text3">Current IL</div>
              <div className={`font-mono text-sm font-semibold ${currentILUSD > 0 ? "text-red" : "text-text2"}`}>
                {currentILUSD > 0.001 ? `-$${currentILUSD.toFixed(4)}` : "$0"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[11px] text-text3">Payout</div>
              <div className={`font-mono text-sm font-semibold ${currentPayoutUSD > 0 ? "text-green" : "text-text2"}`}>
                {currentPayoutUSD > 0.001 ? `+$${currentPayoutUSD.toFixed(4)}` : "$0"}
              </div>
            </div>
            <div className="text-center">
              <div className="text-[11px] text-text3">Net P&L</div>
              <div className={`font-mono text-sm font-semibold ${netIfSettledNow >= 0 ? "text-green" : "text-red"}`}>
                {netIfSettledNow >= 0 ? `+$${netIfSettledNow.toFixed(4)}` : `-$${Math.abs(netIfSettledNow).toFixed(4)}`}
              </div>
            </div>
          </div>
          <div className="text-[11px] text-text3 text-center mt-1.5">
            ETH ${chainlink.price.toLocaleString()} (Chainlink) · premium streamed: ${premiumStreamedUSD.toFixed(4)}
          </div>
        </div>
      )}

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
          <div className="text-[11px] text-text3">10x premium cap</div>
        </div>
      </div>

      {/* Premium streaming bar */}
      {!protection.settled && premiumDepositUSD > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[12px] mb-1">
            <span className="text-text3">Premium streaming</span>
            <span className="font-mono text-text3">${ratePerDayUSD > 0 ? ratePerDayUSD.toFixed(6) : "0"}/day</span>
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
