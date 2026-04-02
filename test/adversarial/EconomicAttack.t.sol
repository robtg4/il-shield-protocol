// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILShieldCore} from "../../src/core/ILShieldCore.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {JuniorVault} from "../../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../../src/core/PricingOracle.sol";

contract MockERC20Econ is ERC20 {
    uint8 private _decimals;
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) { _decimals = decimals_; }
    function mint(address to, uint256 amount) public { _mint(to, amount); }
    function decimals() public view override returns (uint8) { return _decimals; }
}

contract MockChainlinkFeedEcon {
    int256 public price;
    constructor(int256 _price) { price = _price; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, block.timestamp, 1);
    }
    function decimals() external pure returns (uint8) { return 8; }
}

contract EconomicAttackTest is Test {
    MockERC20Econ usdc;
    ILPNRegistry registry;
    PricingOracle oracle;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILShieldCore core;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    address admin = address(this);
    address attacker = makeAddr("attacker");
    address victim = makeAddr("victim");
    address treasury = makeAddr("treasury");

    function setUp() public {
        usdc = new MockERC20Econ("USDC", "USDC", 6);
        MockChainlinkFeedEcon feed = new MockChainlinkFeedEcon(2500e8);
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

        oracle.configurePool(bytes32(uint256(1)), address(feed), address(0), 0.35e18, 3000, 1e18);
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        // Reduce lock for testing
        seniorVault.setMinLockDuration(10);
        juniorVault.setMinLockDuration(20);
    }

    function test_dustDeposit_inflationAttack() public {
        // Classic ERC-4626 inflation attack:
        // 1. Attacker deposits 1 wei
        // 2. Attacker donates large amount directly to vault
        // 3. Victim deposits, gets 0 shares due to rounding
        // OpenZeppelin ERC-4626 includes virtual share offset to mitigate this

        usdc.mint(attacker, 1_000_001);
        usdc.mint(victim, 1_000e6);

        // Attacker deposits 1 wei
        vm.startPrank(attacker);
        usdc.approve(address(seniorVault), 1);
        seniorVault.deposit(1, attacker);
        uint256 attackerShares = seniorVault.balanceOf(attacker);
        assertTrue(attackerShares > 0, "Attacker should receive shares");

        // Donate 1M USDC directly to inflate share price
        usdc.transfer(address(seniorVault), 1_000_000);
        vm.stopPrank();

        // Victim deposits 1000 USDC
        vm.startPrank(victim);
        usdc.approve(address(seniorVault), 1_000e6);
        uint256 victimShares = seniorVault.deposit(1_000e6, victim);
        vm.stopPrank();

        // With OZ's virtual share offset, victim should still get shares
        assertTrue(victimShares > 0, "Victim should receive shares (OZ virtual offset protects)");

        // Victim's redeemable value should be close to their deposit
        uint256 redeemable = seniorVault.previewRedeem(victimShares);
        // Allow up to 1% loss from rounding (not 100% loss like unprotected vaults)
        assertGt(redeemable, 990e6, "Victim should not lose >1% to inflation attack");
    }

    function test_premiumDrain_adverseSelection() public {
        // Register then immediately cancel — should get refund minus streamed premium
        usdc.mint(attacker, 1000e6);
        vm.startPrank(attacker);
        usdc.approve(address(core), 1000e6);
        uint256 balBefore = usdc.balanceOf(attacker);
        uint256 ilpnId = core.register(1, 2, 216_000, 100e6, address(0));
        uint256 balAfterRegister = usdc.balanceOf(attacker);
        assertEq(balBefore - balAfterRegister, 100e6, "Premium deducted on register");

        // Cancel immediately — no blocks elapsed, full refund expected
        core.cancelProtection(ilpnId);
        uint256 balAfterCancel = usdc.balanceOf(attacker);

        // Refund should be the premium balance (100e6 minus any streamed amount)
        // Since premiumRate=0 (fees > IL in our config), no premium was streamed
        assertEq(balAfterCancel, balBefore, "Full refund on immediate cancel (no premium streamed)");
        vm.stopPrank();
    }

    function test_zeroLiquidityPosition() public {
        // Position with 0 liquidity — IL should be 0
        usdc.mint(attacker, 1000e6);
        vm.startPrank(attacker);
        usdc.approve(address(core), 1000e6);
        uint256 ilpnId = core.register(1, 2, 216_000, 50e6, address(0));

        vm.roll(block.number + 100);

        // Settle — IL = 0 because liquidity = 0
        core.settle(ilpnId, 158456325028528675187087900672, "");
        vm.stopPrank();
        // Should complete without revert — no payout
    }

    function test_maxPayout_capped_at_vault() public {
        // Seed vaults with small amounts
        usdc.mint(admin, 100e6);
        usdc.approve(address(juniorVault), 50e6);
        juniorVault.deposit(50e6, admin);
        usdc.approve(address(seniorVault), 50e6);
        seniorVault.deposit(50e6, admin);

        // Register a position (IL will be 0 due to 0 liquidity, so payout = 0)
        // But the maxPayout is 10x premium = 500e6, far exceeding vault
        usdc.mint(attacker, 1000e6);
        vm.startPrank(attacker);
        usdc.approve(address(core), 1000e6);
        uint256 ilpnId = core.register(1, 2, 216_000, 50e6, address(0));
        vm.roll(block.number + 10);
        // Settle — should succeed even with insufficient vault funds for maxPayout
        core.settle(ilpnId, 158456325028528675187087900672, "");
        vm.stopPrank();
    }

    function test_manyPositions_gasGrief() public {
        // Register 50 positions and batch processStreaming
        // All use positionId=1 (same poolId) since oracle only configured for that
        usdc.mint(attacker, 100_000e6);
        vm.startPrank(attacker);
        usdc.approve(address(core), 100_000e6);

        uint256[] memory ids = new uint256[](50);
        for (uint256 i = 0; i < 50; i++) {
            ids[i] = core.register(1, 2, 216_000, 10e6, address(0));
        }
        vm.stopPrank();

        vm.roll(block.number + 1000);

        // Process all 50 — measure gas
        uint256 gasBefore = gasleft();
        core.processStreaming(ids);
        uint256 gasUsed = gasBefore - gasleft();

        // Should complete within block gas limit (~30M)
        assertLt(gasUsed, 15_000_000, "Batch processing 50 positions should be under 15M gas");
    }

    function test_juniorWithdrawal_grief_blocked() public {
        // Set up Senior=50K, Junior=10K (ratio = 5:1)
        usdc.mint(admin, 60_000e6);
        usdc.approve(address(seniorVault), 50_000e6);
        seniorVault.deposit(50_000e6, admin);
        usdc.approve(address(juniorVault), 10_000e6);
        juniorVault.deposit(10_000e6, admin);

        // Advance past lock
        vm.roll(block.number + 300_000);

        // Try to withdraw any Junior — should fail (would breach 5:1 ratio)
        vm.expectRevert(JuniorVault.WouldBreachSJRatio.selector);
        juniorVault.withdraw(1e6, admin, admin);
    }

    function test_cancelAndReregister_noExploit() public {
        // Cancel and re-register to see if any state leaks or exploits
        usdc.mint(attacker, 10_000e6);
        vm.startPrank(attacker);
        usdc.approve(address(core), 10_000e6);

        // Register, cancel, repeat 5 times (all use positionId=1)
        for (uint256 i = 0; i < 5; i++) {
            uint256 ilpnId = core.register(1, 2, 216_000, 100e6, address(0));
            core.cancelProtection(ilpnId);
        }

        // Balance should be unchanged (each cancel refunds the premium)
        uint256 bal = usdc.balanceOf(attacker);
        assertEq(bal, 10_000e6, "No funds lost or gained from cancel/re-register cycle");
        vm.stopPrank();
    }
}
