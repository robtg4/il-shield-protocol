// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

interface IILShieldHook {
    function getTickCumulative(PoolId poolId) external view returns (int56);
    function getTickCumulativeAt(PoolId poolId, uint256 blockNumber) external view returns (int56);
}
