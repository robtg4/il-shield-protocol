#!/usr/bin/env python3
"""
Premium Model Reference Implementation
Computes streaming premium rate matching the Solidity PremiumMath library.
All inputs/outputs in 18-decimal fixed point (as integers).

Usage (Foundry FFI):
    python3 premium_model.py <sigma> <feeRate> <volPerLiq> <concFactor> <tier> <utilBps> <cLevel>
    Outputs: ratePerBlock as hex-encoded uint256
"""

import sys
from decimal import Decimal, getcontext

getcontext().prec = 60

WAD = 10**18
BLOCKS_PER_YEAR = 2_628_000
BPS = 10_000


def compute_risk_loading(sigma: int) -> int:
    """Risk loading: 1.40 + max(0, (sigma - 0.50) * 0.80)"""
    base = int(Decimal("1.40") * WAD)
    threshold = int(Decimal("0.50") * WAD)
    slope = int(Decimal("0.80") * WAD)

    if sigma <= threshold:
        return base

    excess = sigma - threshold
    additional = excess * slope // WAD
    return base + additional


def coverage_tier_multiplier(tier: int) -> int:
    """Coverage tier: 0→50%, 1→75%, 2→100%"""
    if tier == 0:
        return WAD // 2  # 0.50e18
    if tier == 1:
        return WAD * 3 // 4  # 0.75e18
    return WAD  # 1.00e18


def utilization_curve(utilization_bps: int) -> int:
    """
    Kinked utilization curve:
    - Flat (1.0x) below 40%
    - Linear 1.0→2.0 from 40%→75%
    - Exponential above 75%
    """
    FLAT = 4000
    LINEAR = 7500

    if utilization_bps <= FLAT:
        return WAD

    if utilization_bps <= LINEAR:
        progress = (utilization_bps - FLAT) * WAD // (LINEAR - FLAT)
        return WAD + progress

    # Exponential above 75%
    excess = utilization_bps - LINEAR
    max_excess = BPS - LINEAR  # 2500
    excess_norm = excess * WAD // max_excess
    excess_squared = excess_norm * excess_norm // WAD
    return 2 * WAD + 10 * WAD * excess_squared // WAD


def compute_premium_rate(
    sigma: int,
    fee_rate: int,
    expected_vol_per_liq: int,
    concentration_factor: int,
    coverage_tier: int,
    utilization_bps: int,
    c_level: int,
) -> int:
    """
    Compute premium rate per block (18 decimals).
    Matches Solidity PremiumMath.computePremiumRate.
    """
    # E[GrossIL] per block = (sigma^2 / 8) * C(R) / BLOCKS_PER_YEAR
    sigma_squared = sigma * sigma // WAD
    gross_il_per_block = sigma_squared * concentration_factor // (8 * WAD) // BLOCKS_PER_YEAR

    # E[FeeIncome] per block = feeRate * expectedVolumePerLiquidity
    fee_income_per_block = fee_rate * expected_vol_per_liq // 10**6

    # NetIL = max(0, GrossIL - FeeIncome)
    if gross_il_per_block <= fee_income_per_block:
        return 0

    net_il = gross_il_per_block - fee_income_per_block

    # Apply multipliers
    risk_loading = compute_risk_loading(sigma)
    tier_mult = coverage_tier_multiplier(coverage_tier)
    util_mult = utilization_curve(utilization_bps)

    rate = net_il * risk_loading // WAD
    rate = rate * tier_mult // WAD
    rate = rate * util_mult // WAD
    rate = rate * c_level // WAD

    return rate


def main():
    if len(sys.argv) != 8:
        print(
            "Usage: premium_model.py <sigma> <feeRate> <volPerLiq> <concFactor> <tier> <utilBps> <cLevel>",
            file=sys.stderr,
        )
        sys.exit(1)

    sigma = int(sys.argv[1])
    fee_rate = int(sys.argv[2])
    vol_per_liq = int(sys.argv[3])
    conc_factor = int(sys.argv[4])
    tier = int(sys.argv[5])
    util_bps = int(sys.argv[6])
    c_level = int(sys.argv[7])

    rate = compute_premium_rate(sigma, fee_rate, vol_per_liq, conc_factor, tier, util_bps, c_level)
    print(f"0x{rate:064x}")


if __name__ == "__main__":
    main()
