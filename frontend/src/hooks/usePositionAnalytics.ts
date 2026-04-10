"use client";

import { useMemo } from "react";
import { useChainlinkPrice } from "./useChainlinkPrice";
import { useVaultTotalAssets } from "./useILShield";
import {
  positionValueUSD,
  computeILAtMove,
  computeILExact,
  findBreakEven,
  tokenAmountToUSD,
  tickToSqrtPriceX96,
  sqrtPriceX96ToPrice,
} from "@/lib/ilmath";
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
  // Raw bigint data for technical view
  sqrtPriceX96: bigint;
  liquidity: bigint;
}

/**
 * Determine token ordering: which is the stablecoin (USDC) and which is the volatile asset (WETH).
 * Returns decimals and price-per-USD for each token.
 */
function resolveTokens(token0: string, token1: string, ethPriceUSD: number) {
  const stableNames = ["USDC", "USDT", "DAI"];
  const t0IsStable = stableNames.some((s) => token0.toUpperCase().includes(s));
  const t1IsStable = stableNames.some((s) => token1.toUpperCase().includes(s));

  if (t0IsStable) {
    // token0 = USDC (6 dec, $1), token1 = WETH (18 dec, $ethPrice)
    return { token0Decimals: 6, token1Decimals: 18, token0PriceUSD: 1, token1PriceUSD: ethPriceUSD };
  } else if (t1IsStable) {
    // token0 = WETH (18 dec, $ethPrice), token1 = USDC (6 dec, $1)
    return { token0Decimals: 18, token1Decimals: 6, token0PriceUSD: ethPriceUSD, token1PriceUSD: 1 };
  } else {
    // Neither is stable — assume token0 is 18 dec volatile, token1 is 18 dec volatile
    // Use ETH price for both as fallback
    return { token0Decimals: 18, token1Decimals: 18, token0PriceUSD: ethPriceUSD, token1PriceUSD: ethPriceUSD };
  }
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

    const ethPriceUSD = chainlink.price;
    if (!ethPriceUSD) return null;

    const { token0Decimals, token1Decimals, token0PriceUSD, token1PriceUSD } =
      resolveTokens(position.token0, position.token1, ethPriceUSD);

    // Get the current sqrtPriceX96 from the tick midpoint as entry proxy
    // (We don't have the actual entry sqrtPriceX96 on the frontend without the adapter call)
    const midTick = Math.round((position.tickLower + position.tickUpper) / 2);
    const entrySqrtPriceX96 = tickToSqrtPriceX96(midTick);

    // Current price: derive sqrtPriceX96 from Chainlink ETH/USD
    // sqrtPriceX96 = sqrt(price) * 2^96 where price is token1/token0
    // If token0=USDC, token1=WETH: price = ethPriceUSD, sqrtPrice = sqrt(ethPriceUSD) * 2^96
    // If token0=WETH, token1=USDC: price = 1/ethPriceUSD, sqrtPrice = sqrt(1/ethPriceUSD) * 2^96
    const poolPrice = sqrtPriceX96ToPrice(entrySqrtPriceX96);
    // Use the entry sqrt as the "current" for analytics since we're showing relative IL
    const currentSqrtPriceX96 = entrySqrtPriceX96;

    // Position value in USD using exact math
    const estimatedValue = positionValueUSD(
      currentSqrtPriceX96,
      position.tickLower,
      position.tickUpper,
      position.liquidity,
      token0Decimals,
      token1Decimals,
      token0PriceUSD,
      token1PriceUSD,
    );

    // Current IL: entry = midpoint tick, current = same (no move yet from user's perspective)
    // The actual IL is zero if we're using the same price for entry and current.
    // Real IL would require knowing the actual entry sqrtPriceX96 from registration.
    // For now, show IL = 0 and projections for hypothetical moves.
    const currentIL = 0;
    const currentILPct = 0;

    // Projected IL at moves (in token1 units, then convert to USD)
    const il10Raw = computeILAtMove(currentSqrtPriceX96, 10, position.tickLower, position.tickUpper, position.liquidity);
    const il50Raw = computeILAtMove(currentSqrtPriceX96, 50, position.tickLower, position.tickUpper, position.liquidity);
    const ilAt10 = tokenAmountToUSD(il10Raw, token1Decimals, token1PriceUSD);
    const ilAt50 = tokenAmountToUSD(il50Raw, token1Decimals, token1PriceUSD);

    // Price change from midpoint
    const priceChangePct = 0; // No change from entry (midpoint proxy)

    // In-range check using ticks
    const currentTick = midTick; // Using entry as current for display
    const inRange = currentTick >= position.tickLower && currentTick <= position.tickUpper;

    // Premium economics
    const monthlyPremium = premiumAmount || 0;
    const dailyCost = monthlyPremium / 30;
    const premiumPerBlock = dailyCost / 7200;
    // For break-even: convert monthly premium to token1 units
    const premiumToken1 = BigInt(Math.round(monthlyPremium * 10 ** token1Decimals / token1PriceUSD));
    const breakEven = monthlyPremium > 0 && position.liquidity > BigInt(0)
      ? findBreakEven(currentSqrtPriceX96, premiumToken1, position.tickLower, position.tickUpper, position.liquidity)
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
      currentPrice: ethPriceUSD,
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
      chainlinkPrice: ethPriceUSD,
      chainlinkLastUpdate: chainlink.updatedAt,
      chainlinkDecimals: chainlink.decimals,
      twapConfigured: false,
      sqrtPriceX96: currentSqrtPriceX96,
      liquidity: position.liquidity,
    };
  }, [position, chainlink.price, seniorAssets.raw, juniorAssets.raw, premiumAmount]);
}
