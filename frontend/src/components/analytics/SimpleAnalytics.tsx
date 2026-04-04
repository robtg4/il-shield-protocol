"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";
import { PositionHookCard } from "./PositionHookCard";
import { WhatCouldHappenSlider } from "./WhatCouldHappenSlider";
import { WhatItCostsCard } from "./WhatItCostsCard";
import { HowItWorksSteps } from "./HowItWorksSteps";

export function SimpleAnalytics({ data }: { data: PositionAnalytics }) {
  const estimatedValue = data.currentPrice * 20;

  return (
    <div className="space-y-3">
      <PositionHookCard
        il={data.currentIL}
        ilAt10Pct={data.ilAt10PctMove}
        historicalProb={data.historicalMoveProb}
        pair={data.pair}
        inRange={data.inRange}
      />
      {data.monthlyPremium > 0 && (
        <WhatCouldHappenSlider
          positionValue={estimatedValue}
          monthlyPremium={data.monthlyPremium}
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
