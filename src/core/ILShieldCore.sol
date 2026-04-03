// SPDX-License-Identifier: MIT
// IL Shield Protocol — Core Settlement Engine
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILMath} from "../libraries/ILMath.sol";
import {PremiumMath} from "../libraries/PremiumMath.sol";
import {ILPNRegistry} from "./ILPNRegistry.sol";
import {SeniorVault} from "./SeniorVault.sol";
import {JuniorVault} from "./JuniorVault.sol";
import {PricingOracle} from "./PricingOracle.sol";

/// @title ILShieldCore
/// @notice Central registry and settlement engine for IL Shield Protocol
/// @dev Manages position registrations, premium streaming, and claim settlement
contract ILShieldCore is AccessControl, ReentrancyGuard, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    uint256 public constant BPS = 10_000;

    // ─── Position Data ───────────────────────────────────────────────────

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
        address owner;
        address referrer;
    }

    mapping(uint256 => Position) public positions;
    uint256 public nextPositionId;

    // ─── Protocol Parameters ─────────────────────────────────────────────

    uint256 public warmingPeriodBlocks;      // 48-72 hours (~14400-21600 blocks)
    uint256 public fullCoverageRampBlocks;   // 7 days (~50400 blocks)
    uint256 public settlementFeeRate;        // 200 = 2%
    uint256 public minCoverageDuration;      // Minimum 7 days in blocks

    // Premium distribution splits (basis points, must sum to 10000)
    uint256 public seniorShare;    // 7000 = 70%
    uint256 public juniorShare;    // 1500 = 15%
    uint256 public treasuryShare;  // 1000 = 10%
    uint256 public referralShare;  // 500  = 5%

    // ─── Contract References ─────────────────────────────────────────────

    SeniorVault public seniorVault;
    JuniorVault public juniorVault;
    ILPNRegistry public ilpnRegistry;
    PricingOracle public pricingOracle;
    address public treasury;
    IERC20 public usdc;

    // ─── Errors ──────────────────────────────────────────────────────────

    error InvalidCoverageTier();
    error InsufficientPremium();
    error DurationTooShort();
    error PositionAlreadySettled();
    error NotILPNOwner();
    error CoverageExpired();
    error CoverageNotStarted();
    error SettlementPriceDisputed(uint160 chainlinkPrice, uint160 twapPrice, uint256 divergenceBps);
    error PremiumExhausted();
    error InvalidShares();

    // ─── Events ──────────────────────────────────────────────────────────

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

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(
        address _usdc,
        address _seniorVault,
        address _juniorVault,
        address _ilpnRegistry,
        address _pricingOracle,
        address _treasury,
        address admin
    ) {
        usdc = IERC20(_usdc);
        seniorVault = SeniorVault(_seniorVault);
        juniorVault = JuniorVault(_juniorVault);
        ilpnRegistry = ILPNRegistry(_ilpnRegistry);
        pricingOracle = PricingOracle(_pricingOracle);
        treasury = _treasury;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(GOVERNANCE_ROLE, admin);

        // Default parameters
        warmingPeriodBlocks = 14_400;     // ~48 hours
        fullCoverageRampBlocks = 50_400;  // ~7 days
        settlementFeeRate = 200;           // 2%
        minCoverageDuration = 50_400;      // ~7 days

        // Premium splits
        seniorShare = 7000;
        juniorShare = 1500;
        treasuryShare = 1000;
        referralShare = 500;
    }

    // ─── Registration ────────────────────────────────────────────────────

    /// @notice Register an existing Uniswap v4 position for IL protection
    /// @param positionId Uniswap v4 position NFT token ID (for future integration)
    /// @param coverageTier 0=50%, 1=75%, 2=100%
    /// @param durationBlocks Coverage duration in blocks
    /// @param premiumDeposit USDC amount deposited to fund streaming premiums
    /// @param referrer Integration partner address (or address(0))
    /// @return ilpnId The minted ILPN token ID
    function register(
        uint256 positionId,
        uint8 coverageTier,
        uint48 durationBlocks,
        uint256 premiumDeposit,
        address referrer
    ) external nonReentrant whenNotPaused returns (uint256 ilpnId) {
        if (coverageTier > 2) revert InvalidCoverageTier();
        if (durationBlocks < minCoverageDuration) revert DurationTooShort();
        if (premiumDeposit == 0) revert InsufficientPremium();

        // Transfer premium deposit from LP
        usdc.safeTransferFrom(msg.sender, address(this), premiumDeposit);

        // Assign ILPN ID
        ilpnId = nextPositionId++;

        // For now, use positionId as poolId proxy and set mock entry state
        // In production, this reads from Uniswap PositionManager
        bytes32 poolId = bytes32(positionId);

        // Compute premium rate from pricing oracle
        // Default tick range for initial implementation
        int24 tickLower = -887220; // ~full range
        int24 tickUpper = 887220;
        uint256 premiumRate = pricingOracle.computePremiumRate(poolId, tickLower, tickUpper, coverageTier);

        // Ensure premium deposit covers at least minimum duration
        uint256 minPremium = premiumRate * durationBlocks;
        if (premiumDeposit < minPremium && premiumRate > 0) revert InsufficientPremium();

        uint48 startBlock = uint48(block.number) + uint48(warmingPeriodBlocks);

        positions[ilpnId] = Position({
            poolId: poolId,
            entrySqrtPriceX96: 0, // Set by oracle or hook in production
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: 0, // Set from PositionManager in production
            coverageTier: coverageTier,
            coverageStartBlock: startBlock,
            coverageEndBlock: startBlock + durationBlocks,
            premiumBalance: premiumDeposit,
            premiumRatePerBlock: premiumRate,
            lastPremiumBlock: uint256(block.number),
            maxPayout: premiumDeposit * 10, // 10x premium as max payout cap
            settled: false,
            owner: msg.sender,
            referrer: referrer
        });

        // Mint ILPN
        ilpnRegistry.mint(msg.sender, ilpnId);
        ilpnRegistry.setMetadata(ilpnId, poolId, coverageTier, startBlock, startBlock + durationBlocks);

        emit PositionRegistered(ilpnId, msg.sender, poolId, coverageTier, premiumDeposit);
    }

    // ─── Settlement ──────────────────────────────────────────────────────

    /// @notice Settle a claim after the LP has closed their Uniswap position
    /// @param ilpnId The ILPN token ID to settle
    /// @param settlementSqrtPriceX96 The exit price
    /// @param brevisProof Optional ZK proof for historical data (unused in v1)
    function settle(
        uint256 ilpnId,
        uint160 settlementSqrtPriceX96,
        bytes calldata brevisProof
    ) external nonReentrant {
        brevisProof; // reserved for future ZK integration

        Position storage pos = positions[ilpnId];
        if (pos.settled) revert PositionAlreadySettled();
        if (pos.owner != msg.sender) revert NotILPNOwner();
        if (block.number < pos.coverageStartBlock) revert CoverageNotStarted();

        // Mark as settled
        pos.settled = true;

        // Deduct any remaining accrued premiums
        _deductPremium(ilpnId);

        // Verify settlement price: check Chainlink vs TWAP divergence
        uint160 chainlinkPrice = pricingOracle.getChainlinkSqrtPriceX96(pos.poolId);
        uint160 twapPrice = pricingOracle.getTWAPSqrtPriceX96(pos.poolId, 1800); // 30 min

        if (twapPrice > 0) {
            uint256 divergence = _absDiffBps(chainlinkPrice, twapPrice);
            if (divergence > 300) {
                emit SettlementDelayed(ilpnId, chainlinkPrice, twapPrice, divergence);
                revert SettlementPriceDisputed(chainlinkPrice, twapPrice, divergence);
            }
        }

        // Compute IL
        uint256 ilAmount = ILMath.computeIL(
            pos.entrySqrtPriceX96,
            settlementSqrtPriceX96,
            pos.tickLower,
            pos.tickUpper,
            pos.liquidity
        );

        // Compute payout
        uint256 payout = _computePayout(ilpnId, ilAmount);

        if (payout > 0) {
            _executePayout(payout);
            usdc.safeTransfer(pos.owner, payout);
        }

        // Compute settlement fee
        uint256 fee = ilAmount > 0 ? (payout * settlementFeeRate / BPS) : 0;

        // Burn ILPN
        ilpnRegistry.markSettled(ilpnId);
        ilpnRegistry.burn(ilpnId);

        emit ClaimSettled(ilpnId, pos.owner, payout, fee);
    }

    // ─── Premium Management ──────────────────────────────────────────────

    /// @notice Top up premium balance for an existing position
    function topUpPremium(uint256 ilpnId, uint256 amount) external nonReentrant {
        Position storage pos = positions[ilpnId];
        if (pos.settled) revert PositionAlreadySettled();

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        pos.premiumBalance += amount;

        emit PremiumTopUp(ilpnId, amount);
    }

    /// @notice Cancel protection and withdraw remaining premium
    function cancelProtection(uint256 ilpnId) external nonReentrant {
        Position storage pos = positions[ilpnId];
        if (pos.settled) revert PositionAlreadySettled();
        if (pos.owner != msg.sender) revert NotILPNOwner();

        // Deduct accrued premiums
        _deductPremium(ilpnId);

        uint256 refund = pos.premiumBalance;
        pos.premiumBalance = 0;
        pos.settled = true;

        if (refund > 0) {
            usdc.safeTransfer(msg.sender, refund);
        }

        ilpnRegistry.burn(ilpnId);

        emit ProtectionCancelled(ilpnId, refund);
    }

    /// @notice Process streaming premiums for a batch of positions
    /// @param ilpnIds Array of ILPN token IDs to process
    function processStreaming(uint256[] calldata ilpnIds) external {
        for (uint256 i = 0; i < ilpnIds.length; i++) {
            _deductAndDistributePremium(ilpnIds[i]);
        }
    }

    // ─── Internal: Settlement ────────────────────────────────────────────

    function _computePayout(uint256 ilpnId, uint256 ilAmount) internal view returns (uint256 payout) {
        Position storage pos = positions[ilpnId];

        // Apply coverage tier
        uint256 coveredIL = ilAmount * PremiumMath.coverageMultiplierBps(pos.coverageTier) / BPS;

        // Apply warming period ramp
        uint256 elapsedBlocks = block.number > pos.coverageStartBlock
            ? block.number - pos.coverageStartBlock
            : 0;
        uint256 effectiveCoverage = elapsedBlocks >= fullCoverageRampBlocks
            ? BPS
            : (elapsedBlocks * BPS) / fullCoverageRampBlocks;
        coveredIL = coveredIL * effectiveCoverage / BPS;

        // Cap at maxPayout
        payout = coveredIL > pos.maxPayout ? pos.maxPayout : coveredIL;

        // Deduct settlement fee
        uint256 fee = payout * settlementFeeRate / BPS;
        payout = payout > fee ? payout - fee : 0;
    }

    function _executePayout(uint256 amount) internal {
        // Draw from Junior first (first-loss)
        uint256 juniorAssets = IERC20(juniorVault.asset()).balanceOf(address(juniorVault));

        if (amount <= juniorAssets) {
            juniorVault.withdrawForClaim(amount, address(this));
        } else {
            // Junior exhausted, overflow to Senior
            if (juniorAssets > 0) {
                juniorVault.withdrawForClaim(juniorAssets, address(this));
            }
            uint256 overflow = amount - juniorAssets;
            seniorVault.withdrawForClaim(overflow, address(this));
        }
    }

    // ─── Internal: Premium Streaming ─────────────────────────────────────

    function _deductPremium(uint256 ilpnId) internal {
        Position storage pos = positions[ilpnId];
        if (pos.settled || pos.premiumBalance == 0) return;

        uint256 blocksElapsed = block.number - pos.lastPremiumBlock;
        if (blocksElapsed == 0) return;

        uint256 premiumDue = blocksElapsed * pos.premiumRatePerBlock;
        uint256 deducted = premiumDue > pos.premiumBalance ? pos.premiumBalance : premiumDue;

        pos.premiumBalance -= deducted;
        pos.lastPremiumBlock = block.number;
    }

    function _deductAndDistributePremium(uint256 ilpnId) internal {
        Position storage pos = positions[ilpnId];
        if (pos.settled || pos.premiumBalance == 0) return;

        uint256 blocksElapsed = block.number - pos.lastPremiumBlock;
        if (blocksElapsed == 0) return;

        uint256 premiumDue = blocksElapsed * pos.premiumRatePerBlock;
        uint256 deducted = premiumDue > pos.premiumBalance ? pos.premiumBalance : premiumDue;

        pos.premiumBalance -= deducted;
        pos.lastPremiumBlock = block.number;

        if (deducted > 0) {
            _distributePremium(deducted, pos.referrer);
        }

        emit StreamingProcessed(ilpnId, deducted);
    }

    function _distributePremium(uint256 amount, address referrer) internal {
        uint256 toSenior = amount * seniorShare / BPS;
        uint256 toJunior = amount * juniorShare / BPS;
        uint256 toTreasury = amount * treasuryShare / BPS;
        uint256 toReferral = referrer != address(0) ? amount * referralShare / BPS : 0;

        // If no referrer, treasury gets the referral share
        if (referrer == address(0)) {
            toTreasury += amount * referralShare / BPS;
        }

        if (toSenior > 0) {
            usdc.approve(address(seniorVault), toSenior);
            seniorVault.receivePremium(toSenior);
        }
        if (toJunior > 0) {
            usdc.approve(address(juniorVault), toJunior);
            juniorVault.receivePremium(toJunior);
        }
        if (toTreasury > 0) {
            usdc.safeTransfer(treasury, toTreasury);
        }
        if (toReferral > 0) {
            usdc.safeTransfer(referrer, toReferral);
        }
    }

    // ─── Internal: Helpers ───────────────────────────────────────────────

    function _absDiffBps(uint160 a, uint160 b) internal pure returns (uint256) {
        uint256 diff = a > b ? uint256(a) - uint256(b) : uint256(b) - uint256(a);
        return diff * BPS / uint256(a);
    }

    // ─── Governance ──────────────────────────────────────────────────────

    function setWarmingPeriodBlocks(uint256 _blocks) external onlyRole(GOVERNANCE_ROLE) {
        warmingPeriodBlocks = _blocks;
    }

    function setFullCoverageRampBlocks(uint256 _blocks) external onlyRole(GOVERNANCE_ROLE) {
        fullCoverageRampBlocks = _blocks;
    }

    function setSettlementFeeRate(uint256 _rate) external onlyRole(GOVERNANCE_ROLE) {
        settlementFeeRate = _rate;
    }

    function setPremiumShares(uint256 _senior, uint256 _junior, uint256 _treasury, uint256 _referral)
        external
        onlyRole(GOVERNANCE_ROLE)
    {
        if (_senior + _junior + _treasury + _referral != BPS) revert InvalidShares();
        seniorShare = _senior;
        juniorShare = _junior;
        treasuryShare = _treasury;
        referralShare = _referral;
    }

    function setTreasury(address _treasury) external onlyRole(GOVERNANCE_ROLE) {
        treasury = _treasury;
    }

    function pause() external onlyRole(GOVERNANCE_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(GOVERNANCE_ROLE) {
        _unpause();
    }
}
