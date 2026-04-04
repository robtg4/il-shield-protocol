"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";
import { PositionRiskCard } from "./PositionRiskCard";
import { ILCurveChart } from "./ILCurveChart";
import { PremiumEconomicsCard } from "./PremiumEconomicsCard";
import { VaultHealthCard } from "./VaultHealthCard";

export function TechnicalAnalytics({ data }: { data: PositionAnalytics }) {
  return (
    <div className="space-y-3">
      <PositionRiskCard data={data} />
      <ILCurveChart
        positionValue={data.liquidity}
        monthlyPremium={data.monthlyPremium}
      />
      <PremiumEconomicsCard data={data} />
      <VaultHealthCard data={data} />
    </div>
  );
}
