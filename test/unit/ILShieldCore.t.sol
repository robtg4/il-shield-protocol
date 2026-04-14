// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILShieldCore} from "../../src/core/ILShieldCore.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {JuniorVault} from "../../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../../src/core/PricingOracle.sol";
import {ILMath} from "../../src/libraries/ILMath.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

contract MockUSDCCore is ERC20 {
    constructor() ERC20("USDC", "USDC") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MockFeedCore {
    int256 public price;
    constructor(int256 p) { price = p; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, block.timestamp, 1);
    }
    function decimals() external pure returns (uint8) { return 8; }
}

/// @title Section 1: ILShieldCore Branch Coverage
contract ILShieldCoreTest is Test {
    MockUSDCCore usdc;
    ILShieldCore core;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILPNRegistry registry;
    PricingOracle oracle;
    MockFeedCore feed;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 constant POOL_ID = bytes32(uint256(1));

    address admin = address(this);
    address alice = address(0xA11CE);
    address treasury = address(0x7EA5);

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDCCore();
        feed = new MockFeedCore(2500e8);
        registry = new ILPNRegistry(admin);
        oracle = new PricingOracle(admin);
        seniorVault = new SeniorVault(IERC20(address(usdc)), admin);
        juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), admin);
        core = new ILShieldCore(address(usdc), address(seniorVault), address(juniorVault), address(registry), address(oracle), treasury, admin);

        registry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        oracle.grantRole(KEEPER_ROLE, admin);
        core.grantRole(KEEPER_ROLE, admin);

        oracle.configurePool(POOL_ID, address(feed), address(0), 0.35e18, 3000, 1e18);

        // Seed vaults generously
        usdc.mint(admin, 100_000_000e6);
        usdc.approve(address(seniorVault), 50_000_000e6);
        seniorVault.deposit(50_000_000e6, admin);
        usdc.approve(address(juniorVault), 10_000_000e6);
        juniorVault.deposit(10_000_000e6, admin);

        // Fund alice
        usdc.mint(alice, 10_000_000e6);
    }

    // Position struct slot offsets within mapping (base slot = keccak256(abi.encode(id, 2)))
    // +0: poolId, +1: entrySqrtPriceX96|ticks, +2: liquidity|tier|blocks, +3: premiumBalance,
    // +4: premiumRatePerBlock, +5: lastPremiumBlock, +6: maxPayout, +7: settled|owner, +8: referrer

    function _baseSlot(uint256 id) internal pure returns (bytes32) {
        return keccak256(abi.encode(id, uint256(2)));
    }

    function _injectPosition(uint256 id, uint160 entry, int24 tl, int24 tu, uint128 liq) internal {
        bytes32 base = _baseSlot(id);
        uint256 packed1 = uint256(entry) | (uint256(uint24(tl)) << 160) | (uint256(uint24(tu)) << 184);
        vm.store(address(core), bytes32(uint256(base) + 1), bytes32(packed1));
        uint256 existing2 = uint256(vm.load(address(core), bytes32(uint256(base) + 2)));
        existing2 = (existing2 >> 128) << 128;
        existing2 |= uint256(liq);
        vm.store(address(core), bytes32(uint256(base) + 2), bytes32(existing2));
    }

    function _setMaxPayout(uint256 id, uint256 maxP) internal {
        vm.store(address(core), bytes32(uint256(_baseSlot(id)) + 6), bytes32(maxP));
    }

    /// @notice Convert IL from token1 to token0 (USDC) terms using sqrtPriceX96
    function _ilToUSDC(uint256 ilToken1, uint160 exitSqrt) internal pure returns (uint256) {
        uint256 Q96 = 2**96;
        return FullMath.mulDiv(FullMath.mulDiv(ilToken1, Q96, uint256(exitSqrt)), Q96, uint256(exitSqrt));
    }

    function _registerAs(address user, uint256 premium) internal returns (uint256) {
        vm.startPrank(user);
        usdc.approve(address(core), premium);
        uint256 id = core.register(1, 2, 216_000, premium, address(0));
        vm.stopPrank();
        return id;
    }

    // ═══ 1.1 Warming Period Ramp ═══

    function test_1_1a_warmingRamp_zeroBlocks_zeroPayout() public {
        core.setWarmingPeriodBlocks(100);
        core.setFullCoverageRampBlocks(1); // instant once warming done
        uint256 id = _registerAs(alice, 500e6);
        _injectPosition(id, 79228162514264337593543950336, -6000, 6000, 1e12);
        _setMaxPayout(id, type(uint256).max);

        // coverageStartBlock = registerBlock + 100. We're at registerBlock.
        // Cannot settle before coverageStartBlock — CoverageNotStarted
        vm.prank(alice);
        vm.expectRevert(ILShieldCore.CoverageNotStarted.selector);
        core.settle(id, 86787299046364038601618741436, "");
    }

    function test_1_1b_warmingRamp_atStart_zeroPayout() public {
        core.setWarmingPeriodBlocks(100);
        core.setFullCoverageRampBlocks(100);
        uint256 regBlock = block.number;
        uint256 id = _registerAs(alice, 500e6);
        _injectPosition(id, 79228162514264337593543950336, -6000, 6000, 1e12);
        _setMaxPayout(id, type(uint256).max);

        // Advance to exactly coverageStartBlock (regBlock + 100)
        vm.roll(regBlock + 100);
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, 86787299046364038601618741436, "");
        uint256 payout = usdc.balanceOf(alice) - bal;
        // elapsedBlocks = 0, effectiveCoverage = 0
        assertEq(payout, 0, "1.1b: Payout=0 at warming boundary");
    }

    function test_1_1c_warmingRamp_halfRamp_halfPayout() public {
        core.setWarmingPeriodBlocks(100);
        core.setFullCoverageRampBlocks(100);
        uint256 regBlock = block.number;
        uint256 id = _registerAs(alice, 500e6);
        _injectPosition(id, 79228162514264337593543950336, -6000, 6000, 1e12);
        _setMaxPayout(id, type(uint256).max);

        // Advance to midpoint of ramp: regBlock + 100 + 50
        vm.roll(regBlock + 150);
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, 86787299046364038601618741436, "");
        uint256 payout = usdc.balanceOf(alice) - bal;

        // Compute expected: IL (converted to USDC) * tier(100%) * ramp(50/100) * (1 - 2%)
        uint256 il = ILMath.computeIL(79228162514264337593543950336, 86787299046364038601618741436, -6000, 6000, 1e12);
        uint256 ilUSDC = _ilToUSDC(il, 86787299046364038601618741436);
        uint256 expected = ilUSDC * 5000 / 10000 * 9800 / 10000; // 50% ramp * 98%
        console.log("1.1c IL:", il);
        console.log("1.1c IL (USDC):", ilUSDC);
        console.log("1.1c Expected:", expected);
        console.log("1.1c Actual:", payout);
        assertApproxEqRel(payout, expected, 0.01e18, "1.1c: ~50% ramp payout");
    }

    function test_1_1d_warmingRamp_fullRamp_fullPayout() public {
        core.setWarmingPeriodBlocks(100);
        core.setFullCoverageRampBlocks(100);
        uint256 regBlock = block.number;
        uint256 id = _registerAs(alice, 500e6);
        _injectPosition(id, 79228162514264337593543950336, -6000, 6000, 1e12);
        _setMaxPayout(id, type(uint256).max);

        vm.roll(regBlock + 200 + 1); // past full ramp
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, 86787299046364038601618741436, "");
        uint256 payout = usdc.balanceOf(alice) - bal;

        uint256 il = ILMath.computeIL(79228162514264337593543950336, 86787299046364038601618741436, -6000, 6000, 1e12);
        uint256 ilUSDC = _ilToUSDC(il, 86787299046364038601618741436);
        uint256 expected = ilUSDC * 9800 / 10000; // 100% ramp * 98%
        console.log("1.1d Full payout:", payout, "Expected:", expected);
        assertApproxEqRel(payout, expected, 0.001e18, "1.1d: Full ramp payout");
    }

    // ═══ 1.6 Coverage Tiers ═══

    function test_1_6_coverageTiers_50_75_100_ratio() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        core.setSettlementFeeRate(200);

        uint160 entry = 79228162514264337593543950336;
        uint160 exit_ = 86787299046364038601618741436;

        // Register all 3 in sequence
        vm.startPrank(alice);
        usdc.approve(address(core), 5000e6);
        uint256 id0 = core.register(1, 0, 216_000, 500e6, address(0)); // 50%
        uint256 id1 = core.register(1, 1, 216_000, 500e6, address(0)); // 75%
        uint256 id2 = core.register(1, 2, 216_000, 500e6, address(0)); // 100%
        vm.stopPrank();

        // Inject same position data for all 3
        _injectPosition(id0, entry, -6000, 6000, 1e12);
        _injectPosition(id1, entry, -6000, 6000, 1e12);
        _injectPosition(id2, entry, -6000, 6000, 1e12);
        _setMaxPayout(id0, type(uint256).max);
        _setMaxPayout(id1, type(uint256).max);
        _setMaxPayout(id2, type(uint256).max);

        // Advance past ramp
        vm.roll(block.number + 10);

        // Settle all 3
        uint256 bal0 = usdc.balanceOf(alice);
        vm.prank(alice); core.settle(id0, exit_, "");
        uint256 payout0 = usdc.balanceOf(alice) - bal0;

        uint256 bal1 = usdc.balanceOf(alice);
        vm.prank(alice); core.settle(id1, exit_, "");
        uint256 payout1 = usdc.balanceOf(alice) - bal1;

        uint256 bal2 = usdc.balanceOf(alice);
        vm.prank(alice); core.settle(id2, exit_, "");
        uint256 payout2 = usdc.balanceOf(alice) - bal2;

        console.log("1.6 Tier0(50%):", payout0);
        console.log("1.6 Tier1(75%):", payout1);
        console.log("1.6 Tier2(100%):", payout2);

        assertGt(payout0, 0, "1.6: Tier0 payout > 0");
        assertGt(payout1, 0, "1.6: Tier1 payout > 0");
        assertGt(payout2, 0, "1.6: Tier2 payout > 0");
        // Ratio should be 50:75:100
        assertApproxEqRel(payout1 * 2, payout0 * 3, 0.01e18, "1.6: 75/50 ratio");
        assertApproxEqRel(payout2, payout0 * 2, 0.01e18, "1.6: 100/50 ratio");
    }

    // ═══ 1.7 Governance Parameter Change Mid-Lifecycle ═══

    function test_1_7_feeRateChange_usesCurrentRate() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        core.setSettlementFeeRate(200); // 2%

        uint256 id = _registerAs(alice, 500e6);
        _injectPosition(id, 79228162514264337593543950336, -6000, 6000, 1e12);
        _setMaxPayout(id, type(uint256).max);

        // Change fee to 5% AFTER registration
        core.setSettlementFeeRate(500);

        vm.roll(block.number + 10);
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, 86787299046364038601618741436, "");
        uint256 payout = usdc.balanceOf(alice) - bal;

        uint256 il = ILMath.computeIL(79228162514264337593543950336, 86787299046364038601618741436, -6000, 6000, 1e12);
        uint256 ilUSDC = _ilToUSDC(il, 86787299046364038601618741436);
        // DESIGN: settle uses current settlementFeeRate (500 bps = 5%), not registration-time
        uint256 expected5pct = ilUSDC * 9500 / 10000;
        console.log("1.7 Payout with 5% fee:", payout);
        console.log("1.7 Expected (5%):", expected5pct);
        assertApproxEqRel(payout, expected5pct, 0.01e18, "1.7: Uses current fee rate (5%)");
        console.log("1.7 DESIGN: settlementFeeRate is read at settle-time, not registration-time");
    }

    // ═══ 1.5 Settlement Fee Edge Cases ═══

    function test_1_5a_fee_on_1wei_payout() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        // We need IL that produces exactly 1 wei payout before fee
        // fee = 1 * 200 / 10000 = 0 (rounds down)
        // So LP receives 1 wei
        // Use vm.store to set a position that produces exactly 1 wei IL
        uint256 id = _registerAs(alice, 500e6);
        _setMaxPayout(id, 1e12); // cap at 1 USDC-wei in WAD (1 * 1e12)

        // Inject position with non-zero IL
        _injectPosition(id, 79228162514264337593543950336, -6000, 6000, 1e12);

        vm.roll(block.number + 10);
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, 86787299046364038601618741436, "");
        uint256 payout = usdc.balanceOf(alice) - bal;

        // maxPayout WAD=1e12, fee = 1e12 * 200/10000 = 2e10, net = 1e12 - 2e10 = 9.8e11
        // payout = 9.8e11 / 1e12 = 0 (rounds down in final conversion)
        // For 1 USDC-wei cap, the fee eats it. That's correct behavior.
        assertEq(payout, 0, "1.5a: 1 USDC-wei cap rounds to 0 after fee");
    }

    function test_1_5b_fee_on_50wei_payout() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        uint256 id = _registerAs(alice, 500e6);
        _setMaxPayout(id, 50e12); // cap at 50 USDC-wei in WAD
        _injectPosition(id, 79228162514264337593543950336, -6000, 6000, 1e12);

        vm.roll(block.number + 10);
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, 86787299046364038601618741436, "");
        uint256 payout = usdc.balanceOf(alice) - bal;

        // maxPayout WAD = 50e12, fee = 50e12 * 200/10000 = 1e12, net = 49e12
        // payout = 49e12 / 1e12 = 49
        assertEq(payout, 49, "1.5b: 50 USDC-wei cap - fee = 49");
    }

    // ═══ 4.3 Same-tx Register + Settle ═══

    function test_4_3_sameBlock_registerSettle() public {
        core.setWarmingPeriodBlocks(10);
        core.setFullCoverageRampBlocks(1);

        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        uint256 id = core.register(1, 2, 216_000, 500e6, address(0));

        // Settle same block — warming period means CoverageNotStarted
        vm.expectRevert(ILShieldCore.CoverageNotStarted.selector);
        core.settle(id, 79228162514264337593543950336, "");
        vm.stopPrank();
        console.log("4.3: Same-block settle reverts CoverageNotStarted (warming=10)");
    }

    // ═══ 4.4 Position ID Uniqueness ═══

    function test_4_4_positionId_uniqueness() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        uint256 id1 = _registerAs(alice, 100e6);
        uint256 id2 = _registerAs(alice, 100e6);
        assertTrue(id1 != id2, "4.4: IDs must be unique");
        assertEq(id2, id1 + 1, "4.4: IDs are sequential");

        // Settle first, second unaffected
        vm.roll(block.number + 10);
        vm.prank(alice);
        core.settle(id1, 79228162514264337593543950336, "");

        assertEq(registry.ownerOf(id2), alice, "4.4: Second position unaffected");
    }

    // ═══ Round 5: Branch Coverage ═══

    function test_R5_register_invalidCoverageTier() public {
        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert(ILShieldCore.InvalidCoverageTier.selector);
        core.register(1, 3, 216_000, 500e6, address(0)); // tier 3 invalid
        vm.stopPrank();
    }

    function test_R5_register_durationTooShort() public {
        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert(ILShieldCore.DurationTooShort.selector);
        core.register(1, 0, 100, 500e6, address(0)); // 100 blocks < minCoverageDuration
        vm.stopPrank();
    }

    function test_R5_register_zeroPremium() public {
        vm.startPrank(alice);
        vm.expectRevert(ILShieldCore.InsufficientPremium.selector);
        core.register(1, 0, 216_000, 0, address(0)); // 0 premium
        vm.stopPrank();
    }

    function test_R5_register_insufficientPremiumForRate() public {
        // Configure pool with high premium rate (high vol, zero expected volume)
        oracle.configurePool(bytes32(uint256(99)), address(feed), address(0), 0.70e18, 3000, 0);
        oracle.setCLevel(1e18);

        vm.startPrank(alice);
        usdc.approve(address(core), 1);
        // premiumRate will be > 0, so premiumDeposit < minPremium
        vm.expectRevert(ILShieldCore.InsufficientPremium.selector);
        core.register(99, 2, 216_000, 1, address(0)); // 1 wei < rate * duration
        vm.stopPrank();
    }

    function test_R5_topUpPremium_basic() public {
        uint256 id = _registerAs(alice, 500e6);

        // Top up
        usdc.mint(alice, 100e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 100e6);
        core.topUpPremium(id, 100e6);
        vm.stopPrank();

        (,,,,,,,,uint256 premBal,,,,,,) = core.positions(id);
                assertEq(premBal, (500e6 + 100e6) * 1e12, "R5: Premium balance should be 600 USDC in WAD");
    }

    function test_R5_topUpPremium_settledReverts() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        uint256 id = _registerAs(alice, 500e6);
        vm.roll(block.number + 10);
        vm.prank(alice);
        core.settle(id, 79228162514264337593543950336, ""); // settle with no IL

        // topUp after settlement
        usdc.mint(alice, 100e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 100e6);
        vm.expectRevert(ILShieldCore.PositionAlreadySettled.selector);
        core.topUpPremium(id, 100e6);
        vm.stopPrank();
    }

    function test_R5_cancelProtection_settledReverts() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        uint256 id = _registerAs(alice, 500e6);
        vm.roll(block.number + 10);
        vm.prank(alice);
        core.settle(id, 79228162514264337593543950336, "");

        vm.prank(alice);
        vm.expectRevert(ILShieldCore.PositionAlreadySettled.selector);
        core.cancelProtection(id);
    }

    function test_R5_cancelProtection_wrongOwner() public {
        uint256 id = _registerAs(alice, 500e6);

        vm.prank(address(0xBEEF));
        vm.expectRevert(ILShieldCore.NotILPNOwner.selector);
        core.cancelProtection(id);
    }

    function test_R5_cancelProtection_withPartialStream() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        // Configure pool for non-zero premium rate
        oracle.configurePool(bytes32(uint256(55)), address(feed), address(0), 0.50e18, 3000, 0);
        oracle.setCLevel(1e15);

        vm.startPrank(alice);
        usdc.approve(address(core), 5_000_000e6);
        uint256 id = core.register(55, 0, 50_400, 5_000_000e6, address(0));
        vm.stopPrank();

        // Advance some blocks so premium accrues
        vm.roll(block.number + 1000);

        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        core.cancelProtection(id);
        uint256 refund = usdc.balanceOf(alice) - balBefore;

        // Should get back less than deposited (some was streamed)
        assertGt(refund, 0, "R5: Should get a refund");
        assertLe(refund, 5_000_000e6, "R5: Refund <= deposit");
        console.log("R5 Cancel refund:", refund);
    }

    function test_R5_settle_juniorOverflowToSenior() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        uint160 entry = 79228162514264337593543950336;
        uint160 exit40pct = 94473795017117205112252740403;

        // Register with huge position to cause IL > junior balance
        uint256 id = _registerAs(alice, 500e6);
        _injectPosition(id, entry, -6000, 6000, 1e15); // very high liquidity
        _setMaxPayout(id, type(uint256).max);

        vm.roll(block.number + 10);

        uint256 juniorBefore = juniorVault.totalAssets();
        uint256 seniorBefore = seniorVault.totalAssets();
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, exit40pct, "");
        uint256 payout = usdc.balanceOf(alice) - bal;

        assertGt(payout, juniorBefore, "R5: Payout > junior balance (overflow to senior)");
        assertEq(juniorVault.totalAssets(), 0, "R5: Junior fully drained");
        assertLt(seniorVault.totalAssets(), seniorBefore, "R5: Senior drawn down");
        console.log("R5 Junior overflow: payout=", payout, "junior was=", juniorBefore);
    }

    function test_R5_processStreaming_sameBlock() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        uint256 id = _registerAs(alice, 500e6);

        // Process streaming same block as registration → blocksElapsed=0
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        core.processStreaming(ids); // should not revert, just skip
    }

    function test_R5_distributePremium_noReferrer() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        // Configure pool with non-zero premium — high cLevel for meaningful streaming
        oracle.configurePool(bytes32(uint256(88)), address(feed), address(0), 0.70e18, 3000, 0);
        oracle.setCLevel(1e18);

        // Register with NO referrer
        vm.startPrank(alice);
        usdc.approve(address(core), 5_000_000e6);
        uint256 id = core.register(88, 0, 50_400, 5_000_000e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 1_000_000);

        uint256 treasuryBefore = usdc.balanceOf(treasury);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        core.processStreaming(ids);
        uint256 treasuryAfter = usdc.balanceOf(treasury);

        // Treasury gets its 10% + the 5% referral share = 15%
        assertGt(treasuryAfter - treasuryBefore, 0, "R5: Treasury received premium + referral share");
        console.log("R5 Treasury (no referrer):", treasuryAfter - treasuryBefore);
    }

    function test_R5_setPremiumShares_invalidSum() public {
        vm.expectRevert(ILShieldCore.InvalidShares.selector);
        core.setPremiumShares(5000, 3000, 1000, 500); // sum = 9500 != 10000
    }

    function test_R5_setPremiumShares_valid() public {
        core.setPremiumShares(6000, 2000, 1500, 500); // sum = 10000
        assertEq(core.seniorShare(), 6000);
        assertEq(core.juniorShare(), 2000);
    }

    // ═══ 3.4 Referral Fee Accuracy ═══

    function test_3_4_referralFeeAccuracy() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        // Configure oracle for non-zero premium — high cLevel for meaningful streaming
        oracle.setCLevel(1e18);
        bytes32 refPool = bytes32(uint256(77));
        oracle.configurePool(refPool, address(feed), address(0), 0.70e18, 3000, 0);

        address ref1 = address(0xEF01);
        address ref2 = address(0xEF02);

        usdc.mint(alice, 100_000_000e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 100_000_000e6);
        uint256 id1 = core.register(77, 0, 50_400, 5_000_000e6, ref1);
        uint256 id2 = core.register(77, 0, 50_400, 5_000_000e6, ref2);
        vm.stopPrank();

        vm.roll(block.number + 1_000_000);
        uint256[] memory ids = new uint256[](2);
        ids[0] = id1; ids[1] = id2;
        core.processStreaming(ids);

        uint256 ref1Bal = usdc.balanceOf(ref1);
        uint256 ref2Bal = usdc.balanceOf(ref2);
        console.log("3.4 Referral 1 received:", ref1Bal);
        console.log("3.4 Referral 2 received:", ref2Bal);

        // Referral share is 500 bps = 5% of streamed premium
        // Both should receive equal amounts (same premium, same blocks)
        assertGt(ref1Bal, 0, "3.4: Referral 1 received payment");
        assertGt(ref2Bal, 0, "3.4: Referral 2 received payment");
        assertEq(ref1Bal, ref2Bal, "3.4: Equal referral payouts");
    }
}
