// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

/// @title ILShieldRouter
/// @notice Multicall helper for common IL Shield workflows
/// @dev Bundles approve + register and settle + withdraw into single transactions
interface IILShieldCoreRouter {
    function register(
        uint256 positionId,
        uint8 coverageTier,
        uint48 durationBlocks,
        uint256 premiumDeposit,
        address referrer
    ) external returns (uint256 ilpnId);

    function settle(uint256 ilpnId, uint160 settlementSqrtPriceX96, bytes calldata brevisProof) external;
    function cancelProtection(uint256 ilpnId) external;
    function topUpPremium(uint256 ilpnId, uint256 amount) external;
    function usdc() external view returns (IERC20);
}

contract ILShieldRouter {
    using SafeERC20 for IERC20;

    IILShieldCoreRouter public immutable core;
    IERC20 public immutable usdc;

    error ZeroAmount();

    event RegisterAndFund(address indexed lp, uint256 indexed ilpnId, uint256 premiumAmount);
    event SettleAndWithdraw(address indexed lp, uint256 indexed ilpnId, uint256 payout);

    constructor(address _core) {
        core = IILShieldCoreRouter(_core);
        usdc = core.usdc();
    }

    /// @notice Register a position and fund premium in a single transaction
    /// @param positionId Uniswap v4 position NFT ID
    /// @param coverageTier 0=50%, 1=75%, 2=100%
    /// @param durationBlocks Coverage duration in blocks
    /// @param premiumAmount USDC amount for premium deposit
    /// @param referrer Integration partner address (or address(0))
    /// @return ilpnId The minted ILPN token ID
    function registerAndFund(
        uint256 positionId,
        uint8 coverageTier,
        uint48 durationBlocks,
        uint256 premiumAmount,
        address referrer
    ) external returns (uint256 ilpnId) {
        if (premiumAmount == 0) revert ZeroAmount();

        // Transfer USDC from user to this contract
        usdc.safeTransferFrom(msg.sender, address(this), premiumAmount);

        // Approve core to spend
        usdc.approve(address(core), premiumAmount);

        // Register with core
        ilpnId = core.register(positionId, coverageTier, durationBlocks, premiumAmount, referrer);

        emit RegisterAndFund(msg.sender, ilpnId, premiumAmount);
    }

    /// @notice Register with ERC-2612 permit (gasless approval)
    /// @param positionId Uniswap v4 position NFT ID
    /// @param coverageTier 0=50%, 1=75%, 2=100%
    /// @param durationBlocks Coverage duration in blocks
    /// @param premiumAmount USDC amount for premium deposit
    /// @param referrer Integration partner address
    /// @param deadline Permit deadline
    /// @param v Permit signature v
    /// @param r Permit signature r
    /// @param s Permit signature s
    /// @return ilpnId The minted ILPN token ID
    function registerWithPermit(
        uint256 positionId,
        uint8 coverageTier,
        uint48 durationBlocks,
        uint256 premiumAmount,
        address referrer,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 ilpnId) {
        // Execute permit
        IERC20Permit(address(usdc)).permit(msg.sender, address(this), premiumAmount, deadline, v, r, s);

        // Delegate to registerAndFund logic
        usdc.safeTransferFrom(msg.sender, address(this), premiumAmount);
        usdc.approve(address(core), premiumAmount);
        ilpnId = core.register(positionId, coverageTier, durationBlocks, premiumAmount, referrer);

        emit RegisterAndFund(msg.sender, ilpnId, premiumAmount);
    }

    /// @notice Top up premium with permit
    /// @param ilpnId The ILPN token ID
    /// @param amount USDC amount to add
    /// @param deadline Permit deadline
    /// @param v Permit signature v
    /// @param r Permit signature r
    /// @param s Permit signature s
    function topUpWithPermit(
        uint256 ilpnId,
        uint256 amount,
        uint256 deadline,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        IERC20Permit(address(usdc)).permit(msg.sender, address(this), amount, deadline, v, r, s);
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        usdc.approve(address(core), amount);
        core.topUpPremium(ilpnId, amount);
    }

    /// @notice Settle a claim — payout goes to the ILPN owner
    /// @param ilpnId The ILPN token ID
    /// @param settlementSqrtPriceX96 Exit price for settlement
    /// @param brevisProof Optional ZK proof for historical data
    function settle(uint256 ilpnId, uint160 settlementSqrtPriceX96, bytes calldata brevisProof) external {
        core.settle(ilpnId, settlementSqrtPriceX96, brevisProof);
        emit SettleAndWithdraw(msg.sender, ilpnId, 0);
    }
}
