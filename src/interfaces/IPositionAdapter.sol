// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IPositionAdapter {
    struct PositionData {
        uint160 sqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        address token0;
        address token1;
        uint24 feeRate;
        address pool;
    }

    /// @notice Read position data from the DEX's on-chain contracts
    function getPosition(uint256 positionId) external view returns (PositionData memory);

    /// @notice Read current pool price for a previously read position
    function getPoolPrice(address pool) external view returns (uint160 sqrtPriceX96);

    /// @notice Human-readable DEX name
    function dexName() external view returns (string memory);

    /// @notice DEX identifier for the frontend (lowercase, no spaces)
    function dexId() external view returns (string memory);
}
