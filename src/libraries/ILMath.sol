// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SqrtPriceMath} from "@uniswap/v4-core/src/libraries/SqrtPriceMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title ILMath
/// @notice Pure math library for computing impermanent loss from entry/exit prices and tick range
/// @dev Uses Uniswap v4's native TickMath and SqrtPriceMath for precision
library ILMath {
    uint256 internal constant Q96 = 2 ** 96;
    uint256 internal constant Q192 = 2 ** 192;

    /// @notice Compute impermanent loss in token1 terms (e.g., USDC)
    /// @param entrySqrtPriceX96 sqrtPriceX96 at position entry
    /// @param exitSqrtPriceX96 sqrtPriceX96 at position exit
    /// @param tickLower Lower tick of concentrated position
    /// @param tickUpper Upper tick of concentrated position
    /// @param liquidity Liquidity amount
    /// @return ilAmount IL in token1 units (always >= 0)
    function computeIL(
        uint160 entrySqrtPriceX96,
        uint160 exitSqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal pure returns (uint256 ilAmount) {
        // Step 1: Get position amounts at entry
        (uint256 x0, uint256 y0) = _positionAmounts(entrySqrtPriceX96, tickLower, tickUpper, liquidity);

        // Step 2: Get position value at exit (LP value)
        uint256 lpValueAtExit = _positionValueInToken1(exitSqrtPriceX96, tickLower, tickUpper, liquidity, exitSqrtPriceX96);

        // Step 3: Compute HODL value at exit = x0 * P_exit + y0
        uint256 hodlValue = _token0ValueInToken1(x0, exitSqrtPriceX96) + y0;

        // Step 4: IL = max(0, HODL - LP value)
        ilAmount = hodlValue > lpValueAtExit ? hodlValue - lpValueAtExit : 0;
    }

    /// @notice Compute position token amounts given current price and tick range
    /// @dev Handles three cases: price within range, below range, above range
    function _positionAmounts(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal pure returns (uint256 amount0, uint256 amount1) {
        uint160 sqrtRatioAX96 = TickMath.getSqrtPriceAtTick(tickLower);
        uint160 sqrtRatioBX96 = TickMath.getSqrtPriceAtTick(tickUpper);

        if (sqrtPriceX96 <= sqrtRatioAX96) {
            // Price below range: 100% token0
            amount0 = _getAmount0(sqrtRatioAX96, sqrtRatioBX96, liquidity);
            amount1 = 0;
        } else if (sqrtPriceX96 >= sqrtRatioBX96) {
            // Price above range: 100% token1
            amount0 = 0;
            amount1 = _getAmount1(sqrtRatioAX96, sqrtRatioBX96, liquidity);
        } else {
            // Price within range
            amount0 = _getAmount0(sqrtPriceX96, sqrtRatioBX96, liquidity);
            amount1 = _getAmount1(sqrtRatioAX96, sqrtPriceX96, liquidity);
        }
    }

    /// @notice Compute position value in token1 terms
    function _positionValueInToken1(
        uint160 sqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint160 valuationSqrtPriceX96
    ) internal pure returns (uint256 value) {
        (uint256 amount0, uint256 amount1) = _positionAmounts(sqrtPriceX96, tickLower, tickUpper, liquidity);
        value = _token0ValueInToken1(amount0, valuationSqrtPriceX96) + amount1;
    }

    /// @notice Convert token0 amount to token1 value using sqrtPriceX96
    /// @dev value = amount0 * price = amount0 * (sqrtPriceX96)^2 / 2^192
    function _token0ValueInToken1(uint256 amount0, uint160 sqrtPriceX96) internal pure returns (uint256) {
        if (amount0 == 0) return 0;
        uint256 priceX192 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96);
        return FullMath.mulDiv(amount0, priceX192, Q192);
    }

    /// @notice Compute amount0 delta: L * (1/sqrtA - 1/sqrtB)
    function _getAmount0(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint128 liquidity)
        internal
        pure
        returns (uint256)
    {
        if (sqrtRatioAX96 > sqrtRatioBX96) {
            (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        }
        return FullMath.mulDiv(
            uint256(liquidity) << 96,
            sqrtRatioBX96 - sqrtRatioAX96,
            uint256(sqrtRatioBX96) * uint256(sqrtRatioAX96) // will not overflow for valid sqrt prices
        );
    }

    /// @notice Compute amount1 delta: L * (sqrtB - sqrtA)
    function _getAmount1(uint160 sqrtRatioAX96, uint160 sqrtRatioBX96, uint128 liquidity)
        internal
        pure
        returns (uint256)
    {
        if (sqrtRatioAX96 > sqrtRatioBX96) {
            (sqrtRatioAX96, sqrtRatioBX96) = (sqrtRatioBX96, sqrtRatioAX96);
        }
        return FullMath.mulDiv(liquidity, sqrtRatioBX96 - sqrtRatioAX96, Q96);
    }
}
