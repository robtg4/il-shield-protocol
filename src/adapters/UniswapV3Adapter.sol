// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPositionAdapter} from "../interfaces/IPositionAdapter.sol";

interface INonfungiblePositionManager {
    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
    function factory() external view returns (address);
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
}

interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
}

/// @title UniswapV3Adapter
/// @notice Reads position data from any Uniswap v3 fork NonfungiblePositionManager.
/// @dev Works identically for Uniswap v3, PancakeSwap v3, SushiSwap v3 — deploy
///      with the correct positionManager address for each DEX/chain combo.
contract UniswapV3Adapter is IPositionAdapter {
    INonfungiblePositionManager public immutable positionManager;
    IUniswapV3Factory public immutable factory;
    string private _dexName;
    string private _dexId;

    error PoolNotFound();

    constructor(
        address _positionManager,
        string memory dexName_,
        string memory dexId_
    ) {
        positionManager = INonfungiblePositionManager(_positionManager);
        factory = IUniswapV3Factory(positionManager.factory());
        _dexName = dexName_;
        _dexId = dexId_;
    }

    function getPosition(uint256 positionId) external view override returns (PositionData memory data) {
        (
            ,
            ,
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,,,
        ) = positionManager.positions(positionId);

        address pool = factory.getPool(token0, token1, fee);
        if (pool == address(0)) revert PoolNotFound();

        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();

        data = PositionData({
            sqrtPriceX96: sqrtPriceX96,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            token0: token0,
            token1: token1,
            feeRate: fee,
            pool: pool
        });
    }

    function getPoolPrice(address pool) external view override returns (uint160 sqrtPriceX96) {
        (sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
    }

    function dexName() external view override returns (string memory) { return _dexName; }
    function dexId() external view override returns (string memory) { return _dexId; }
}
