// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {PremiumMath} from "../libraries/PremiumMath.sol";
import {ConcentrationFactor} from "../libraries/ConcentrationFactor.sol";

/// @notice Minimal Chainlink AggregatorV3 interface
interface AggregatorV3Interface {
    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound);

    function decimals() external view returns (uint8);
}

/// @title PricingOracle
/// @notice Computes premiums using the net IL framework with multi-source price and volatility feeds
/// @dev Integrates Chainlink (canonical), TWAP (circuit breaker), and composite volatility
contract PricingOracle is AccessControl {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    uint256 internal constant WAD = 1e18;
    uint256 internal constant Q96 = 2 ** 96;
    uint256 internal constant Q192 = 2 ** 192;
    uint256 internal constant CHAINLINK_STALENESS = 3600; // 1 hour max staleness

    error StalePrice();
    error InvalidFeed();
    error VolatilityStale();
    error PoolNotConfigured();

    event PriceFeedSet(bytes32 indexed poolId, address feed);
    event VolatilityUpdated(bytes32 indexed poolId, uint256 realizedVol, uint256 impliedVol, uint256 compositeVol);
    event VolFloorSet(bytes32 indexed poolId, uint256 floor);
    event TWAPSourceSet(bytes32 indexed poolId, address source);

    struct PoolConfig {
        address chainlinkFeed;      // Chainlink price feed address
        address twapSource;          // Address that provides TWAP (hook accumulator or external)
        uint256 volFloor;            // Governance-set minimum volatility (18 decimals)
        uint256 realizedVol;         // 30-day Yang-Zhang realized vol (18 decimals)
        uint256 impliedVol;          // 30-day ATM implied vol from Deribit (18 decimals)
        uint48 lastVolUpdateBlock;   // Block of last vol update
        uint256 feeRate;             // Pool fee rate in 1e6 (e.g., 3000 = 0.30%)
        uint256 expectedVolPerLiq;   // Expected volume/liquidity per block (18 decimals)
    }

    /// @notice Pool configurations
    mapping(bytes32 => PoolConfig) public poolConfigs;

    /// @notice TWAP prices stored by external sources
    mapping(bytes32 => uint160) public twapPrices;

    /// @notice Global C-level coefficient (18 decimals)
    uint256 public cLevel;

    /// @notice Vault utilization in basis points
    uint256 public utilizationBps;

    /// @notice Vol staleness threshold in blocks (~8 hours)
    uint256 public volStalenessBlocks;

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);

        // Initialize C-level at 5x (intentionally overpriced for bootstrapping)
        cLevel = 5e18;
        volStalenessBlocks = 2400; // ~8 hours at 12s blocks
    }

    // ─── Pool Configuration ──────────────────────────────────────────────

    /// @notice Configure a pool's price feed and parameters
    function configurePool(
        bytes32 poolId,
        address chainlinkFeed,
        address twapSource,
        uint256 volFloor,
        uint256 feeRate,
        uint256 expectedVolPerLiq
    ) external onlyRole(GOVERNANCE_ROLE) {
        if (chainlinkFeed == address(0)) revert InvalidFeed();

        poolConfigs[poolId] = PoolConfig({
            chainlinkFeed: chainlinkFeed,
            twapSource: twapSource,
            volFloor: volFloor,
            realizedVol: volFloor, // Initialize to floor
            impliedVol: volFloor,
            lastVolUpdateBlock: uint48(block.number),
            feeRate: feeRate,
            expectedVolPerLiq: expectedVolPerLiq
        });

        emit PriceFeedSet(poolId, chainlinkFeed);
        emit VolFloorSet(poolId, volFloor);
    }

    // ─── Price Feeds ─────────────────────────────────────────────────────

    /// @notice Get current price from Chainlink as sqrtPriceX96
    /// @param poolId The pool identifier
    /// @return sqrtPriceX96 The square root price in Q64.96 format
    function getChainlinkSqrtPriceX96(bytes32 poolId) external view returns (uint160) {
        PoolConfig storage config = poolConfigs[poolId];
        if (config.chainlinkFeed == address(0)) revert PoolNotConfigured();

        return _getChainlinkSqrtPriceX96(config.chainlinkFeed);
    }

    /// @notice Get TWAP price as sqrtPriceX96
    /// @param poolId The pool identifier
    /// @param period TWAP period (unused in this implementation, reserved for future)
    /// @return sqrtPriceX96 The TWAP square root price
    function getTWAPSqrtPriceX96(bytes32 poolId, uint32 period) external view returns (uint160) {
        period; // silence unused warning
        return twapPrices[poolId];
    }

    /// @notice Update TWAP price (called by hook accumulator or keeper)
    function updateTWAP(bytes32 poolId, uint160 sqrtPriceX96) external onlyRole(KEEPER_ROLE) {
        twapPrices[poolId] = sqrtPriceX96;
    }

    // ─── Volatility ──────────────────────────────────────────────────────

    /// @notice Get composite volatility for a pool: max(realized, implied, floor)
    function getVolatility(bytes32 poolId) external view returns (uint256) {
        return _getCompositeVol(poolId);
    }

    /// @notice Update volatility feeds (called by keeper)
    function updateVolatility(bytes32 poolId, uint256 newRealizedVol, uint256 newImpliedVol)
        external
        onlyRole(KEEPER_ROLE)
    {
        PoolConfig storage config = poolConfigs[poolId];
        if (config.chainlinkFeed == address(0)) revert PoolNotConfigured();

        config.realizedVol = newRealizedVol;
        config.impliedVol = newImpliedVol;
        config.lastVolUpdateBlock = uint48(block.number);

        uint256 composite = _max3(newRealizedVol, newImpliedVol, config.volFloor);
        emit VolatilityUpdated(poolId, newRealizedVol, newImpliedVol, composite);
    }

    // ─── Premium Computation ─────────────────────────────────────────────

    /// @notice Compute the premium rate for a position
    /// @param poolId Pool identifier
    /// @param tickLower Lower tick
    /// @param tickUpper Upper tick
    /// @param coverageTier 0=50%, 1=75%, 2=100%
    /// @return ratePerBlock Premium rate per block (18 decimals)
    function computePremiumRate(
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint8 coverageTier
    ) external view returns (uint256) {
        PoolConfig storage config = poolConfigs[poolId];
        if (config.chainlinkFeed == address(0)) revert PoolNotConfigured();

        uint256 sigma = _getCompositeVol(poolId);
        uint256 concFactor = ConcentrationFactor.compute(tickLower, tickUpper);

        return PremiumMath.computePremiumRate(
            sigma,
            config.feeRate,
            config.expectedVolPerLiq,
            concFactor,
            coverageTier,
            utilizationBps,
            cLevel
        );
    }

    // ─── Admin ───────────────────────────────────────────────────────────

    /// @notice Update C-level coefficient
    function setCLevel(uint256 newCLevel) external onlyRole(GOVERNANCE_ROLE) {
        cLevel = newCLevel;
    }

    /// @notice Update utilization (called by Core after premium distribution / claims)
    function setUtilization(uint256 newUtilizationBps) external onlyRole(KEEPER_ROLE) {
        utilizationBps = newUtilizationBps;
    }

    /// @notice Update vol floor for a pool
    function setVolFloor(bytes32 poolId, uint256 newFloor) external onlyRole(GOVERNANCE_ROLE) {
        poolConfigs[poolId].volFloor = newFloor;
        emit VolFloorSet(poolId, newFloor);
    }

    // ─── Internal Helpers ────────────────────────────────────────────────

    function _getChainlinkSqrtPriceX96(address feed) internal view returns (uint160) {
        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(feed).latestRoundData();
        if (block.timestamp - updatedAt > CHAINLINK_STALENESS) revert StalePrice();
        if (answer <= 0) revert InvalidFeed();

        uint8 feedDecimals = AggregatorV3Interface(feed).decimals();
        // Convert Chainlink price to sqrtPriceX96
        // price = answer * 10^(18 - feedDecimals) [normalize to 18 decimals]
        // sqrtPriceX96 = sqrt(price) * 2^96
        uint256 price18 = uint256(answer) * 10 ** (18 - feedDecimals);
        uint256 sqrtPrice = _sqrt(price18 * WAD); // sqrt in 18 decimals
        return uint160(FullMath.mulDiv(sqrtPrice, Q96, WAD));
    }

    function _getCompositeVol(bytes32 poolId) internal view returns (uint256) {
        PoolConfig storage config = poolConfigs[poolId];

        // If vol is stale, use 1.2x realized as fallback
        uint256 implied = config.impliedVol;
        if (block.number - config.lastVolUpdateBlock > volStalenessBlocks) {
            implied = FullMath.mulDiv(config.realizedVol, 1.2e18, WAD);
        }

        return _max3(config.realizedVol, implied, config.volFloor);
    }

    function _max3(uint256 a, uint256 b, uint256 c) internal pure returns (uint256) {
        return a >= b ? (a >= c ? a : c) : (b >= c ? b : c);
    }

    function _sqrt(uint256 x) internal pure returns (uint256 y) {
        if (x == 0) return 0;
        y = x;
        uint256 z = (y + 1) / 2;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
    }
}
