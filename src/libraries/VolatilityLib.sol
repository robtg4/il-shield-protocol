// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

/// @title VolatilityLib
/// @notice Yang-Zhang realized volatility estimator and geometric weighted average (GWAV)
/// @dev Yang-Zhang is preferred over close-to-close because it captures overnight jumps and
///      intraday volatility — critical for crypto markets that trade 24/7
library VolatilityLib {
    uint256 internal constant WAD = 1e18;
    uint256 internal constant BLOCKS_PER_YEAR = 2_628_000;

    /// @notice Compute Yang-Zhang realized volatility from OHLC price data
    /// @dev σ²_YZ = σ²_o + k*σ²_c + (1-k)*σ²_rs where k = 0.34/(1.34 + (n+1)/(n-1))
    /// @param opens Array of opening prices (18 decimals)
    /// @param highs Array of high prices (18 decimals)
    /// @param lows Array of low prices (18 decimals)
    /// @param closes Array of closing prices (18 decimals)
    /// @param periodsPerYear Number of sampling periods per year (for annualization)
    /// @return sigma Annualized volatility (18 decimals)
    function computeYangZhang(
        uint256[] memory opens,
        uint256[] memory highs,
        uint256[] memory lows,
        uint256[] memory closes,
        uint256 periodsPerYear
    ) internal pure returns (uint256 sigma) {
        uint256 n = opens.length;
        if (n < 2) return 0;

        // Compute overnight variance (open-to-close of previous day)
        uint256 overnightVar = _overnightVariance(opens, closes, n);

        // Compute close-to-close variance
        uint256 closeVar = _closeToCloseVariance(closes, n);

        // Compute Rogers-Satchell variance (intraday)
        uint256 rsVar = _rogersSatchellVariance(opens, highs, lows, closes, n);

        // Yang-Zhang combination: k = 0.34 / (1.34 + (n+1)/(n-1))
        // For simplicity, use k ≈ 0.34 / (1.34 + 1) = 0.34/2.34 ≈ 0.145 for large n
        // More precise: k = 0.34 / (1 + 0.34 + 2/(n-1))
        uint256 kNum = 0.34e18;
        uint256 kDen = WAD + 0.34e18 + FullMath.mulDiv(2 * WAD, 1, n - 1);
        uint256 k = FullMath.mulDiv(kNum, WAD, kDen);

        // σ²_YZ = σ²_o + k*σ²_c + (1-k)*σ²_rs
        uint256 variance = overnightVar
            + FullMath.mulDiv(k, closeVar, WAD)
            + FullMath.mulDiv(WAD - k, rsVar, WAD);

        // Annualize: σ = sqrt(variance * periodsPerYear)
        uint256 annualizedVar = variance * periodsPerYear;
        sigma = _sqrt(annualizedVar);
    }

    /// @notice Geometric Weighted Average Value — smooths a series using exponential weights
    /// @dev GWAV = exp(Σ w_i * ln(v_i) / Σ w_i) — approximated in fixed point
    /// @param values Array of values (18 decimals)
    /// @param weights Array of weights (18 decimals)
    /// @return result The GWAV (18 decimals)
    function gwav(uint256[] memory values, uint256[] memory weights) internal pure returns (uint256 result) {
        if (values.length == 0) return 0;
        if (values.length == 1) return values[0];

        // Use arithmetic weighted average as approximation (exact GWAV requires ln/exp)
        uint256 weightedSum;
        uint256 totalWeight;

        for (uint256 i = 0; i < values.length; i++) {
            weightedSum += FullMath.mulDiv(values[i], weights[i], WAD);
            totalWeight += weights[i];
        }

        result = FullMath.mulDiv(weightedSum, WAD, totalWeight);
    }

    /// @notice Simple realized vol from close-to-close log returns
    /// @param prices Array of closing prices (18 decimals)
    /// @param periodsPerYear Annualization factor
    /// @return sigma Annualized volatility (18 decimals)
    function simpleRealizedVol(uint256[] memory prices, uint256 periodsPerYear)
        internal
        pure
        returns (uint256 sigma)
    {
        uint256 n = prices.length;
        if (n < 2) return 0;

        uint256 sumSquared;
        int256 sumReturns;

        for (uint256 i = 1; i < n; i++) {
            // log return ≈ (P_i - P_{i-1}) / P_{i-1} for small changes
            int256 ret;
            if (prices[i] >= prices[i - 1]) {
                ret = int256(FullMath.mulDiv(prices[i] - prices[i - 1], WAD, prices[i - 1]));
            } else {
                ret = -int256(FullMath.mulDiv(prices[i - 1] - prices[i], WAD, prices[i - 1]));
            }
            sumReturns += ret;
            sumSquared += FullMath.mulDiv(uint256(ret > 0 ? ret : -ret), uint256(ret > 0 ? ret : -ret), WAD);
        }

        // Variance = (Σr² - (Σr)²/n) / (n-1)
        uint256 meanSq = FullMath.mulDiv(
            uint256(sumReturns > 0 ? sumReturns : -sumReturns),
            uint256(sumReturns > 0 ? sumReturns : -sumReturns),
            WAD
        );
        meanSq = meanSq / n;

        uint256 variance = (sumSquared - meanSq) / (n - 1);
        sigma = _sqrt(variance * periodsPerYear);
    }

    // ─── Internal Helpers ────────────────────────────────────────────────

    function _overnightVariance(uint256[] memory opens, uint256[] memory closes, uint256 n)
        internal
        pure
        returns (uint256)
    {
        uint256 sumSq;
        for (uint256 i = 1; i < n; i++) {
            // Overnight return = ln(open_i / close_{i-1}) ≈ (open_i - close_{i-1}) / close_{i-1}
            int256 ret;
            if (opens[i] >= closes[i - 1]) {
                ret = int256(FullMath.mulDiv(opens[i] - closes[i - 1], WAD, closes[i - 1]));
            } else {
                ret = -int256(FullMath.mulDiv(closes[i - 1] - opens[i], WAD, closes[i - 1]));
            }
            sumSq += FullMath.mulDiv(uint256(ret > 0 ? ret : -ret), uint256(ret > 0 ? ret : -ret), WAD);
        }
        return sumSq / (n - 1);
    }

    function _closeToCloseVariance(uint256[] memory closes, uint256 n) internal pure returns (uint256) {
        uint256 sumSq;
        for (uint256 i = 1; i < n; i++) {
            int256 ret;
            if (closes[i] >= closes[i - 1]) {
                ret = int256(FullMath.mulDiv(closes[i] - closes[i - 1], WAD, closes[i - 1]));
            } else {
                ret = -int256(FullMath.mulDiv(closes[i - 1] - closes[i], WAD, closes[i - 1]));
            }
            sumSq += FullMath.mulDiv(uint256(ret > 0 ? ret : -ret), uint256(ret > 0 ? ret : -ret), WAD);
        }
        return sumSq / (n - 1);
    }

    function _rogersSatchellVariance(
        uint256[] memory opens,
        uint256[] memory highs,
        uint256[] memory lows,
        uint256[] memory closes,
        uint256 n
    ) internal pure returns (uint256) {
        uint256 sum;
        for (uint256 i = 0; i < n; i++) {
            // RS_i = ln(H/C)*ln(H/O) + ln(L/C)*ln(L/O)
            // Approximated with (H-C)(H-O)/(C*O) + (L-C)(L-O)/(C*O)
            if (highs[i] > 0 && lows[i] > 0 && opens[i] > 0 && closes[i] > 0) {
                uint256 hc = highs[i] > closes[i] ? highs[i] - closes[i] : 0;
                uint256 ho = highs[i] > opens[i] ? highs[i] - opens[i] : 0;
                uint256 denom = FullMath.mulDiv(closes[i], opens[i], WAD);
                if (denom > 0) {
                    sum += FullMath.mulDiv(hc, ho, denom);
                }
                // Low terms contribute positively: (C-L)(O-L)/(C*O)
                uint256 cl = closes[i] > lows[i] ? closes[i] - lows[i] : 0;
                uint256 ol = opens[i] > lows[i] ? opens[i] - lows[i] : 0;
                if (denom > 0) {
                    sum += FullMath.mulDiv(cl, ol, denom);
                }
            }
        }
        return sum / n;
    }

    /// @notice Integer square root using Babylonian method (18-decimal aware)
    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        // Scale for 18-decimal precision: sqrt(x * 1e18)
        uint256 scaled = x * WAD;
        y = scaled;
        uint256 z = (y + 1) / 2;
        while (z < y) {
            y = z;
            z = (scaled / z + z) / 2;
        }
    }
}
