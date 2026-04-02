// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {PremiumMath} from "../../src/libraries/PremiumMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

contract PremiumMathTest is Test {
    uint256 constant WAD = 1e18;
    uint256 constant BLOCKS_PER_YEAR = 2_628_000;

    // Default inputs for holding other params constant
    uint256 constant DEFAULT_SIGMA = 0.70e18;
    uint256 constant DEFAULT_FEE_RATE = 3000;
    uint256 constant DEFAULT_VOL_PER_LIQ = 1e14;
    uint256 constant DEFAULT_CONC_FACTOR = 5e18;
    uint8 constant DEFAULT_TIER = 2;           // 100%
    uint256 constant DEFAULT_UTIL_BPS = 5000;  // 50%
    uint256 constant DEFAULT_C_LEVEL = 5e18;

    function test_fuzz_premium_monotonic_in_volatility(uint256 sigma1, uint256 sigma2) public pure {
        sigma1 = bound(sigma1, 0.10e18, 2.0e18);
        sigma2 = bound(sigma2, sigma1, 2.0e18);

        uint256 rate1 = PremiumMath.computePremiumRate(
            sigma1, DEFAULT_FEE_RATE, DEFAULT_VOL_PER_LIQ, DEFAULT_CONC_FACTOR,
            DEFAULT_TIER, DEFAULT_UTIL_BPS, DEFAULT_C_LEVEL
        );
        uint256 rate2 = PremiumMath.computePremiumRate(
            sigma2, DEFAULT_FEE_RATE, DEFAULT_VOL_PER_LIQ, DEFAULT_CONC_FACTOR,
            DEFAULT_TIER, DEFAULT_UTIL_BPS, DEFAULT_C_LEVEL
        );

        assertLe(rate1, rate2, "Premium must be monotonically non-decreasing in volatility");
    }

    function test_fuzz_premium_monotonic_in_concentration(uint256 conc1, uint256 conc2) public pure {
        conc1 = bound(conc1, 1e18, 50e18);
        conc2 = bound(conc2, conc1, 50e18);

        uint256 rate1 = PremiumMath.computePremiumRate(
            DEFAULT_SIGMA, DEFAULT_FEE_RATE, DEFAULT_VOL_PER_LIQ, conc1,
            DEFAULT_TIER, DEFAULT_UTIL_BPS, DEFAULT_C_LEVEL
        );
        uint256 rate2 = PremiumMath.computePremiumRate(
            DEFAULT_SIGMA, DEFAULT_FEE_RATE, DEFAULT_VOL_PER_LIQ, conc2,
            DEFAULT_TIER, DEFAULT_UTIL_BPS, DEFAULT_C_LEVEL
        );

        assertLe(rate1, rate2, "Premium must be monotonically non-decreasing in concentration");
    }

    function test_fuzz_premium_zero_when_fees_cover_il(uint256 sigma, uint256 volumePerLiq) public pure {
        // Low vol + high fee income → fees exceed IL → premium = 0
        sigma = bound(sigma, 0.10e18, 0.30e18);
        // Very high volume/liquidity ensures fee income >> gross IL
        volumePerLiq = bound(volumePerLiq, 1e16, 1e18);

        uint256 rate = PremiumMath.computePremiumRate(
            sigma, DEFAULT_FEE_RATE, volumePerLiq, 1e18, // concentration = 1 (full range)
            DEFAULT_TIER, DEFAULT_UTIL_BPS, DEFAULT_C_LEVEL
        );

        assertEq(rate, 0, "Premium must be zero when fee income covers IL");
    }

    function test_fuzz_premium_equals_gross_when_no_fees(uint256 sigma, uint256 concFactor) public pure {
        sigma = bound(sigma, 0.20e18, 1.5e18);
        concFactor = bound(concFactor, 1e18, 20e18);

        // With zero volume, fee income = 0, so premium = gross IL pricing
        uint256 rate = PremiumMath.computePremiumRate(
            sigma, DEFAULT_FEE_RATE, 0, concFactor,
            DEFAULT_TIER, DEFAULT_UTIL_BPS, DEFAULT_C_LEVEL
        );

        // Compute expected manually:
        // grossIL = (sigma^2 / 8) * concFactor / BLOCKS_PER_YEAR
        uint256 sigmaSquared = FullMath.mulDiv(sigma, sigma, WAD);
        uint256 grossILPerBlock = FullMath.mulDiv(
            FullMath.mulDiv(sigmaSquared, concFactor, 8 * WAD), 1, BLOCKS_PER_YEAR
        );

        // riskLoading
        uint256 riskLoading;
        if (sigma <= 0.50e18) {
            riskLoading = 1.40e18;
        } else {
            riskLoading = 1.40e18 + FullMath.mulDiv(sigma - 0.50e18, 0.80e18, WAD);
        }

        // tier = 100% = 1e18, util at 50% → in kinked region: 1.0 + progress
        // progress = (5000 - 4000) * 1e18 / (7500 - 4000) = 1000/3500 * 1e18
        uint256 utilMul = WAD + (1000 * WAD / 3500);

        uint256 expected = FullMath.mulDiv(grossILPerBlock, riskLoading, WAD);
        expected = FullMath.mulDiv(expected, WAD, WAD); // tier 100%
        expected = FullMath.mulDiv(expected, utilMul, WAD);
        expected = FullMath.mulDiv(expected, DEFAULT_C_LEVEL, WAD);

        // 0.01% relative tolerance
        uint256 tolerance = expected / 10000 + 1;
        assertApproxEqAbs(rate, expected, tolerance, "Premium should match gross IL pricing when no fees");
    }
}
