"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";
import { PositionHookCard } from "./PositionHookCard";
import { WhatCouldHappenSlider } from "./WhatCouldHappenSlider";
import { WhatItCostsCard } from "./WhatItCostsCard";
import { HowItWorksSteps } from "./HowItWorksSteps";

function resolveToken1(pair: string, ethPrice: number) {
  const [t0, t1] = pair.split("/");
  const stables = ["USDC", "USDT", "DAI"];
  if (stables.some((s) => t1?.toUpperCase().includes(s))) return { decimals: 6, priceUSD: 1 };
  if (stables.some((s) => t0?.toUpperCase().includes(s))) return { decimals: 18, priceUSD: ethPrice };
  return { decimals: 18, priceUSD: ethPrice };
}

export function SimpleAnalytics({ data }: { data: PositionAnalytics }) {
  const t1 = resolveToken1(data.pair, data.currentPrice);

  return (
    <div className="space-y-3">
      <PositionHookCard
        il={data.currentIL}
        ilAt10Pct={data.ilAt10PctMove}
        historicalProb={data.historicalMoveProb}
        pair={data.pair}
        inRange={data.inRange}
      />
      {data.monthlyPremium > 0 && data.liquidity > BigInt(0) && (
        <WhatCouldHappenSlider
          sqrtPriceX96={data.sqrtPriceX96}
          tickLower={data.tickLower}
          tickUpper={data.tickUpper}
          liquidity={data.liquidity}
          monthlyPremium={data.monthlyPremium}
          estimatedValue={data.estimatedValue}
          token1Decimals={t1.decimals}
          token1PriceUSD={t1.priceUSD}
        />
      )}
      {data.monthlyPremium > 0 && (
        <WhatItCostsCard
          dailyCost={data.dailyCost}
          monthly={data.monthlyPremium}
          breakEven={data.breakEvenMove}
          vaultTVL={data.seniorTVL + data.juniorTVL}
          maxPayout={data.maxPayout}
          historicalProb={data.historicalMoveProb}
        />
      )}
      <HowItWorksSteps />
    </div>
  );
}
