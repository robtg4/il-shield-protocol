// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPositionAdapter} from "../interfaces/IPositionAdapter.sol";

interface IStateView {
    function getSlot0(bytes32 poolId)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee);
}

interface IV4PositionManager {
    function getPoolAndPositionInfo(uint256 tokenId)
        external
        view
        returns (
            bytes32 poolKeyEncoded, // packed PoolKey (currency0, currency1, fee, tickSpacing, hooks)
            uint256 positionInfo    // packed (poolId | tickUpper | tickLower | hasSubscriber)
        );
}

/// @title UniswapV4Adapter
/// @notice Reads position data from Uniswap v4's PositionManager and StateView
contract UniswapV4Adapter is IPositionAdapter {
    IV4PositionManager public immutable positionManager;
    IStateView public immutable stateView;

    constructor(address _positionManager, address _stateView) {
        positionManager = IV4PositionManager(_positionManager);
        stateView = IStateView(_stateView);
    }

    function getPosition(uint256 positionId) external view override returns (PositionData memory data) {
        (bytes32 poolKeyEncoded, uint256 packedInfo) = positionManager.getPoolAndPositionInfo(positionId);

        // Decode packed position info: poolId(200) | tickUpper(24) | tickLower(24) | hasSubscriber(8)
        int24 tickLower = _unpackInt24(uint24(uint256(packedInfo >> 8)));
        int24 tickUpper = _unpackInt24(uint24(uint256(packedInfo >> 32)));
        bytes32 poolId = bytes32(packedInfo >> 56);

        // Read current price from StateView
        (uint160 sqrtPriceX96,,,) = stateView.getSlot0(poolId);

        // Note: v4 PoolKey contains (currency0, currency1, fee, tickSpacing, hooks)
        // but getPoolAndPositionInfo returns it as a packed bytes32.
        // For IL computation we primarily need sqrtPriceX96, ticks, and liquidity.
        // Liquidity is not directly returned by getPoolAndPositionInfo — it requires
        // a separate positionInfo() call. For now we set liquidity from the pool.
        data = PositionData({
            sqrtPriceX96: sqrtPriceX96,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: 0, // v4 requires separate liquidity read — set by caller if needed
            token0: address(0),
            token1: address(0),
            feeRate: 0,
            pool: address(uint160(uint256(poolId)))
        });
    }

    function getPoolPrice(address pool) external view override returns (uint160 sqrtPriceX96) {
        (sqrtPriceX96,,,) = stateView.getSlot0(bytes32(uint256(uint160(pool))));
    }

    function _unpackInt24(uint24 val) internal pure returns (int24) {
        return val >= 0x800000 ? int24(int256(uint256(val)) - int256(0x1000000)) : int24(uint24(val));
    }

    function dexName() external pure returns (string memory) { return "Uniswap v4"; }
    function dexId() external pure returns (string memory) { return "uniswap-v4"; }
}
