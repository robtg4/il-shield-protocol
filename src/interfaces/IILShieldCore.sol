// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IILShieldCore {
    struct Position {
        bytes32 poolId;
        uint160 entrySqrtPriceX96;
        int24 tickLower;
        int24 tickUpper;
        uint128 liquidity;
        uint8 coverageTier;
        uint48 coverageStartBlock;
        uint48 coverageEndBlock;
        uint256 premiumBalance;
        uint256 premiumRatePerBlock;
        uint256 lastPremiumBlock;
        uint256 maxPayout;
        bool settled;
    }

    event PositionRegistered(
        uint256 indexed ilpnId,
        address indexed lp,
        bytes32 indexed poolId,
        uint8 coverageTier,
        uint256 premiumDeposit
    );
    event ClaimSettled(uint256 indexed ilpnId, address indexed lp, uint256 payout, uint256 fee);
    event PremiumTopUp(uint256 indexed ilpnId, uint256 amount);
    event ProtectionCancelled(uint256 indexed ilpnId, uint256 refund);
    event StreamingProcessed(uint256 indexed ilpnId, uint256 premiumDeducted);
    event SettlementDelayed(uint256 indexed ilpnId, uint160 chainlinkPrice, uint160 twapPrice, uint256 divergenceBps);

    error InvalidCoverageTier();
    error InsufficientPremium();
    error DurationTooShort();
    error PositionAlreadySettled();
    error NotILPNOwner();
    error CoverageExpired();
    error CoverageNotStarted();
    error SettlementPriceDisputed(uint160 chainlinkPrice, uint160 twapPrice, uint256 divergenceBps);

    function register(
        uint256 positionId,
        uint8 coverageTier,
        uint48 durationBlocks,
        uint256 premiumDeposit,
        address referrer
    ) external returns (uint256 ilpnId);

    function settle(uint256 ilpnId, uint160 settlementSqrtPriceX96, bytes calldata brevisProof) external;
    function topUpPremium(uint256 ilpnId, uint256 amount) external;
    function cancelProtection(uint256 ilpnId) external;
    function processStreaming(uint256[] calldata ilpnIds) external;

    function positions(uint256 ilpnId) external view returns (
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

    function usdc() external view returns (IERC20);
}
