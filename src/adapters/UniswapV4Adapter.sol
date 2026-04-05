// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPositionAdapter} from "../interfaces/IPositionAdapter.sol";

interface IStateView {
    function getSlot0(bytes32 poolId)
        external
        view
        returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee);

    function getPositionInfo(bytes32 poolId, address owner, int24 tickLower, int24 tickUpper, bytes32 salt)
        external
        view
        returns (uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128);
}

interface IV4PositionManager {
    function getPoolAndPositionInfo(uint256 tokenId)
        external
        view
        returns (
            bytes32 poolKeyEncoded,
            uint256 positionInfo
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
        // solhint-disable-next-line no-unused-vars
        (bytes32 poolKeyEncoded, uint256 packedInfo) = positionManager.getPoolAndPositionInfo(positionId);

        // Decode packed position info: poolId(200) | tickUpper(24) | tickLower(24) | hasSubscriber(8)
        int24 tickLower = _unpackInt24(uint24(uint256(packedInfo >> 8)));
        int24 tickUpper = _unpackInt24(uint24(uint256(packedInfo >> 32)));
        bytes32 poolId = bytes32(packedInfo >> 56);

        // Read current price from StateView
        (uint160 sqrtPriceX96,,,) = stateView.getSlot0(poolId);

        // Read position liquidity from StateView
        // In v4, the PositionManager owns the position in the PoolManager
        (uint128 liquidity,,) = stateView.getPositionInfo(
            poolId,
            address(positionManager), // owner is the PositionManager
            tickLower,
            tickUpper,
            bytes32(0) // default salt
        );

        data = PositionData({
            sqrtPriceX96: sqrtPriceX96,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
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
