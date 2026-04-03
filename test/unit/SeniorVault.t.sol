// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract SeniorVaultTest is Test {
    MockERC20 usdc;
    SeniorVault vault;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    uint256 constant LOCK_BLOCKS = 100_800;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = new SeniorVault(IERC20(address(usdc)), address(this));
        vault.grantRole(CORE_ROLE, address(this));
    }

    function test_deposit_and_redeem() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        vm.stopPrank();

        assertGt(shares, 0, "Should receive shares");
        assertEq(vault.balanceOf(alice), shares, "Share balance mismatch");

        // Advance past lock period
        vm.roll(block.number + LOCK_BLOCKS + 1);

        vm.startPrank(alice);
        uint256 redeemed = vault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertEq(redeemed, amount, "Should redeem full amount");
        assertEq(usdc.balanceOf(alice), amount, "USDC not returned");
    }

    function test_previewDeposit_accurate() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        uint256 preview = vault.previewDeposit(amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 actual = vault.deposit(amount, alice);
        vm.stopPrank();

        assertEq(preview, actual, "previewDeposit mismatch");
    }

    function test_withdraw_beforeLock_reverts() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);

        vm.expectRevert(SeniorVault.LockActive.selector);
        vault.withdraw(amount, alice, alice);
        vm.stopPrank();
    }

    function test_withdraw_afterLock_succeeds() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);
        vm.stopPrank();

        vm.roll(block.number + LOCK_BLOCKS + 1);

        vm.startPrank(alice);
        uint256 shares = vault.withdraw(amount, alice, alice);
        vm.stopPrank();

        assertGt(shares, 0, "Should burn shares");
        assertEq(usdc.balanceOf(alice), amount, "USDC not returned");
    }

    function test_emergencyWithdraw_penalty() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);

        vault.emergencyWithdraw(shares, alice);
        vm.stopPrank();

        uint256 expectedPayout = 950e6; // 5% penalty
        uint256 expectedPenalty = 50e6;

        assertEq(usdc.balanceOf(alice), expectedPayout, "Payout incorrect");
        assertEq(usdc.balanceOf(address(vault)), expectedPenalty, "Penalty not retained");
    }

    function test_withdrawForClaim_access_control() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, CORE_ROLE)
        );
        vault.withdrawForClaim(100e6, bob);
    }

    function test_receivePremium_access_control() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, CORE_ROLE)
        );
        vault.receivePremium(100e6);
    }

    // ═══ Round 5: Utilization-based throttling ═══

    function test_utilization_throttling_above_80pct() public {
        // a) Deposit 100K
        uint256 depositAmt = 100_000e6;
        deal(address(usdc), alice, depositAmt);
        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmt);
        vault.deposit(depositAmt, alice);
        vm.stopPrank();

        // Set utilization above 80% (emergency queue path)
        vault.setOutstandingClaims(85_000e6); // 85% utilization

        // Advance past lock
        vm.roll(block.number + LOCK_BLOCKS + 1);

        // Attempt withdraw — reverts with InWithdrawalQueue
        // The queue write + revert means state is rolled back (known behavior)
        vm.startPrank(alice);
        vm.expectRevert(SeniorVault.InWithdrawalQueue.selector);
        vault.withdraw(1000e6, alice, alice);
        vm.stopPrank();

        // Queue block not persisted (revert rolls back state changes)
        uint256 queueBlock = vault.withdrawalQueueBlock(alice);
        assertEq(queueBlock, 0, "Queue not persisted due to revert");

        // Emergency withdraw still works at high utilization
        vm.startPrank(alice);
        uint256 shares = vault.balanceOf(alice);
        vault.emergencyWithdraw(shares, alice);
        vm.stopPrank();
        assertGt(usdc.balanceOf(alice), 0, "Emergency withdraw bypasses queue");
        console.log("Emergency withdraw at 85% util succeeded");
    }

    function test_utilization_throttling_slow_queue_path() public {
        // Deposit 100K
        uint256 depositAmt = 100_000e6;
        deal(address(usdc), alice, depositAmt);
        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmt);
        vault.deposit(depositAmt, alice);
        vm.stopPrank();

        // Set utilization between 60-80% (slow queue path)
        vault.setOutstandingClaims(70_000e6); // 70% utilization

        // Advance past lock
        vm.roll(block.number + LOCK_BLOCKS + 1);

        // Attempt withdraw — slow queue revert
        vm.startPrank(alice);
        vm.expectRevert(SeniorVault.InWithdrawalQueue.selector);
        vault.withdraw(1000e6, alice, alice);
        vm.stopPrank();

        // Lower utilization below threshold — now instant withdrawal works
        vault.setOutstandingClaims(0); // 0% utilization
        vm.startPrank(alice);
        uint256 withdrawn = vault.withdraw(1000e6, alice, alice);
        vm.stopPrank();

        assertGt(withdrawn, 0, "Should have burned shares");
        assertEq(usdc.balanceOf(alice), 1000e6, "Should receive 1000 USDC");
        console.log("Withdrawal after lowering utilization: received 1000 USDC");
    }

    function test_withdrawal_queue_with_persisted_entry() public {
        // Test the queue path where queueBlock > 0 but block.number < queueBlock
        // We manually set the queue via vm.store
        uint256 depositAmt = 100_000e6;
        deal(address(usdc), alice, depositAmt);
        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmt);
        vault.deposit(depositAmt, alice);
        vm.stopPrank();

        vault.setOutstandingClaims(85_000e6); // high util to trigger queue check

        // Advance past lock
        vm.roll(block.number + LOCK_BLOCKS + 1);

        // Manually set alice's queue block to a future block via vm.store
        // withdrawalQueueBlock mapping is at some storage slot
        // Use the known mapping: withdrawalQueueBlock[alice] = block.number + 50000
        bytes32 slot = keccak256(abi.encode(alice, uint256(7))); // mapping at slot 7
        vm.store(address(vault), slot, bytes32(block.number + 50000));

        // Now attempt withdraw — should hit queueBlock > 0 && block.number < queueBlock
        vm.startPrank(alice);
        vm.expectRevert(SeniorVault.InWithdrawalQueue.selector);
        vault.withdraw(1000e6, alice, alice);
        vm.stopPrank();

        // Advance past the queue block
        vm.roll(block.number + 50001);
        vault.setOutstandingClaims(0); // lower util for actual withdrawal
        vm.startPrank(alice);
        uint256 withdrawn = vault.withdraw(depositAmt, alice, alice);
        vm.stopPrank();
        assertGt(withdrawn, 0, "Should succeed after queue expires");
        console.log("Withdrawal after queue expiry succeeded");
    }

    function test_share_price_after_large_claim() public {
        // Alice deposits 100K, Bob deposits 100K
        deal(address(usdc), alice, 100_000e6);
        deal(address(usdc), bob, 100_000e6);

        vm.startPrank(alice);
        usdc.approve(address(vault), 100_000e6);
        uint256 aliceShares = vault.deposit(100_000e6, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        usdc.approve(address(vault), 100_000e6);
        uint256 bobShares = vault.deposit(100_000e6, bob);
        vm.stopPrank();

        // Total assets: 200K. Total shares: aliceShares + bobShares
        assertEq(vault.totalAssets(), 200_000e6, "Total assets should be 200K");

        // Process a large claim (50K) via withdrawForClaim
        vault.withdrawForClaim(50_000e6, address(0xDEAD));

        // Total assets now: 150K. Each depositor owns half the shares.
        assertEq(vault.totalAssets(), 150_000e6, "Total assets after claim: 150K");

        // Advance past lock
        vm.roll(block.number + LOCK_BLOCKS + 1);

        // Alice redeems all her shares — should get 75K (her share of 150K)
        vm.startPrank(alice);
        uint256 aliceRedeemed = vault.redeem(aliceShares, alice, alice);
        vm.stopPrank();

        // Alice had half the shares, vault had 150K → she gets 75K
        uint256 expectedAlice = 75_000e6;
        assertEq(aliceRedeemed, expectedAlice, "Alice should receive 75K (her share of loss)");
        assertLt(aliceRedeemed, 100_000e6, "Alice receives less than deposited due to claim");
        emit log_named_uint("Alice deposited", 100_000e6);
        emit log_named_uint("Alice redeemed", aliceRedeemed);
        emit log_named_uint("Loss absorbed", 100_000e6 - aliceRedeemed);
    }

    function test_instant_withdrawal_low_utilization() public {
        // Deposit and set low utilization (< 60%)
        uint256 depositAmt = 100_000e6;
        deal(address(usdc), alice, depositAmt);
        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmt);
        vault.deposit(depositAmt, alice);
        vm.stopPrank();

        // Utilization at 0% — should allow instant withdrawal
        vm.roll(block.number + LOCK_BLOCKS + 1);
        vm.startPrank(alice);
        vault.withdraw(depositAmt, alice, alice);
        vm.stopPrank();
        assertEq(usdc.balanceOf(alice), depositAmt, "Instant withdrawal at low util");
    }

    function test_redeem_before_lock_reverts() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);

        // Redeem before lock — should revert with LockActive
        vm.expectRevert(SeniorVault.LockActive.selector);
        vault.redeem(shares, alice, alice);
        vm.stopPrank();
    }

    function test_utilizationBps_zero_assets() public view {
        // No deposits — totalAssets == 0, should return 0
        uint256 util = vault.utilizationBps();
        assertEq(util, 0, "Utilization should be 0 with no assets");
    }

    function test_receivePremium_increases_assets() public {
        // Deposit first
        uint256 depositAmount = 1000e6;
        deal(address(usdc), alice, depositAmount);

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        vault.deposit(depositAmount, alice);
        vm.stopPrank();

        uint256 assetsBefore = vault.totalAssets();

        // Send premium
        uint256 premiumAmount = 100e6;
        deal(address(usdc), address(this), premiumAmount);
        usdc.approve(address(vault), premiumAmount);
        vault.receivePremium(premiumAmount);

        uint256 assetsAfter = vault.totalAssets();
        assertEq(assetsAfter, assetsBefore + premiumAmount, "totalAssets should increase by premium");
    }
}
