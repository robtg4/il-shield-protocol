// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title JuniorVault
/// @notice ERC-4626 first-loss vault for risk-seeking underwriters
/// @dev Absorbs all IL claim payouts before Senior is impacted. Higher yield, higher risk.
contract JuniorVault is ERC4626, AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    uint256 public constant BPS = 10_000;

    /// @notice Minimum lock duration in blocks (~30 days at 12s blocks)
    uint256 public minLockDuration;

    /// @notice Maximum Senior/Junior ratio (50000 = 5:1 in basis points / 10000)
    uint256 public maxSeniorJuniorRatio;

    /// @notice Reference to Senior Vault for ratio checks
    address public seniorVault;

    /// @notice Track deposit blocks for lock enforcement
    mapping(address => uint256) public depositBlock;

    error LockActive();
    error WouldBreachSJRatio();
    error InsufficientAssets();

    event PremiumReceived(uint256 amount);
    event ClaimPaid(uint256 amount, address indexed to);

    constructor(IERC20 _usdc, address _seniorVault, address admin)
        ERC4626(_usdc)
        ERC20("IL Shield Junior Vault", "ilsJUNIOR")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);
        seniorVault = _seniorVault;
        minLockDuration = 216_000; // ~30 days
        maxSeniorJuniorRatio = 50_000; // 5:1
    }

    // ─── ERC-4626 Overrides ──────────────────────────────────────────────

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

    /// @notice Override withdraw with lock + Senior/Junior ratio floor
    function withdraw(uint256 assets, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        if (block.number < depositBlock[owner] + minLockDuration) revert LockActive();
        _enforceSJRatio(assets);
        return super.withdraw(assets, receiver, owner);
    }

    function redeem(uint256 shares, address receiver, address owner)
        public
        override
        nonReentrant
        returns (uint256)
    {
        if (block.number < depositBlock[owner] + minLockDuration) revert LockActive();
        uint256 assets = previewRedeem(shares);
        _enforceSJRatio(assets);
        return super.redeem(shares, receiver, owner);
    }

    // ─── Core Interface ──────────────────────────────────────────────────

    /// @notice Draw funds for claim payouts (first-loss)
    /// @param amount USDC amount requested
    /// @param to Recipient (ILShieldCore)
    function withdrawForClaim(uint256 amount, address to) external onlyRole(CORE_ROLE) nonReentrant {
        uint256 available = totalAssets();
        uint256 transferAmount = amount > available ? available : amount;
        if (transferAmount > 0) {
            IERC20(asset()).safeTransfer(to, transferAmount);
        }
        emit ClaimPaid(transferAmount, to);
    }

    /// @notice Receive premium income
    function receivePremium(uint256 amount) external onlyRole(CORE_ROLE) {
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        emit PremiumReceived(amount);
    }

    // ─── Admin ───────────────────────────────────────────────────────────

    function setMinLockDuration(uint256 _duration) external onlyRole(GOVERNANCE_ROLE) {
        minLockDuration = _duration;
    }

    function setMaxSeniorJuniorRatio(uint256 _ratio) external onlyRole(GOVERNANCE_ROLE) {
        maxSeniorJuniorRatio = _ratio;
    }

    function setSeniorVault(address _seniorVault) external onlyRole(GOVERNANCE_ROLE) {
        seniorVault = _seniorVault;
    }

    function pause() external onlyRole(GOVERNANCE_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNANCE_ROLE) {
        _unpause();
    }

    // ─── Internal ────────────────────────────────────────────────────────

    /// @notice Enforce Senior/Junior ratio floor on withdrawals
    function _enforceSJRatio(uint256 withdrawAmount) internal view {
        uint256 postWithdrawJunior = totalAssets() - withdrawAmount;
        uint256 seniorAssets = ERC4626(seniorVault).totalAssets();

        if (postWithdrawJunior == 0) {
            if (seniorAssets > 0) revert WouldBreachSJRatio();
            return;
        }

        // seniorAssets / postWithdrawJunior <= maxSeniorJuniorRatio / 10000
        if (seniorAssets * BPS / postWithdrawJunior > maxSeniorJuniorRatio) {
            revert WouldBreachSJRatio();
        }
    }

    function supportsInterface(bytes4 interfaceId) public view override(AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}
