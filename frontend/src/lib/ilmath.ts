/**
 * IL Math — TypeScript port of the Solidity ILMath library and Python reference.
 *
 * Uses BigInt for Q96 fixed-point arithmetic to match on-chain precision exactly.
 * All intermediate calculations use bigint to avoid floating-point rounding errors.
 *
 * The formulas here are identical to:
 * - src/libraries/ILMath.sol (the contract)
 * - reference/il_math_reference.py (the fuzz reference)
 */

const Q96 = BigInt(2) ** BigInt(96);

// ──────────────────────────────────────────────────────────────────
// Tick → sqrtPriceX96 conversion
// ──────────────────────────────────────────────────────────────────

/** Convert tick to sqrtPriceX96 (matches Uniswap TickMath) */
export function tickToSqrtPriceX96(tick: number): bigint {
  // sqrtPrice = 1.0001^(tick/2), sqrtPriceX96 = sqrtPrice * 2^96
  const absTick = Math.abs(tick);
  const logBase = Math.log(1.0001);
  const sqrtPrice = Math.exp((logBase * absTick) / 2);
  const q96Num = Number(Q96);

  if (tick >= 0) {
    return BigInt(Math.round(sqrtPrice * q96Num));
  } else {
    return BigInt(Math.round(q96Num / sqrtPrice));
  }
}

/** Convert sqrtPriceX96 to human-readable price (token1 per token0) */
export function sqrtPriceX96ToPrice(sqrtPriceX96: bigint): number {
  const sqrtPrice = Number(sqrtPriceX96) / Number(Q96);
  return sqrtPrice * sqrtPrice;
}

// ──────────────────────────────────────────────────────────────────
// Core position math (exact BigInt — matches Solidity)
// ──────────────────────────────────────────────────────────────────

/** mulDiv: floor(a * b / c) */
function mulDiv(a: bigint, b: bigint, c: bigint): bigint {
  return (a * b) / c;
}

/**
 * amount0 = L * 2^96 * (sqrtB - sqrtA) / (sqrtB * sqrtA)
 * Split into two mulDivs to match Solidity's FullMath ordering.
 */
function getAmount0(sqrtRatioAX96: bigint, sqrtRatioBX96: bigint, liquidity: bigint): bigint {
  const [sqrtA, sqrtB] = sqrtRatioAX96 > sqrtRatioBX96
    ? [sqrtRatioBX96, sqrtRatioAX96]
    : [sqrtRatioAX96, sqrtRatioBX96];

  const diff = sqrtB - sqrtA;
  const intermediate = mulDiv(liquidity, diff, sqrtB);
  return mulDiv(intermediate, Q96, sqrtA);
}

/** amount1 = L * (sqrtB - sqrtA) / 2^96 */
function getAmount1(sqrtRatioAX96: bigint, sqrtRatioBX96: bigint, liquidity: bigint): bigint {
  const [sqrtA, sqrtB] = sqrtRatioAX96 > sqrtRatioBX96
    ? [sqrtRatioBX96, sqrtRatioAX96]
    : [sqrtRatioAX96, sqrtRatioBX96];

  return mulDiv(liquidity, sqrtB - sqrtA, Q96);
}

/**
 * Compute position token amounts at a given sqrtPriceX96.
 * Three cases: below range (100% token0), above range (100% token1), in range (both).
 */
export function positionAmounts(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): { amount0: bigint; amount1: bigint } {
  const sqrtRatioAX96 = tickToSqrtPriceX96(tickLower);
  const sqrtRatioBX96 = tickToSqrtPriceX96(tickUpper);

  if (sqrtPriceX96 <= sqrtRatioAX96) {
    return { amount0: getAmount0(sqrtRatioAX96, sqrtRatioBX96, liquidity), amount1: BigInt(0) };
  } else if (sqrtPriceX96 >= sqrtRatioBX96) {
    return { amount0: BigInt(0), amount1: getAmount1(sqrtRatioAX96, sqrtRatioBX96, liquidity) };
  } else {
    return {
      amount0: getAmount0(sqrtPriceX96, sqrtRatioBX96, liquidity),
      amount1: getAmount1(sqrtRatioAX96, sqrtPriceX96, liquidity),
    };
  }
}

/**
 * Convert token0 amount to token1 value: amount0 * (sqrtPrice)^2 / 2^192
 */
