// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title SeniorVault
/// @notice ERC-4626 vault for conservative underwriters. Fixed yield, last-loss position.
/// @dev Deposits earn fixed yield from premium income. Claims only impact Senior after Junior is exhausted.
contract SeniorVault is ERC4626, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    uint256 public constant BPS = 10_000;

    /// @notice Minimum lock duration in blocks (~14 days at 12s blocks)
    uint256 public minLockDuration;

    /// @notice Emergency withdrawal penalty in basis points (500 = 5%)
    uint256 public emergencyWithdrawPenalty;

    /// @notice Utilization-based withdrawal thresholds
    uint256 public constant INSTANT_THRESHOLD = 6000;  // 60%
    uint256 public constant SLOW_THRESHOLD = 8000;      // 80%
    uint256 public constant SLOW_QUEUE_BLOCKS = 21600;   // ~3 days
    uint256 public constant EMERGENCY_QUEUE_BLOCKS = 50400; // ~7 days

    /// @notice Track deposit blocks for lock enforcement
    mapping(address => uint256) public depositBlock;

    /// @notice Withdrawal queue: depositor => earliest withdrawal block
    mapping(address => uint256) public withdrawalQueueBlock;

    /// @notice Total outstanding claim obligations
    uint256 public outstandingClaims;

    error LockActive();
    error InWithdrawalQueue();
    error InsufficientAssets();

    event EmergencyWithdrawal(address indexed owner, uint256 shares, uint256 assets, uint256 penalty);
    event PremiumReceived(uint256 amount);
    event ClaimPaid(uint256 amount, address indexed to);
    event WithdrawalQueued(address indexed owner, uint256 availableBlock);

    /// @notice ERC-4626 inflation attack defense: virtual share offset of 10^6
    function _decimalsOffset() internal pure override returns (uint8) {
        return 6;
    }

    constructor(IERC20 _usdc, address admin)
        ERC4626(_usdc)
        ERC20("IL Shield Senior Vault", "ilsSENIOR")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
        minLockDuration = 100_800; // ~14 days
        emergencyWithdrawPenalty = 500; // 5%
    }

    // ─── ERC-4626 Overrides ──────────────────────────────────────────────

    /// @notice Override deposit to track lock period
    function deposit(uint256 assets, address receiver)
        public
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        depositBlock[receiver] = block.number;
        return super.deposit(assets, receiver);
    }

    /// @notice Override mint to track lock period
    function mint(uint256 shares, address receiver)
        public
        override
        nonReentrant
        whenNotPaused
        returns (uint256)
    {
        depositBlock[receiver] = block.number;
        return super.mint(shares, receiver);
    }

    /// @notice Override withdraw with lock + utilization throttling
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        if (block.number < depositBlock[owner] + minLockDuration) revert LockActive();
        _enforceWithdrawalQueue(owner);
        return super.withdraw(assets, receiver, owner);
    }

    /// @notice Override redeem with lock + utilization throttling
    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        if (block.number < depositBlock[owner] + minLockDuration) revert LockActive();
        _enforceWithdrawalQueue(owner);
        return super.redeem(shares, receiver, owner);
    }

    // ─── Emergency Withdrawal ────────────────────────────────────────────

    /// @notice Emergency withdrawal at penalty (always available, bypasses queue)
    /// @param shares Amount of shares to redeem
    /// @param receiver Address to receive assets minus penalty
    function emergencyWithdraw(uint256 shares, address receiver) external nonReentrant {
        uint256 assets = previewRedeem(shares);
        uint256 penalty = assets * emergencyWithdrawPenalty / BPS;
        uint256 payout = assets - penalty;

        // Burn shares
        _burn(msg.sender, shares);

        // Transfer assets minus penalty (penalty stays in vault)
        IERC20(asset()).safeTransfer(receiver, payout);

        emit EmergencyWithdrawal(msg.sender, shares, payout, penalty);
    }

    // ─── Core Interface ──────────────────────────────────────────────────

    /// @notice Draw funds for claim payouts (only after Junior is exhausted)
    /// @param amount USDC amount to withdraw
    /// @param to Recipient (ILShieldCore)
    function withdrawForClaim(uint256 amount, address to) external onlyRole(CORE_ROLE) nonReentrant {
        IERC20(asset()).safeTransfer(to, amount);
        emit ClaimPaid(amount, to);
    }

    /// @notice Receive premium income (accrues to totalAssets via balance increase)
    /// @param amount USDC amount being deposited as premium
    function receivePremium(uint256 amount) external onlyRole(CORE_ROLE) {
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        emit PremiumReceived(amount);
    }

    // ─── View Helpers ────────────────────────────────────────────────────

    /// @notice Current utilization in basis points
    function utilizationBps() public view returns (uint256) {
        uint256 total = totalAssets();
        if (total == 0) return 0;
        return outstandingClaims * BPS / total;
    }

    // ─── Admin ───────────────────────────────────────────────────────────

    function setMinLockDuration(uint256 _duration) external onlyRole(GOVERNANCE_ROLE) {
        minLockDuration = _duration;
    }

    function setEmergencyWithdrawPenalty(uint256 _penalty) external onlyRole(GOVERNANCE_ROLE) {
        emergencyWithdrawPenalty = _penalty;
    }

    function setOutstandingClaims(uint256 _claims) external onlyRole(CORE_ROLE) {
        outstandingClaims = _claims;
    }

    function pause() external onlyRole(GOVERNANCE_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNANCE_ROLE) {
        _unpause();
    }

    // ─── Internal ────────────────────────────────────────────────────────

    /// @notice Enforce utilization-based withdrawal queue
    function _enforceWithdrawalQueue(address owner) internal {
        uint256 util = utilizationBps();

        if (util <= INSTANT_THRESHOLD) {
            // Instant withdrawal
            return;
        }

        uint256 queueBlock = withdrawalQueueBlock[owner];
        if (queueBlock == 0) {
            // Enter queue
            uint256 queueDuration = util <= SLOW_THRESHOLD ? SLOW_QUEUE_BLOCKS : EMERGENCY_QUEUE_BLOCKS;
            withdrawalQueueBlock[owner] = block.number + queueDuration;
            emit WithdrawalQueued(owner, block.number + queueDuration);
            revert InWithdrawalQueue();
        }

        if (block.number < queueBlock) revert InWithdrawalQueue();

        // Queue satisfied, reset
        delete withdrawalQueueBlock[owner];
    }

    /// @notice Required for AccessControl + ERC20
    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
