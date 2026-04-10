"use client";

import { useState, useMemo } from "react";
import { computeILAtMove, computePayout, tokenAmountToUSD } from "@/lib/ilmath";
import { ScenarioTable } from "./ScenarioTable";

export function ILCurveChart({
  sqrtPriceX96,
  tickLower,
  tickUpper,
  liquidity,
  monthlyPremium,
  token1Decimals,
  token1PriceUSD,
}: {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  monthlyPremium: number;
  token1Decimals: number;
  token1PriceUSD: number;
}) {
  const [simMove, setSimMove] = useState(0);

  const toUSD = (raw: bigint) => tokenAmountToUSD(raw, token1Decimals, token1PriceUSD);

  // Generate IL curve data points using exact math
  const curvePoints = useMemo(() => {
    const points: { pct: number; il: number }[] = [];
    for (let p = 0; p <= 50; p += 2) {
      const ilRaw = computeILAtMove(sqrtPriceX96, p, tickLower, tickUpper, liquidity);
      points.push({ pct: p, il: toUSD(ilRaw) });
    }
    return points;
  }, [sqrtPriceX96, tickLower, tickUpper, liquidity, token1Decimals, token1PriceUSD]);

  const maxIL = Math.max(...curvePoints.map((p) => p.il), 0.01);
  const simILRaw = computeILAtMove(sqrtPriceX96, simMove, tickLower, tickUpper, liquidity);
  const simIL = toUSD(simILRaw);
  const simPayout = toUSD(computePayout(simILRaw, 2));

  // SVG chart
  const W = 400;
  const H = 160;
  const padT = 8;
  const padB = 20;
  const chartW = W;
  const chartH = H - padT - padB;

  const pathD = curvePoints
    .map((p, i) => {
      const x = (p.pct / 50) * chartW;
      const y = padT + chartH - (p.il / maxIL) * chartH;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const areaD = `${pathD} L${chartW},${padT + chartH} L0,${padT + chartH} Z`;
  const premiumY = padT + chartH - (monthlyPremium / maxIL) * chartH;
  const simX = (simMove / 50) * chartW;
  const simY = padT + chartH - (simIL / maxIL) * chartH;

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-3">IL at different price moves</div>

      <div className="w-full overflow-hidden rounded-xl bg-card p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          <path d={areaD} fill="var(--red)" opacity="0.15" />
          <path d={pathD} fill="none" stroke="var(--red)" strokeWidth="2" />
          {monthlyPremium > 0 && premiumY > padT && (
            <line x1={0} y1={premiumY} x2={chartW} y2={premiumY}
              stroke="var(--text3)" strokeWidth="1" strokeDasharray="4 3" />
          )}
          {simMove > 0 && <circle cx={simX} cy={simY} r="4" fill="var(--pink)" />}
          <text x={0} y={H - 2} fontSize="10" fill="var(--text3)">0%</text>
          <text x={chartW / 2} y={H - 2} fontSize="10" fill="var(--text3)" textAnchor="middle">25%</text>
          <text x={chartW} y={H - 2} fontSize="10" fill="var(--text3)" textAnchor="end">50%</text>
        </svg>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <span className="text-[12px] text-text3">Simulate:</span>
        <input type="range" min={0} max={50} value={simMove}
          onChange={(e) => setSimMove(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-card cursor-pointer accent-pink" />
        <span className="font-mono text-sm text-text1 w-12 text-right">&plusmn;{simMove}%</span>
      </div>
      <div className="mt-1 flex gap-4 text-[12px] font-mono">
        <span className="text-text3">IL: <span className="text-red">${simIL.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
        <span className="text-text3">Payout (100%): <span className="text-green">${simPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span></span>
      </div>

      <div className="mt-4">
        <ScenarioTable sqrtPriceX96={sqrtPriceX96} tickLower={tickLower} tickUpper={tickUpper}
          liquidity={liquidity} token1Decimals={token1Decimals} token1PriceUSD={token1PriceUSD} />
      </div>
    </div>
  );
}
