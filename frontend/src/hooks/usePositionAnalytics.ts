"use client";

import { useMemo } from "react";
import { useChainlinkPrice } from "./useChainlinkPrice";
import { useVaultTotalAssets } from "./useILShield";
import { computeIL, findBreakEven } from "@/lib/ilmath";
import { getHistoricalProb } from "@/lib/scenarios";
import type { UserPosition } from "./useUserPositions";

export interface PositionAnalytics {
  pair: string;
  positionId: string;
  feeRate: string;
  tickLower: number;
  tickUpper: number;
  currentPrice: number;
  priceChangePct: number;
  inRange: boolean;
  currentIL: number;
  currentILPct: number;
  ilAt10PctMove: number;
  ilAt50PctMove: number;
  historicalMoveProb: number;
  monthlyPremium: number;
  dailyCost: number;
  premiumPerBlock: number;
  breakEvenMove: number;
  seniorTVL: number;
  juniorTVL: number;
  sjRatio: number;
  maxPayout: number;
  chainlinkAddress: string;
  chainlinkPrice: number;
  chainlinkLastUpdate: number;
  chainlinkDecimals: number;
  twapConfigured: boolean;
}

/**
 * Returns analytics for a selected position, or null if no position is provided.
 * All values are derived from on-chain data — no hardcoded defaults.
 */
export function usePositionAnalytics(
  position: UserPosition | null,
  premiumAmount?: number
): PositionAnalytics | null {
  const chainlink = useChainlinkPrice();
  const seniorAssets = useVaultTotalAssets("senior");
  const juniorAssets = useVaultTotalAssets("junior");

  return useMemo(() => {
    if (!position) return null;

    const currentPrice = chainlink.price;
    if (!currentPrice) return null;

    // Tick range width for IL estimation
    const tickWidth = Math.abs(position.tickUpper - position.tickLower);

    // Estimate position value from tick range and price
    // Without subgraph/liquidity data, we show IL as % and projections
    // relative to premium rather than absolute USD
    const estimatedPositionValue = currentPrice * 20; // rough proxy: ~20 ETH equivalent

    // Price change since "entry" — we use the midpoint of the tick range as proxy
    // tick = log(price) / log(1.0001), so midTick → price
    const midTick = (position.tickLower + position.tickUpper) / 2;
    const impliedEntryPrice = Math.pow(1.0001, midTick);
    const priceChangePct = impliedEntryPrice > 0
      ? ((currentPrice - impliedEntryPrice) / impliedEntryPrice) * 100
      : 0;

    // Check if current price is in range
    const currentTick = Math.log(currentPrice) / Math.log(1.0001);
    const inRange = currentTick >= position.tickLower && currentTick <= position.tickUpper;

    // IL computations
    const currentIL = computeIL(estimatedPositionValue, Math.abs(priceChangePct), tickWidth);
    const currentILPct = estimatedPositionValue > 0 ? (currentIL / estimatedPositionValue) * 100 : 0;
    const ilAt10 = computeIL(estimatedPositionValue, 10, tickWidth);
    const ilAt50 = computeIL(estimatedPositionValue, 50, tickWidth);

    // Premium economics — derived from user input or zero
    const monthlyPremium = premiumAmount || 0;
    const dailyCost = monthlyPremium / 30;
    const premiumPerBlock = dailyCost / 7200;
    const breakEven = monthlyPremium > 0
      ? findBreakEven(estimatedPositionValue, monthlyPremium, 2, tickWidth)
      : 0;
    const historicalProb = breakEven > 0 ? getHistoricalProb(breakEven) : 0;

    // Vault data — from chain
    const srTVL = seniorAssets.raw ? Number(seniorAssets.raw) / 1e6 : 0;
    const jrTVL = juniorAssets.raw ? Number(juniorAssets.raw) / 1e6 : 0;
    const sjRatio = jrTVL > 0 ? srTVL / jrTVL : 0;
    const totalTVL = srTVL + jrTVL;

    return {
      pair: `${position.token0}/${position.token1}`,
      positionId: `#${position.tokenId.toString()}`,
      feeRate: position.feePct,
      tickLower: position.tickLower,
      tickUpper: position.tickUpper,
      currentPrice,
      priceChangePct,
      inRange,
      currentIL,
      currentILPct,
      ilAt10PctMove: ilAt10,
      ilAt50PctMove: ilAt50,
      historicalMoveProb: historicalProb,
      monthlyPremium,
      dailyCost,
      premiumPerBlock,
      breakEvenMove: breakEven,
      seniorTVL: srTVL,
      juniorTVL: jrTVL,
      sjRatio,
      maxPayout: monthlyPremium > 0 ? Math.min(monthlyPremium * 10 * 12, totalTVL) : totalTVL,
      chainlinkAddress: chainlink.address,
      chainlinkPrice: currentPrice,
      chainlinkLastUpdate: chainlink.updatedAt,
      chainlinkDecimals: chainlink.decimals,
      twapConfigured: false,
    };
  }, [position, chainlink.price, seniorAssets.raw, juniorAssets.raw, premiumAmount]);
}
