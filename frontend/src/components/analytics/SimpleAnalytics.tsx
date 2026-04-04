"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";
import { PositionHookCard } from "./PositionHookCard";
import { WhatCouldHappenSlider } from "./WhatCouldHappenSlider";
import { WhatItCostsCard } from "./WhatItCostsCard";
import { HowItWorksSteps } from "./HowItWorksSteps";

export function SimpleAnalytics({ data }: { data: PositionAnalytics }) {
  return (
    <div className="space-y-3">
      <PositionHookCard
        il={data.currentIL}
        netPnL={data.netPnL}
        isPositive={data.isNetPositive}
        ilAt10Pct={data.ilAt10PctMove}
        historicalProb={data.historicalMoveProb}
        positionValue={data.liquidity}
      />
      <WhatCouldHappenSlider
        positionValue={data.liquidity}
        monthlyPremium={data.monthlyPremium}
      />
      <WhatItCostsCard
        dailyCost={data.dailyCost}
        monthly={data.monthlyPremium}
        breakEven={data.breakEvenMove}
        vaultTVL={data.seniorTVL + data.juniorTVL}
        maxPayout={data.maxPayout}
        positionValue={data.liquidity}
        historicalProb={data.historicalMoveProb}
      />
      <HowItWorksSteps />
    </div>
  );
}
