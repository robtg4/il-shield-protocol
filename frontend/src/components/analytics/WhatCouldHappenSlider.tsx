"use client";

import { useState } from "react";
import { computeILAtMove, computePayout, tokenAmountToUSD } from "@/lib/ilmath";

export function WhatCouldHappenSlider({
  sqrtPriceX96,
  tickLower,
  tickUpper,
  liquidity,
  monthlyPremium,
  estimatedValue,
  token1Decimals,
  token1PriceUSD,
}: {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  monthlyPremium: number;
  estimatedValue: number;
  token1Decimals: number;
  token1PriceUSD: number;
}) {
  const [movePct, setMovePct] = useState(20);

  const ilRaw = computeILAtMove(sqrtPriceX96, movePct, tickLower, tickUpper, liquidity);
  const ilUSD = tokenAmountToUSD(ilRaw, token1Decimals, token1PriceUSD);
  const payoutRaw = computePayout(ilRaw, 2);
  const payoutUSD = tokenAmountToUSD(payoutRaw, token1Decimals, token1PriceUSD);
  const netWithProtection = payoutUSD - monthlyPremium;
  const lossPct = estimatedValue > 0 ? (ilUSD / estimatedValue) * 100 : 0;

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-4">What could happen</div>

      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] text-text3">ETH moves</span>
        <span className="font-mono text-sm text-text1">&plusmn;{movePct}%</span>
      </div>
      <input
        type="range"
        min={1}
        max={50}
        value={movePct}
        onChange={(e) => setMovePct(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-card cursor-pointer accent-pink mb-4"
      />

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-red-dim p-3">
          <div className="text-[12px] text-text3 mb-1">Without protection</div>
          <div className="font-mono text-xl font-semibold text-red">
            -${ilUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-[12px] text-text3 mt-1">
            you lose {lossPct.toFixed(1)}%
          </div>
        </div>

        <div className={`rounded-xl p-3 ${netWithProtection >= 0 ? "bg-green-dim" : "bg-input"}`}>
          <div className="text-[12px] text-text3 mb-1">With IL Shield</div>
          <div className={`font-mono text-xl font-semibold ${netWithProtection >= 0 ? "text-green" : "text-text2"}`}>
            {netWithProtection >= 0
              ? `+$${netWithProtection.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
              : `-$${Math.abs(netWithProtection).toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
          </div>
          <div className="text-[12px] text-text3 mt-1">
            {netWithProtection >= 0 ? "you get paid" : "just the premium"}
          </div>
        </div>
      </div>
    </div>
  );
}
