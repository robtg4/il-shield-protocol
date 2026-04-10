"use client";

import type { PositionAnalytics } from "@/hooks/usePositionAnalytics";
import { PositionRiskCard } from "./PositionRiskCard";
import { ILCurveChart } from "./ILCurveChart";
import { PremiumEconomicsCard } from "./PremiumEconomicsCard";
import { VaultHealthCard } from "./VaultHealthCard";

function resolveToken1(pair: string, ethPrice: number) {
  const [t0, t1] = pair.split("/");
  const stables = ["USDC", "USDT", "DAI"];
  if (stables.some((s) => t1?.toUpperCase().includes(s))) return { decimals: 6, priceUSD: 1 };
  if (stables.some((s) => t0?.toUpperCase().includes(s))) return { decimals: 18, priceUSD: ethPrice };
  return { decimals: 18, priceUSD: ethPrice };
}

export function TechnicalAnalytics({ data }: { data: PositionAnalytics }) {
  const t1 = resolveToken1(data.pair, data.currentPrice);

  return (
    <div className="space-y-3">
      <PositionRiskCard data={data} />
      {data.liquidity > BigInt(0) && (
        <ILCurveChart
          sqrtPriceX96={data.sqrtPriceX96}
          tickLower={data.tickLower}
          tickUpper={data.tickUpper}
          liquidity={data.liquidity}
          monthlyPremium={data.monthlyPremium}
          token1Decimals={t1.decimals}
          token1PriceUSD={t1.priceUSD}
        />
      )}
      {data.monthlyPremium > 0 && <PremiumEconomicsCard data={data} />}
      <VaultHealthCard data={data} />
    </div>
  );
}
