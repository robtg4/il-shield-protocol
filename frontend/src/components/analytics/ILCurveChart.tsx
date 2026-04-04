"use client";

import { useState, useMemo } from "react";
import { computeIL, computePayout } from "@/lib/ilmath";
import { ScenarioTable } from "./ScenarioTable";

export function ILCurveChart({
  positionValue,
  monthlyPremium,
}: {
  positionValue: number;
  monthlyPremium: number;
}) {
  const [simMove, setSimMove] = useState(0);

  // Generate IL curve data points
  const curvePoints = useMemo(() => {
    const points: { pct: number; il: number }[] = [];
    for (let p = 0; p <= 50; p += 1) {
      points.push({ pct: p, il: computeIL(positionValue, p) });
    }
    return points;
  }, [positionValue]);

  const maxIL = Math.max(...curvePoints.map((p) => p.il), 1);
  const simIL = computeIL(positionValue, simMove);
  const simPayout = computePayout(simIL, 2);

  // SVG chart dimensions
  const W = 400;
  const H = 160;
  const padL = 0;
  const padR = 0;
  const padT = 8;
  const padB = 20;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const pathD = curvePoints
    .map((p, i) => {
      const x = padL + (p.pct / 50) * chartW;
      const y = padT + chartH - (p.il / maxIL) * chartH;
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");

  const areaD = `${pathD} L${padL + chartW},${padT + chartH} L${padL},${padT + chartH} Z`;

  // Premium line Y
  const premiumY = padT + chartH - (monthlyPremium / maxIL) * chartH;

  // Sim marker
  const simX = padL + (simMove / 50) * chartW;
  const simY = padT + chartH - (simIL / maxIL) * chartH;

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-3">IL at different price moves</div>

      {/* SVG Chart */}
      <div className="w-full overflow-hidden rounded-xl bg-card p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
          {/* Fill area */}
          <path d={areaD} fill="var(--red)" opacity="0.15" />
          {/* IL curve */}
          <path d={pathD} fill="none" stroke="var(--red)" strokeWidth="2" />
          {/* Premium line */}
          {monthlyPremium > 0 && premiumY > padT && (
            <line
              x1={padL} y1={premiumY} x2={padL + chartW} y2={premiumY}
              stroke="var(--text3)" strokeWidth="1" strokeDasharray="4 3"
            />
          )}
          {/* Sim marker */}
          {simMove > 0 && (
            <circle cx={simX} cy={simY} r="4" fill="var(--pink)" />
          )}
          {/* X axis labels */}
          <text x={padL} y={H - 2} fontSize="10" fill="var(--text3)">0%</text>
          <text x={padL + chartW / 2} y={H - 2} fontSize="10" fill="var(--text3)" textAnchor="middle">25%</text>
          <text x={padL + chartW} y={H - 2} fontSize="10" fill="var(--text3)" textAnchor="end">50%</text>
        </svg>
      </div>

      {/* Slider */}
      <div className="mt-3 flex items-center gap-3">
        <span className="text-[12px] text-text3">Simulate:</span>
        <input
          type="range"
          min={0}
          max={50}
          value={simMove}
          onChange={(e) => setSimMove(Number(e.target.value))}
          className="flex-1 h-1.5 rounded-full appearance-none bg-card cursor-pointer accent-pink"
        />
        <span className="font-mono text-sm text-text1 w-12 text-right">&plusmn;{simMove}%</span>
      </div>
      <div className="mt-1 flex gap-4 text-[12px] font-mono">
        <span className="text-text3">IL: <span className="text-red">${simIL.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
        <span className="text-text3">Payout (100%): <span className="text-green">${simPayout.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
      </div>

      {/* Scenario table */}
      <div className="mt-4">
        <ScenarioTable positionValue={positionValue} />
      </div>
    </div>
  );
}
