// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

/// @title TickAccumulator
/// @notice Stores tick cumulative values per pool for IL computation at settlement time
/// @dev Updated on every swap via the ILShieldHook's afterSwap callback
contract TickAccumulator {
    struct Checkpoint {
        uint48 blockNumber;
        int56 tickCumulative;
        int24 lastTick;
    }

    /// @notice Latest checkpoint per pool
    mapping(PoolId => Checkpoint) public latestCheckpoint;

    /// @notice Historical tick cumulative snapshots: poolId => blockNumber => tickCumulative
    mapping(PoolId => mapping(uint256 => int56)) public checkpoints;

    /// @notice Whether a checkpoint exists for a given pool and block
    mapping(PoolId => mapping(uint256 => bool)) public hasCheckpoint;

    error OnlyHook();
    error NoCheckpoint();
    error InvalidBlockRange();

    event TickAccumulatorUpdated(PoolId indexed poolId, uint48 blockNumber, int56 tickCumulative, int24 tick);

    /// @notice Address of the ILShieldHook allowed to update
    address public immutable hook;

    constructor(address _hook) {
        hook = _hook;
    }

    modifier onlyHook() {
        if (msg.sender != hook) revert OnlyHook();
        _;
    }

    /// @notice Update the tick accumulator for a pool
    /// @param poolId The pool identifier
    /// @param currentTick The current tick after the swap
    /// @param currentBlock The current block number
    function update(PoolId poolId, int24 currentTick, uint256 currentBlock) external onlyHook {
        Checkpoint storage cp = latestCheckpoint[poolId];

        if (cp.blockNumber == 0) {
            // First checkpoint — initialize
            cp.blockNumber = uint48(currentBlock);
            cp.tickCumulative = 0;
            cp.lastTick = currentTick;
        } else {
            // Accumulate: tickCumulative += lastTick * (currentBlock - lastBlock)
            uint48 elapsed = uint48(currentBlock) - cp.blockNumber;
            if (elapsed > 0) {
                cp.tickCumulative += int56(cp.lastTick) * int56(int48(elapsed));
                cp.blockNumber = uint48(currentBlock);
            }
            cp.lastTick = currentTick;
        }

        // Store snapshot at this block
        checkpoints[poolId][currentBlock] = cp.tickCumulative;
        hasCheckpoint[poolId][currentBlock] = true;

        emit TickAccumulatorUpdated(poolId, cp.blockNumber, cp.tickCumulative, currentTick);
    }

    /// @notice Get the tick cumulative at a specific block (must have been checkpointed)
    /// @param poolId The pool identifier
    /// @param blockNumber The block to query
    /// @return tickCumulative The accumulated tick value at that block
    function getTickCumulativeAt(PoolId poolId, uint256 blockNumber) external view returns (int56) {
        if (!hasCheckpoint[poolId][blockNumber]) revert NoCheckpoint();
        return checkpoints[poolId][blockNumber];
    }

    /// @notice Compute the time-weighted average tick between two blocks
    /// @param poolId The pool identifier
    /// @param startBlock The start block (must have checkpoint)
    /// @param endBlock The end block (must have checkpoint)
    /// @return averageTick The TWAP tick over the period
    function computeAverageTick(
        PoolId poolId,
        uint256 startBlock,
        uint256 endBlock
    ) external view returns (int24 averageTick) {
        if (endBlock <= startBlock) revert InvalidBlockRange();
        if (!hasCheckpoint[poolId][startBlock]) revert NoCheckpoint();
        if (!hasCheckpoint[poolId][endBlock]) revert NoCheckpoint();

        int56 startCumulative = checkpoints[poolId][startBlock];
        int56 endCumulative = checkpoints[poolId][endBlock];

        averageTick = int24((endCumulative - startCumulative) / int56(int256(endBlock - startBlock)));
    }

    /// @notice Get the latest checkpoint for a pool
    /// @param poolId The pool identifier
    /// @return blockNumber The block of the latest checkpoint
    /// @return tickCumulative The cumulative tick at that block
    /// @return lastTick The last recorded tick
    function getLatestCheckpoint(PoolId poolId)
        external
        view
        returns (uint48 blockNumber, int56 tickCumulative, int24 lastTick)
    {
        Checkpoint storage cp = latestCheckpoint[poolId];
        return (cp.blockNumber, cp.tickCumulative, cp.lastTick);
    }
}
