"use client";

import { computeILAtMove, computePayout, tokenAmountToUSD } from "@/lib/ilmath";

export function ScenarioTable({
  sqrtPriceX96,
  tickLower,
  tickUpper,
  liquidity,
  token1Decimals,
  token1PriceUSD,
}: {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  token1Decimals: number;
  token1PriceUSD: number;
}) {
  const moves = [5, 10, 20, 50];

  const rows = moves.map((move) => {
    const ilRaw = computeILAtMove(sqrtPriceX96, move, tickLower, tickUpper, liquidity);
    const toUSD = (raw: bigint) => tokenAmountToUSD(raw, token1Decimals, token1PriceUSD);
    return {
      move,
      il: toUSD(ilRaw),
      payout50: toUSD(computePayout(ilRaw, 0)),
      payout75: toUSD(computePayout(ilRaw, 1)),
      payout100: toUSD(computePayout(ilRaw, 2)),
    };
  });

  return (
    <div className="rounded-xl bg-card overflow-x-auto -mx-1">
      <table className="w-full min-w-[340px] text-[12px]">
        <thead>
          <tr className="text-text3 border-b border-card-border">
            <th className="px-3 py-2 text-left font-medium">Move</th>
            <th className="px-3 py-2 text-right font-medium">IL</th>
            <th className="px-3 py-2 text-right font-medium">50% tier</th>
            <th className="px-3 py-2 text-right font-medium">75% tier</th>
            <th className="px-3 py-2 text-right font-medium">100% tier</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.move} className="border-b border-card-border last:border-0">
              <td className="px-3 py-2 text-text2 font-mono">&plusmn;{r.move}%</td>
              <td className="px-3 py-2 text-right text-red font-mono">${r.il.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="px-3 py-2 text-right text-green font-mono">${r.payout50.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="px-3 py-2 text-right text-green font-mono">${r.payout75.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
              <td className="px-3 py-2 text-right text-green font-mono">${r.payout100.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
