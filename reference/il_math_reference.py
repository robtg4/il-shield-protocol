#!/usr/bin/env python3
"""
IL Math Reference Implementation
Computes impermanent loss identically to the Solidity ILMath library.
Uses Python's decimal module for Q64.96 fixed-point precision.

Usage (Foundry FFI):
    python3 il_math_reference.py <entrySqrtPriceX96> <exitSqrtPriceX96> <tickLower> <tickUpper> <liquidity>
    Outputs: IL amount as uint256 (decimal string)
"""

import sys
from decimal import Decimal, getcontext

# Match Q96 precision
getcontext().prec = 60

Q96 = Decimal(2**96)
Q192 = Decimal(2**192)


def tick_to_sqrt_price_x96(tick: int) -> int:
    """Convert tick to sqrtPriceX96 matching Uniswap's TickMath."""
    # sqrtPrice = 1.0001^(tick/2)
    # sqrtPriceX96 = sqrtPrice * 2^96
    sqrt_price = Decimal("1.0001") ** (Decimal(tick) / 2)
    return int(sqrt_price * Q96)


def sqrt_price_x96_to_price(sqrt_price_x96: int) -> float:
    """Convert sqrtPriceX96 to human-readable price (for debugging)."""
    sqrt_price = Decimal(sqrt_price_x96) / Q96
    return float(sqrt_price ** 2)


def position_amounts(
    sqrt_price_x96: int, tick_lower: int, tick_upper: int, liquidity: int
) -> tuple[int, int]:
    """
    Compute token amounts for a concentrated liquidity position.
    Returns (amount0, amount1) as integers.
    """
    sqrt_a = Decimal(tick_to_sqrt_price_x96(tick_lower))
    sqrt_b = Decimal(tick_to_sqrt_price_x96(tick_upper))
    sqrt_p = Decimal(sqrt_price_x96)
    liq = Decimal(liquidity)

    if sqrt_p <= sqrt_a:
        # Price below range: 100% token0
        amount0 = int(liq * Q96 * (sqrt_b - sqrt_a) / (sqrt_b * sqrt_a))
        amount1 = 0
    elif sqrt_p >= sqrt_b:
        # Price above range: 100% token1
        amount0 = 0
        amount1 = int(liq * (sqrt_b - sqrt_a) / Q96)
    else:
        # Price within range
        amount0 = int(liq * Q96 * (sqrt_b - sqrt_p) / (sqrt_b * sqrt_p))
        amount1 = int(liq * (sqrt_p - sqrt_a) / Q96)

    return (amount0, amount1)


def token0_value_in_token1(amount0: int, sqrt_price_x96: int) -> int:
    """Convert token0 amount to token1 value: amount0 * price."""
    if amount0 == 0:
        return 0
    price_x192 = Decimal(sqrt_price_x96) * Decimal(sqrt_price_x96)
    return int(Decimal(amount0) * price_x192 / Q192)


def position_value_in_token1(
    sqrt_price_x96: int, tick_lower: int, tick_upper: int, liquidity: int
) -> int:
    """Compute total position value in token1 terms."""
    amount0, amount1 = position_amounts(sqrt_price_x96, tick_lower, tick_upper, liquidity)
    return token0_value_in_token1(amount0, sqrt_price_x96) + amount1


def compute_il(
    entry_sqrt_price_x96: int,
    exit_sqrt_price_x96: int,
    tick_lower: int,
    tick_upper: int,
    liquidity: int,
) -> int:
    """
    Compute impermanent loss in token1 terms.
    Matches Solidity ILMath.computeIL exactly.

    IL = max(0, HODL_value - LP_value)
    """
    # Step 1: Position amounts at entry
    x0, y0 = position_amounts(entry_sqrt_price_x96, tick_lower, tick_upper, liquidity)

    # Step 2: LP value at exit
    lp_value = position_value_in_token1(
        exit_sqrt_price_x96, tick_lower, tick_upper, liquidity
    )

    # Step 3: HODL value at exit = x0 * P_exit + y0
    hodl_value = token0_value_in_token1(x0, exit_sqrt_price_x96) + y0

    # Step 4: IL = max(0, HODL - LP)
    il = hodl_value - lp_value if hodl_value > lp_value else 0
    return il


def main():
    if len(sys.argv) != 6:
        print(
            "Usage: il_math_reference.py <entrySqrtPriceX96> <exitSqrtPriceX96> <tickLower> <tickUpper> <liquidity>",
            file=sys.stderr,
        )
        sys.exit(1)

    entry = int(sys.argv[1])
    exit_ = int(sys.argv[2])
    tick_lower = int(sys.argv[3])
    tick_upper = int(sys.argv[4])
    liquidity = int(sys.argv[5])

    il = compute_il(entry, exit_, tick_lower, tick_upper, liquidity)
    # Output as hex for Foundry FFI (abi-encoded uint256)
    print(f"0x{il:064x}")


if __name__ == "__main__":
    main()
