/**
 * Client-side IL computation matching the Solidity ILMath library.
 * Uses standard JS math (sufficient precision for UI display).
 */

/** Compute IL in USD for a concentrated liquidity position */
export function computeIL(
  positionValueUSD: number,
  priceChangePct: number,
  tickRangeWidth: number = 600 // half-width in ticks
): number {
  if (priceChangePct === 0) return 0;

  // Price ratio
  const r = 1 + priceChangePct / 100;
  if (r <= 0) return positionValueUSD; // total loss

  // Full-range IL formula: IL = 2*sqrt(r)/(1+r) - 1
  const sqrtR = Math.sqrt(r);
  const fullRangeIL = 1 - (2 * sqrtR) / (1 + r);

  // Concentration multiplier: narrower range = higher IL
  // Approximate: C(R) ≈ fullRange / tickRangeWidth * 887220
  // For a ±600 tick range, concentration ≈ 1478x
  const fullRangeTicks = 887220;
  const concentration = Math.min(fullRangeTicks / Math.max(tickRangeWidth, 1), 1000);

  // Concentrated IL scales roughly linearly with concentration
  // but caps at position value
  const concentratedIL = fullRangeIL * Math.sqrt(concentration);
  const ilUSD = Math.min(positionValueUSD * concentratedIL, positionValueUSD);

  return Math.max(0, ilUSD);
}

/** Compute IL at multiple price change levels */
export function computeILScenarios(
  positionValueUSD: number,
  moves: number[] = [5, 10, 20, 30, 50],
  tickRangeWidth: number = 600
): { move: number; il: number }[] {
  return moves.map((move) => ({
    move,
    il: computeIL(positionValueUSD, move, tickRangeWidth),
  }));
}

/** Compute payout after coverage tier and settlement fee */
export function computePayout(
  il: number,
  coverageTier: 0 | 1 | 2,
  settlementFeeBps: number = 200
): number {
  const tierMultiplier = coverageTier === 0 ? 0.5 : coverageTier === 1 ? 0.75 : 1.0;
  const gross = il * tierMultiplier;
  const fee = gross * (settlementFeeBps / 10000);
  return Math.max(0, gross - fee);
}

/** Find break-even move percentage where IL payout exceeds premium */
export function findBreakEven(
  positionValueUSD: number,
  monthlyPremium: number,
  coverageTier: 0 | 1 | 2 = 2,
  tickRangeWidth: number = 600
): number {
  // Binary search for the move % where payout = premium
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const il = computeIL(positionValueUSD, mid, tickRangeWidth);
    const payout = computePayout(il, coverageTier);
    if (payout < monthlyPremium) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}
