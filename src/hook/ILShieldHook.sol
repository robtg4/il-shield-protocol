// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {BalanceDelta, toBalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickAccumulator} from "./TickAccumulator.sol";

/// @title ILShieldHook
/// @notice Uniswap v4 hook for native IL protection on greenfield pools
/// @dev Implements afterInitialize, afterAddLiquidity (with returnDelta), beforeRemoveLiquidity,
///      afterRemoveLiquidity (with returnDelta), and afterSwap for tick accumulation
contract ILShieldHook is IHooks {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    error NotPoolManager();
    error NotSelf();

    event HookInitialized(PoolId indexed poolId, uint160 sqrtPriceX96, int24 tick);
    event LiquidityProtected(PoolId indexed poolId, address indexed provider, int24 tickLower, int24 tickUpper);
    event LiquiditySettled(PoolId indexed poolId, address indexed provider, uint256 payout);

    IPoolManager public immutable poolManager;
    TickAccumulator public immutable tickAccumulator;
    address public immutable ilShieldCore;

    /// @notice Track pre-removal state for settlement
    struct RemovalSnapshot {
        uint160 sqrtPriceX96;
        int24 tick;
        uint256 blockNumber;
    }
    mapping(PoolId => mapping(address => RemovalSnapshot)) public removalSnapshots;

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    constructor(IPoolManager _poolManager, TickAccumulator _tickAccumulator, address _ilShieldCore) {
        poolManager = _poolManager;
        tickAccumulator = _tickAccumulator;
        ilShieldCore = _ilShieldCore;
    }

    /// @notice Returns the hook permissions flags
    function getHookPermissions() public pure returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: true,
            beforeAddLiquidity: false,
            afterAddLiquidity: true,
            beforeRemoveLiquidity: true,
            afterRemoveLiquidity: true,
            beforeSwap: false,
            afterSwap: true,
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: true,
            afterRemoveLiquidityReturnDelta: true
        });
    }

    // ─── Hook Callbacks ──────────────────────────────────────────────────

    function beforeInitialize(address, PoolKey calldata, uint160) external pure returns (bytes4) {
        revert NotSelf();
    }

    /// @notice Initialize tick accumulator for the pool
    function afterInitialize(address, PoolKey calldata key, uint160 sqrtPriceX96, int24 tick)
        external
        onlyPoolManager
        returns (bytes4)
    {
        PoolId poolId = key.toId();
        tickAccumulator.update(poolId, tick, block.number);
        emit HookInitialized(poolId, sqrtPriceX96, tick);
        return IHooks.afterInitialize.selector;
    }

    function beforeAddLiquidity(address, PoolKey calldata, IPoolManager.ModifyLiquidityParams calldata, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert NotSelf();
    }

    /// @notice Capture entry state when liquidity is added; can deduct premium via return delta
    function afterAddLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata params,
        BalanceDelta,
        BalanceDelta,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, BalanceDelta) {
        PoolId poolId = key.toId();

        // If hookData contains registration request, process it
        if (hookData.length > 0) {
            emit LiquidityProtected(poolId, sender, params.tickLower, params.tickUpper);
            // Premium deduction would be encoded in hookData and applied via return delta
            // For now, return zero delta — premium handled off-chain or via Core
        }

        return (IHooks.afterAddLiquidity.selector, toBalanceDelta(0, 0));
    }

    /// @notice Snapshot pre-removal state
    function beforeRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        bytes calldata
    ) external onlyPoolManager returns (bytes4) {
        PoolId poolId = key.toId();
        (uint160 sqrtPriceX96, int24 tick,,) = poolManager.getSlot0(poolId);

        removalSnapshots[poolId][sender] = RemovalSnapshot({
            sqrtPriceX96: sqrtPriceX96,
            tick: tick,
            blockNumber: block.number
        });

        return IHooks.beforeRemoveLiquidity.selector;
    }

    /// @notice Compute IL and settle claim on liquidity removal
    function afterRemoveLiquidity(
        address sender,
        PoolKey calldata key,
        IPoolManager.ModifyLiquidityParams calldata,
        BalanceDelta,
        BalanceDelta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, BalanceDelta) {
        PoolId poolId = key.toId();

        // Settlement logic would call ILShieldCore.settle() here
        // For now, emit event and return zero delta
        // Actual payout would be returned via BalanceDelta
        RemovalSnapshot memory snapshot = removalSnapshots[poolId][sender];
        if (snapshot.blockNumber > 0) {
            emit LiquiditySettled(poolId, sender, 0);
            delete removalSnapshots[poolId][sender];
        }

        return (IHooks.afterRemoveLiquidity.selector, toBalanceDelta(0, 0));
    }

    function beforeSwap(address, PoolKey calldata, IPoolManager.SwapParams calldata, bytes calldata)
        external
        pure
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        revert NotSelf();
    }

    /// @notice Update tick accumulator on every swap (~5-20k gas)
    function afterSwap(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) external onlyPoolManager returns (bytes4, int128) {
        PoolId poolId = key.toId();
        (, int24 currentTick,,) = poolManager.getSlot0(poolId);
        tickAccumulator.update(poolId, currentTick, block.number);
        return (IHooks.afterSwap.selector, 0);
    }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert NotSelf();
    }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external
        pure
        returns (bytes4)
    {
        revert NotSelf();
    }
}
