"use client";

import { useMemo } from "react";
import { computeILAtMove, computePayout, tokenAmountToUSD } from "@/lib/ilmath";

interface GuidanceRow {
  move: number;
  ilUSD: number;
  minDeposit: number;
  covered: boolean;
}

/**
 * Shows the user how much to deposit to actually cover their IL at different price moves.
 * "100% coverage" only means 100% if maxPayout (10x deposit) >= actual IL.
 */
export function DepositGuidance({
  sqrtPriceX96,
  tickLower,
  tickUpper,
  liquidity,
  currentDeposit,
  coverageTier,
  token1Decimals,
  token1PriceUSD,
}: {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  currentDeposit: number; // USD
  coverageTier: number;
  token1Decimals: number;
  token1PriceUSD: number;
}) {
  const rows = useMemo(() => {
    if (liquidity === BigInt(0) || sqrtPriceX96 === BigInt(0)) return [];

    const moves = [10, 20, 30, 50];
    const tierMult = coverageTier === 0 ? 0.5 : coverageTier === 1 ? 0.75 : 1.0;

    return moves.map((move): GuidanceRow => {
      const ilRaw = computeILAtMove(sqrtPriceX96, move, tickLower, tickUpper, liquidity);
      const payoutRaw = computePayout(ilRaw, coverageTier as 0 | 1 | 2, 200);
      const ilUSD = tokenAmountToUSD(ilRaw, token1Decimals, token1PriceUSD) * tierMult;
      const payoutUSD = tokenAmountToUSD(payoutRaw, token1Decimals, token1PriceUSD);

      // maxPayout = deposit * 10, after 2% fee: effective = deposit * 10 * 0.98 = deposit * 9.8
      // To fully cover: deposit >= ilUSD / 9.8
      const minDeposit = ilUSD > 0 ? ilUSD / 9.8 : 0;
      const maxPayout = currentDeposit * 9.8;
      const covered = maxPayout >= ilUSD;

      return { move, ilUSD, minDeposit, covered };
    });
  }, [sqrtPriceX96, tickLower, tickUpper, liquidity, coverageTier, currentDeposit, token1Decimals, token1PriceUSD]);

  if (rows.length === 0) return null;

  const tierLabel = coverageTier === 0 ? "50%" : coverageTier === 1 ? "75%" : "100%";

  // Find the largest move that's currently covered
  const coveredUpTo = rows.filter((r) => r.covered).pop();
  const firstUncovered = rows.find((r) => !r.covered);

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-3">
        How much deposit do I need?
      </div>

      {/* Explanation */}
      <div className="text-[12px] text-text2 mb-3">
        Your max payout = <span className="text-text1 font-medium">10× your deposit</span> (minus 2% fee).
        To fully cover your IL at {tierLabel} coverage, deposit enough so 10× your deposit exceeds the potential IL.
      </div>

      {/* Guidance table */}
      <div className="rounded-xl bg-card overflow-hidden mb-3">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="text-text3 border-b border-card-border">
              <th className="px-3 py-2 text-left font-medium">If price moves</th>
              <th className="px-3 py-2 text-right font-medium">IL ({tierLabel})</th>
              <th className="px-3 py-2 text-right font-medium">Min deposit</th>
              <th className="px-3 py-2 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.move} className="border-b border-card-border last:border-0">
                <td className="px-3 py-2 text-text2 font-mono">&plusmn;{r.move}%</td>
                <td className="px-3 py-2 text-right text-red font-mono">
                  ${r.ilUSD < 0.01 ? r.ilUSD.toFixed(6) : r.ilUSD.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right text-text1 font-mono">
                  ${r.minDeposit < 0.01 ? r.minDeposit.toFixed(6) : r.minDeposit.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right">
                  {r.covered ? (
                    <span className="text-green text-[11px]">Covered</span>
                  ) : (
                    <span className="text-amber text-[11px]">Under-insured</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      {currentDeposit > 0 && (
        <div className={`rounded-xl p-3 text-[12px] ${
          firstUncovered ? "bg-amber-dim text-amber" : "bg-green-dim text-green"
        }`}>
          {firstUncovered ? (
            <>
              Your ${currentDeposit.toFixed(2)} deposit covers up to a{" "}
              <span className="font-medium">&plusmn;{coveredUpTo?.move ?? 0}% move</span>.
              For full {tierLabel} coverage at &plusmn;{firstUncovered.move}%, deposit at least{" "}
              <span className="font-mono font-medium">${firstUncovered.minDeposit.toFixed(2)}</span>.
            </>
          ) : (
            <>
              Your deposit fully covers {tierLabel} IL protection up to &plusmn;50% price moves.
            </>
          )}
        </div>
      )}

      {currentDeposit === 0 && firstUncovered && (
        <div className="rounded-xl bg-input p-3 text-[12px] text-text3">
          Enter a deposit amount above to see your coverage status.
        </div>
      )}
    </div>
  );
}
