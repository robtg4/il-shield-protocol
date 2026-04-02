// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title ConcentrationFactor
/// @notice Computes the concentration multiplier C(R) from a tick range
/// @dev C(R) = 1 / (1 - 1/sqrt(R)) where R = P_upper / P_lower = 1.0001^(tickUpper - tickLower)
///      For full-range positions C(R) ≈ 1.0; for tight ranges C(R) >> 1
library ConcentrationFactor {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant Q96 = 2 ** 96;

    /// @notice Compute the concentration factor for a tick range
    /// @param tickLower Lower tick of the position
    /// @param tickUpper Upper tick of the position
    /// @return factor The concentration multiplier C(R) in 18-decimal fixed point
    function compute(int24 tickLower, int24 tickUpper) internal pure returns (uint256 factor) {
        // Get sqrtPrice at ticks
        uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        // sqrt(R) = sqrtRatioBX96 / sqrtRatioAX96
        // C(R) = 1 / (1 - 1/sqrt(R)) = 1 / (1 - sqrtRatioAX96/sqrtRatioBX96)
        //       = sqrtRatioBX96 / (sqrtRatioBX96 - sqrtRatioAX96)

        uint256 numerator = uint256(sqrtRatioBX96);
        uint256 denominator = uint256(sqrtRatioBX96) - uint256(sqrtRatioAX96);

        // If denominator is 0, the range is a single tick (infinite concentration)
        // Cap at a reasonable maximum to prevent overflow
        if (denominator == 0) return 1000 * WAD; // 1000x cap

        factor = FullMath.mulDiv(numerator, WAD, denominator);

        // Floor at 1.0 (full range is approximately 1.0)
        if (factor < WAD) factor = WAD;
    }
}
