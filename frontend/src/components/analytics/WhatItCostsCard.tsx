"use client";

import { getCostComparison } from "@/lib/scenarios";

export function WhatItCostsCard({
  dailyCost,
  monthly,
  breakEven,
  vaultTVL,
  maxPayout,
  historicalProb,
}: {
  dailyCost: number;
  monthly: number;
  breakEven: number;
  vaultTVL: number;
  maxPayout: number;
  historicalProb: number;
}) {
  const comparison = getCostComparison(monthly);
  const probPct = Math.round(historicalProb * 100);

  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-3">What it costs</div>

      <div className="font-mono text-2xl font-semibold text-text1">
        ${dailyCost.toFixed(2)} per day
      </div>
      <div className="text-sm text-text2 mt-1">
        ${monthly.toFixed(0)}/month &mdash; {comparison}.
      </div>

      <div className="mt-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-pink-dim">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
          <div>
            <div className="text-sm text-text1">Protection pays for itself if ETH moves &plusmn;{breakEven}%</div>
            <div className="text-[12px] text-text3">This happens {probPct > 50 ? `${probPct}% of months` : `about ${Math.round(probPct / 10)} in 10 months`}</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-dim">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9 12 2 2 4-4" />
            </svg>
          </div>
          <div>
            <div className="text-sm text-text1">${(vaultTVL / 1e6).toFixed(1)}M in vault reserves</div>
            <div className="text-[12px] text-text3">Your max payout: ${maxPayout.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
