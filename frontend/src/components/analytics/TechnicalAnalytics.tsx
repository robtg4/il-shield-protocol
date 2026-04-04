"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";
import { PositionRiskCard } from "./PositionRiskCard";
import { ILCurveChart } from "./ILCurveChart";
import { PremiumEconomicsCard } from "./PremiumEconomicsCard";
import { VaultHealthCard } from "./VaultHealthCard";

export function TechnicalAnalytics({ data }: { data: PositionAnalytics }) {
  const estimatedValue = data.currentPrice * 20;

  return (
    <div className="space-y-3">
      <PositionRiskCard data={data} />
      <ILCurveChart
        positionValue={estimatedValue}
        monthlyPremium={data.monthlyPremium}
      />
      {data.monthlyPremium > 0 && <PremiumEconomicsCard data={data} />}
      <VaultHealthCard data={data} />
    </div>
  );
}
