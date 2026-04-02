// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IPricingOracle {
    event VolatilityUpdated(bytes32 indexed poolId, uint256 realizedVol, uint256 impliedVol);
    event PriceFeedUpdated(bytes32 indexed poolId, address feed);

    error StalePrice();
    error InvalidFeed();
    error VolatilityStale();

    function getChainlinkSqrtPriceX96(bytes32 poolId) external view returns (uint160);
    function getTWAPSqrtPriceX96(bytes32 poolId, uint32 period) external view returns (uint160);
    function getVolatility(bytes32 poolId) external view returns (uint256);
    function computePremiumRate(
        bytes32 poolId,
        int24 tickLower,
        int24 tickUpper,
        uint8 coverageTier
    ) external view returns (uint256);
    function updateVolatility(bytes32 poolId, uint256 newRealizedVol, uint256 newImpliedVol) external;
}
