"use client";

import { useMemo } from "react";
import { useChainlinkPrice } from "./useChainlinkPrice";
import { useVaultTotalAssets } from "./useILShield";
import { computeIL, findBreakEven } from "@/lib/ilmath";
import { getHistoricalProb } from "@/lib/scenarios";

export interface PositionAnalytics {
  pair: string;
  positionId: string;
  feeRate: string;
  liquidity: number;
  entryPrice: number;
  currentPrice: number;
  priceChangePct: number;
  inRange: boolean;
  currentIL: number;
  currentILPct: number;
  feeIncome: number;
  feeIncomePct: number;
  netPnL: number;
  netPnLPct: number;
  isNetPositive: boolean;
  ilAt10PctMove: number;
  ilAt50PctMove: number;
  maxILInRange: number;
  historicalMoveProb: number;
  monthlyPremium: number;
  dailyCost: number;
  premiumPerBlock: number;
  breakEvenMove: number;
  premiumAsFeePercent: number;
  seniorTVL: number;
  juniorTVL: number;
  utilization: number;
  combinedRatio: number;
  sjRatio: number;
  maxPayout: number;
  activePositions: number;
  chainlinkAddress: string;
  chainlinkPrice: number;
  chainlinkLastUpdate: number;
  chainlinkDecimals: number;
  twapConfigured: boolean;
}

const DEFAULT_ENTRY_PRICE = 2641;
const DEFAULT_FEE_INCOME = 891.5;
const DEFAULT_POSITION_VALUE = 48291;
const DEFAULT_ACTIVE_POSITIONS = 47;

export function usePositionAnalytics(
  positionId: bigint,
  premiumAmount?: number
): PositionAnalytics {
  const chainlink = useChainlinkPrice();
  const seniorAssets = useVaultTotalAssets("senior");
  const juniorAssets = useVaultTotalAssets("junior");

  return useMemo(() => {
    const currentPrice = chainlink.price || 2048;
    const entryPrice = DEFAULT_ENTRY_PRICE;
    const positionValue = DEFAULT_POSITION_VALUE;
    const feeIncome = DEFAULT_FEE_INCOME;

    const priceChangePct = ((currentPrice - entryPrice) / entryPrice) * 100;
    const currentIL = computeIL(positionValue, Math.abs(priceChangePct));
    const currentILPct = positionValue > 0 ? (currentIL / positionValue) * 100 : 0;
    const feeIncomePct = positionValue > 0 ? (feeIncome / positionValue) * 100 : 0;
    const netPnL = feeIncome - currentIL;
    const netPnLPct = positionValue > 0 ? (netPnL / positionValue) * 100 : 0;

    const ilAt10 = computeIL(positionValue, 10);
    const ilAt50 = computeIL(positionValue, 50);

    // Premium economics
    const monthlyPremium = premiumAmount ? premiumAmount / 1 : 42.17; // default
    const dailyCost = monthlyPremium / 30;
    const premiumPerBlock = dailyCost / 7200; // ~7200 blocks/day at 12s
    const breakEven = findBreakEven(positionValue, monthlyPremium);
    const historicalProb = getHistoricalProb(breakEven);
    const premiumAsFeePercent = feeIncome > 0 ? (dailyCost / (feeIncome / 30)) * 100 : 0;

    // Vault data
    const srTVL = seniorAssets.raw ? Number(seniorAssets.raw) / 1e6 : 5_050_000;
    const jrTVL = juniorAssets.raw ? Number(juniorAssets.raw) / 1e6 : 1_010_000;
    const sjRatio = jrTVL > 0 ? srTVL / jrTVL : 5.0;
    const totalTVL = srTVL + jrTVL;

    return {
      pair: "ETH/USDC",
      positionId: `#${positionId.toString()}`,
      feeRate: "0.30%",
      liquidity: positionValue,
      entryPrice,
      currentPrice,
      priceChangePct,
      inRange: Math.abs(priceChangePct) < 30,
      currentIL,
      currentILPct,
      feeIncome,
      feeIncomePct,
      netPnL,
      netPnLPct,
      isNetPositive: netPnL >= 0,
      ilAt10PctMove: ilAt10,
      ilAt50PctMove: ilAt50,
      maxILInRange: ilAt50,
      historicalMoveProb: historicalProb,
      monthlyPremium,
      dailyCost,
      premiumPerBlock,
      breakEvenMove: breakEven,
      premiumAsFeePercent,
      seniorTVL: srTVL,
      juniorTVL: jrTVL,
      utilization: 12.3,
      combinedRatio: 34,
      sjRatio,
      maxPayout: Math.min(monthlyPremium * 10 * 12, totalTVL),
      activePositions: DEFAULT_ACTIVE_POSITIONS,
      chainlinkAddress: chainlink.address,
      chainlinkPrice: currentPrice,
      chainlinkLastUpdate: chainlink.updatedAt,
      chainlinkDecimals: chainlink.decimals,
      twapConfigured: false,
    };
  }, [chainlink.price, seniorAssets.raw, juniorAssets.raw, positionId, premiumAmount]);
}
