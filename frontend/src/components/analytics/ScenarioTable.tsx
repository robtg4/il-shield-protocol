"use client";

import { computeIL, computePayout } from "@/lib/ilmath";

export function ScenarioTable({ positionValue }: { positionValue: number }) {
  const moves = [5, 10, 20, 50];

  const rows = moves.map((move) => {
    const il = computeIL(positionValue, move);
    return {
      move,
      il,
      payout50: computePayout(il, 0),
      payout75: computePayout(il, 1),
      payout100: computePayout(il, 2),
    };
  });

  return (
    <div className="rounded-xl bg-card overflow-hidden">
      <table className="w-full text-[12px]">
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
              <td className="px-3 py-2 text-right text-red font-mono">${r.il.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="px-3 py-2 text-right text-green font-mono">${r.payout50.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="px-3 py-2 text-right text-green font-mono">${r.payout75.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
              <td className="px-3 py-2 text-right text-green font-mono">${r.payout100.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