function token0ValueInToken1(amount0: bigint, sqrtPriceX96: bigint): bigint {
  if (amount0 === BigInt(0)) return BigInt(0);
  return mulDiv(mulDiv(amount0, sqrtPriceX96, Q96), sqrtPriceX96, Q96);
}

/**
 * Compute total position value in token1 terms.
 */
export function positionValueInToken1(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): bigint {
  const { amount0, amount1 } = positionAmounts(sqrtPriceX96, tickLower, tickUpper, liquidity);
  return token0ValueInToken1(amount0, sqrtPriceX96) + amount1;
}

// ──────────────────────────────────────────────────────────────────
// IL computation (exact — matches Solidity ILMath.computeIL)
// ──────────────────────────────────────────────────────────────────

/**
 * Compute impermanent loss in token1 units.
 *
 * IL = max(0, HODL_value - LP_value)
 *
 * This is a 1:1 port of ILMath.sol and il_math_reference.py.
 */
export function computeILExact(
  entrySqrtPriceX96: bigint,
  exitSqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): bigint {
  const { amount0: x0, amount1: y0 } = positionAmounts(entrySqrtPriceX96, tickLower, tickUpper, liquidity);
  const lpValueAtExit = positionValueInToken1(exitSqrtPriceX96, tickLower, tickUpper, liquidity);
  const hodlValue = token0ValueInToken1(x0, exitSqrtPriceX96) + y0;
  return hodlValue > lpValueAtExit ? hodlValue - lpValueAtExit : BigInt(0);
}

// ──────────────────────────────────────────────────────────────────
// USD conversion helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Convert a token amount (bigint) to a USD number.
 */
export function tokenAmountToUSD(amount: bigint, decimals: number, priceUSD: number): number {
  return (Number(amount) / 10 ** decimals) * priceUSD;
}

/**
 * Compute position value in USD using exact amounts math.
 */
export function positionValueUSD(
  sqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  token0Decimals: number,
  token1Decimals: number,
  token0PriceUSD: number,
  token1PriceUSD: number,
): number {
  const { amount0, amount1 } = positionAmounts(sqrtPriceX96, tickLower, tickUpper, liquidity);
  const value0 = tokenAmountToUSD(amount0, token0Decimals, token0PriceUSD);
  const value1 = tokenAmountToUSD(amount1, token1Decimals, token1PriceUSD);
  return value0 + value1;
}

// ──────────────────────────────────────────────────────────────────
// Scenario helpers
// ──────────────────────────────────────────────────────────────────

/**
 * Compute IL in token1 at a hypothetical price move.
 * move > 0 means price increase, move < 0 means decrease.
 * IL is symmetric for concentrated positions in practice.
 */
export function computeILAtMove(
  currentSqrtPriceX96: bigint,
  movePct: number,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
): bigint {
  const factor = Math.sqrt(Math.abs(1 + movePct / 100));
  const exitSqrt = movePct >= 0
    ? BigInt(Math.round(Number(currentSqrtPriceX96) * factor))
    : BigInt(Math.round(Number(currentSqrtPriceX96) / factor));
  return computeILExact(currentSqrtPriceX96, exitSqrt, tickLower, tickUpper, liquidity);
}

/**
 * Compute payout after coverage tier and settlement fee (exact bigint).
 */
export function computePayout(
  ilToken1: bigint,
  coverageTier: 0 | 1 | 2,
  settlementFeeBps: number = 200,
): bigint {
  const tierBps = coverageTier === 0 ? BigInt(5000) : coverageTier === 1 ? BigInt(7500) : BigInt(10000);
  const coveredIL = (ilToken1 * tierBps) / BigInt(10000);
  const fee = (coveredIL * BigInt(settlementFeeBps)) / BigInt(10000);
  return coveredIL > fee ? coveredIL - fee : BigInt(0);
}

/**
 * Find break-even move percentage where payout exceeds premium.
 * premiumToken1 is in token1's smallest unit.
 */
export function findBreakEven(
  currentSqrtPriceX96: bigint,
  premiumToken1: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  coverageTier: 0 | 1 | 2 = 2,
): number {
  if (liquidity === BigInt(0) || premiumToken1 === BigInt(0)) return 0;
  let lo = 0;
  let hi = 100;
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2;
    const il = computeILAtMove(currentSqrtPriceX96, mid, tickLower, tickUpper, liquidity);
    const payout = computePayout(il, coverageTier);
    if (payout < premiumToken1) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}
