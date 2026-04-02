// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title KeeperModule
/// @notice Gelato and Chainlink Automation compatible keeper for IL Shield maintenance tasks
/// @dev Handles batch premium processing, volatility updates, and settlement assistance
interface IILShieldCoreKeeper {
    function processStreaming(uint256[] calldata ilpnIds) external;
    function positions(uint256 ilpnId)
        external
        view
        returns (
            bytes32 poolId,
            uint160 entrySqrtPriceX96,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            uint8 coverageTier,
            uint48 coverageStartBlock,
            uint48 coverageEndBlock,
            uint256 premiumBalance,
            uint256 premiumRatePerBlock,
            uint256 lastPremiumBlock,
            uint256 maxPayout,
            bool settled
        );
}

interface IPricingOracleKeeper {
    function updateVolatility(bytes32 poolId, uint256 newRealizedVol, uint256 newImpliedVol) external;
    function getVolatility(bytes32 poolId) external view returns (uint256);
}

contract KeeperModule is AccessControl {
    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant VOL_UPDATER_ROLE = keccak256("VOL_UPDATER_ROLE");

    IILShieldCoreKeeper public immutable core;
    IPricingOracleKeeper public immutable pricingOracle;

    /// @notice Maximum positions to process in a single batch
    uint256 public maxBatchSize;

    /// @notice Minimum blocks between premium processing for a position
    uint256 public minProcessingInterval;

    /// @notice Minimum blocks between volatility updates
    uint256 public minVolUpdateInterval;

    /// @notice Last vol update block per pool
    mapping(bytes32 => uint256) public lastVolUpdateBlock;

    /// @notice Active position IDs that need streaming
    uint256[] public activePositionIds;
    mapping(uint256 => bool) public isActivePosition;

    error BatchTooLarge();
    error TooSoon();
    error NoUpkeepNeeded();

    event StreamingProcessed(uint256[] ilpnIds, uint256 gasUsed);
    event VolatilityUpdated(bytes32 indexed poolId, uint256 realizedVol, uint256 impliedVol);
    event PositionRegistered(uint256 indexed ilpnId);
    event PositionRemoved(uint256 indexed ilpnId);

    constructor(address _core, address _pricingOracle, address admin) {
        core = IILShieldCoreKeeper(_core);
        pricingOracle = IPricingOracleKeeper(_pricingOracle);
        maxBatchSize = 50;
        minProcessingInterval = 7200; // ~24 hours at 12s blocks
        minVolUpdateInterval = 1200; // ~4 hours at 12s blocks

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(KEEPER_ROLE, admin);
        _grantRole(VOL_UPDATER_ROLE, admin);
    }

    // ─── Position Tracking ───────────────────────────────────────────────

    /// @notice Register a position for automated streaming processing
    /// @param ilpnId The ILPN token ID
    function registerPosition(uint256 ilpnId) external onlyRole(KEEPER_ROLE) {
        if (!isActivePosition[ilpnId]) {
            activePositionIds.push(ilpnId);
            isActivePosition[ilpnId] = true;
            emit PositionRegistered(ilpnId);
        }
    }

    /// @notice Remove a settled/cancelled position from tracking
    /// @param ilpnId The ILPN token ID
    function removePosition(uint256 ilpnId) external onlyRole(KEEPER_ROLE) {
        if (isActivePosition[ilpnId]) {
            isActivePosition[ilpnId] = false;
            // Find and remove from array (swap with last)
            for (uint256 i = 0; i < activePositionIds.length; i++) {
                if (activePositionIds[i] == ilpnId) {
                    activePositionIds[i] = activePositionIds[activePositionIds.length - 1];
                    activePositionIds.pop();
                    break;
                }
            }
            emit PositionRemoved(ilpnId);
        }
    }

    // ─── Batch Processing ────────────────────────────────────────────────

    /// @notice Process streaming premiums for a batch of positions
    /// @param ilpnIds Array of ILPN token IDs to process
    function processStreamingBatch(uint256[] calldata ilpnIds) external onlyRole(KEEPER_ROLE) {
        if (ilpnIds.length > maxBatchSize) revert BatchTooLarge();

        uint256 gasStart = gasleft();
        core.processStreaming(ilpnIds);

        emit StreamingProcessed(ilpnIds, gasStart - gasleft());
    }

    // ─── Volatility Updates ──────────────────────────────────────────────

    /// @notice Submit a volatility update for a pool
    /// @param poolId The pool identifier
    /// @param realizedVol 30-day Yang-Zhang realized vol (18 decimals)
    /// @param impliedVol 30-day ATM implied vol from Deribit (18 decimals)
    function updateVolatility(
        bytes32 poolId,
        uint256 realizedVol,
        uint256 impliedVol
    ) external onlyRole(VOL_UPDATER_ROLE) {
        if (block.number - lastVolUpdateBlock[poolId] < minVolUpdateInterval) revert TooSoon();

        lastVolUpdateBlock[poolId] = block.number;
        pricingOracle.updateVolatility(poolId, realizedVol, impliedVol);

        emit VolatilityUpdated(poolId, realizedVol, impliedVol);
    }

    // ─── Chainlink Automation Interface ──────────────────────────────────

    /// @notice Check if upkeep is needed (Chainlink Automation compatible)
    /// @return upkeepNeeded Whether upkeep should be performed
    /// @return performData Encoded data for performUpkeep
    function checkUpkeep(bytes calldata) external view returns (bool upkeepNeeded, bytes memory performData) {
        // Find positions that need streaming
        uint256[] memory needsProcessing = new uint256[](maxBatchSize);
        uint256 count = 0;

        for (uint256 i = 0; i < activePositionIds.length && count < maxBatchSize; i++) {
            uint256 ilpnId = activePositionIds[i];
            (,,,,,,,,,, uint256 lastPremiumBlock,,) = core.positions(ilpnId);

            if (block.number - lastPremiumBlock >= minProcessingInterval) {
                needsProcessing[count] = ilpnId;
                count++;
            }
        }

        if (count > 0) {
            // Trim array to actual size
            uint256[] memory batch = new uint256[](count);
            for (uint256 i = 0; i < count; i++) {
                batch[i] = needsProcessing[i];
            }
            upkeepNeeded = true;
            performData = abi.encode(batch);
        }
    }

    /// @notice Perform upkeep (Chainlink Automation compatible)
    /// @param performData Encoded batch of ILPN IDs from checkUpkeep
    function performUpkeep(bytes calldata performData) external onlyRole(KEEPER_ROLE) {
        uint256[] memory ilpnIds = abi.decode(performData, (uint256[]));
        core.processStreaming(ilpnIds);
        emit StreamingProcessed(ilpnIds, 0);
    }

    // ─── Admin ───────────────────────────────────────────────────────────

    /// @notice Update keeper parameters
    function setMaxBatchSize(uint256 _maxBatchSize) external onlyRole(DEFAULT_ADMIN_ROLE) {
        maxBatchSize = _maxBatchSize;
    }

    function setMinProcessingInterval(uint256 _interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minProcessingInterval = _interval;
    }

    function setMinVolUpdateInterval(uint256 _interval) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minVolUpdateInterval = _interval;
    }

    /// @notice Get count of active positions
    function activePositionCount() external view returns (uint256) {
        return activePositionIds.length;
    }
}
