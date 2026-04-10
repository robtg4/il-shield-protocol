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
  estimatedValue: number;
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
 * Estimate USD value of a concentrated liquidity position.
 * Uses the Uniswap v3 formula: value ≈ 2 * L * sqrt(P) * (sqrt(Pu) - sqrt(Pl)) / (sqrt(Pu) * sqrt(Pl))
 * Simplified for display: approximate as L * price_range_width / 1e18
 */
function estimatePositionValueUSD(
  liquidity: bigint,
  currentPrice: number,
  tickLower: number,
  tickUpper: number,
): number {
  if (liquidity === BigInt(0)) return 0;

  // Convert ticks to prices
  const priceLower = Math.pow(1.0001, tickLower);
  const priceUpper = Math.pow(1.0001, tickUpper);

  // For a USDC/WETH pool where tick increases = WETH gets more expensive in USDC terms:
  // Value in token1 (WETH) terms ≈ L * (sqrt(upper) - sqrt(lower)) / 1e18
  const sqrtLower = Math.sqrt(priceLower);
  const sqrtUpper = Math.sqrt(priceUpper);
  const liqNum = Number(liquidity);

  // Approximate: token1 amount ≈ L * (sqrtUpper - sqrtLower)
  // token0 amount ≈ L * (1/sqrtLower - 1/sqrtUpper)
  // Total USD ≈ token0_usd + token1_usd
  // This is a rough estimate — good enough for analytics display
  const token1Amount = liqNum * (sqrtUpper - sqrtLower) / 1e18;
  const token0Amount = liqNum * (1 / sqrtLower - 1 / sqrtUpper) / 1e6; // USDC has 6 decimals

  // token0 is typically USDC (value = amount), token1 is WETH (value = amount * price)
  const valueUSD = token0Amount + token1Amount * currentPrice;

  // Sanity cap — if the estimate is negative or absurd, return 0
  if (valueUSD < 0 || !isFinite(valueUSD)) return 0;
  return valueUSD;
}

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

    const tickWidth = Math.abs(position.tickUpper - position.tickLower);

    // Estimate position value from actual liquidity
    const estimatedValue = estimatePositionValueUSD(
      position.liquidity, currentPrice, position.tickLower, position.tickUpper
    );

    // Price change: midpoint of tick range as implied entry
    const midTick = (position.tickLower + position.tickUpper) / 2;
    const impliedEntryPrice = Math.pow(1.0001, midTick);
    // The tick-to-price gives USDC per WETH for a USDC/WETH pool
    // Compare against Chainlink ETH/USD
    const priceChangePct = impliedEntryPrice > 0 && impliedEntryPrice < 1e12
      ? ((currentPrice - impliedEntryPrice) / impliedEntryPrice) * 100
      : 0;

    // Check if current price is in range
    const currentTick = Math.log(currentPrice) / Math.log(1.0001);
    const inRange = currentTick >= position.tickLower && currentTick <= position.tickUpper;

    // IL computations — use real estimated value
    const posValue = Math.max(estimatedValue, 1); // avoid division by zero
    const currentIL = computeIL(posValue, Math.abs(priceChangePct), tickWidth);
    const currentILPct = posValue > 0 ? (currentIL / posValue) * 100 : 0;
    const ilAt10 = computeIL(posValue, 10, tickWidth);
    const ilAt50 = computeIL(posValue, 50, tickWidth);

    // Premium economics
    const monthlyPremium = premiumAmount || 0;
    const dailyCost = monthlyPremium / 30;
    const premiumPerBlock = dailyCost / 7200;
    const breakEven = monthlyPremium > 0
      ? findBreakEven(posValue, monthlyPremium, 2, tickWidth)
      : 0;
    const historicalProb = breakEven > 0 ? getHistoricalProb(breakEven) : 0;

    // Vault data
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
      estimatedValue,
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
