// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title PremiumMath
/// @notice Compute streaming premium rate using the net IL framework
/// @dev Premium = max(0, E[NetIL]) * RiskLoading * CoverageTier * UtilizationCurve * CLevel
library PremiumMath {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BLOCKS_PER_YEAR = 2_628_000; // ~12s blocks
    uint256 internal constant BPS = 10_000;

    // Risk loading constants (18 decimals)
    uint256 internal constant BASE_RISK_LOADING = 1.40e18;
    uint256 internal constant RISK_LOADING_SLOPE = 0.80e18;
    uint256 internal constant VOL_THRESHOLD = 0.50e18;

    // Utilization curve breakpoints (basis points)
    uint256 internal constant UTIL_FLAT_THRESHOLD = 4000;  // 40%
    uint256 internal constant UTIL_LINEAR_THRESHOLD = 7500; // 75%

    /// @notice Compute premium rate per block
    /// @param sigma Annualized volatility (18 decimals, e.g., 0.70e18 = 70%)
    /// @param feeRate Pool fee rate in 1e6 units (e.g., 3000 = 0.30%)
    /// @param expectedVolumePerLiquidity Expected volume/liquidity ratio per block (18 decimals)
    /// @param concentrationFactor C(R) from tick range (18 decimals)
    /// @param coverageTier 0=50%, 1=75%, 2=100%
    /// @param utilizationBps Current vault utilization in basis points
    /// @param cLevel Current C-level coefficient (18 decimals)
    /// @return ratePerBlock Premium rate in USDC per unit liquidity per block (18 decimals)
    function computePremiumRate(
        uint256 sigma,
        uint256 feeRate,
        uint256 expectedVolumePerLiquidity,
        uint256 concentrationFactor,
        uint8 coverageTier,
        uint256 utilizationBps,
        uint256 cLevel
    ) internal pure returns (uint256 ratePerBlock) {
        // E[GrossIL] per block = (sigma^2 / 8) * C(R) / BLOCKS_PER_YEAR
        uint256 sigmaSquared = FullMath.mulDiv(sigma, sigma, WAD);
        uint256 grossILPerBlock = FullMath.mulDiv(
            FullMath.mulDiv(sigmaSquared, concentrationFactor, 8 * WAD),
            1,
            BLOCKS_PER_YEAR
        );

        // E[FeeIncome] per block = feeRate * expectedVolumePerLiquidity
        uint256 feeIncomePerBlock = FullMath.mulDiv(feeRate, expectedVolumePerLiquidity, 1e6);

        // NetIL per block = max(0, GrossIL - FeeIncome)
        if (grossILPerBlock <= feeIncomePerBlock) return 0;
        uint256 netILPerBlock = grossILPerBlock - feeIncomePerBlock;

        // Apply risk loading
        uint256 riskLoading = _computeRiskLoading(sigma);

        // Apply coverage tier multiplier
        uint256 tierMultiplier = _coverageTierMultiplier(coverageTier);

        // Apply utilization curve
        uint256 utilizationMultiplier = _utilizationCurve(utilizationBps);

        // Final: NetIL * RiskLoading * TierMultiplier * UtilizationMultiplier * CLevel
        ratePerBlock = FullMath.mulDiv(netILPerBlock, riskLoading, WAD);
        ratePerBlock = FullMath.mulDiv(ratePerBlock, tierMultiplier, WAD);
        ratePerBlock = FullMath.mulDiv(ratePerBlock, utilizationMultiplier, WAD);
        ratePerBlock = FullMath.mulDiv(ratePerBlock, cLevel, WAD);
    }

    /// @notice Risk loading: 1.40 + max(0, (sigma - 0.50) * 0.80)
    function _computeRiskLoading(uint256 sigma) internal pure returns (uint256) {
        if (sigma <= VOL_THRESHOLD) return BASE_RISK_LOADING;
        uint256 excess = sigma - VOL_THRESHOLD;
        return BASE_RISK_LOADING + FullMath.mulDiv(excess, RISK_LOADING_SLOPE, WAD);
    }

    /// @notice Coverage tier multiplier: 0→50%, 1→75%, 2→100%
    function _coverageTierMultiplier(uint8 tier) internal pure returns (uint256) {
        if (tier == 0) return 0.50e18;
        if (tier == 1) return 0.75e18;
        return WAD; // 100%
    }

    /// @notice Utilization curve (kinked Aave-style)
    /// @dev Flat below 40%, linear 1.0→2.0 from 40%→75%, exponential above 75%
    function _utilizationCurve(uint256 utilizationBps) internal pure returns (uint256) {
        if (utilizationBps <= UTIL_FLAT_THRESHOLD) {
            return WAD; // 1.0x
        } else if (utilizationBps <= UTIL_LINEAR_THRESHOLD) {
            // Linear from 1.0 to 2.0 over 40%→75%
            uint256 progress = (utilizationBps - UTIL_FLAT_THRESHOLD) * WAD / (UTIL_LINEAR_THRESHOLD - UTIL_FLAT_THRESHOLD);
            return WAD + progress; // 1.0 + progress (where progress goes 0→1.0)
        } else {
            // Exponential above 75%: 2.0 + 10 * (util - 0.75)^2 / 0.25^2
            // At 100%: 2.0 + 10 = 12.0x (steep penalty)
            uint256 excess = utilizationBps - UTIL_LINEAR_THRESHOLD;
            uint256 maxExcess = BPS - UTIL_LINEAR_THRESHOLD; // 2500 bps
            uint256 excessNorm = excess * WAD / maxExcess;
            uint256 excessSquared = FullMath.mulDiv(excessNorm, excessNorm, WAD);
            return 2 * WAD + FullMath.mulDiv(10 * WAD, excessSquared, WAD);
        }
    }

    /// @notice Get the coverage multiplier in basis points
    function coverageMultiplierBps(uint8 tier) internal pure returns (uint256) {
        if (tier == 0) return 5000;  // 50%
        if (tier == 1) return 7500;  // 75%
        return 10000; // 100%
    }
}
