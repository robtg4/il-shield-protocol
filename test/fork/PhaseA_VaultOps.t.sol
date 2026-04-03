// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForkBase} from "./ForkBase.t.sol";

/// @title Phase A: Vault Operations (A01–A14)
contract PhaseA_VaultOps is ForkBase {

    // ── Senior Vault ──

    function test_A01_seniorVault_deposit() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(seniorVault), 10_000e6);
        uint256 shares = seniorVault.deposit(10_000e6, alice);
        vm.stopPrank();
        assertGt(shares, 0, "A01: Should receive shares");
        assertEq(mockUSDC.balanceOf(address(seniorVault)), 110_000e6, "A01: Vault balance increased");
    }

    function test_A02_seniorVault_previewMatchesActual() public {
        uint256 preview = seniorVault.previewDeposit(5_000e6);
        vm.startPrank(alice);
        mockUSDC.approve(address(seniorVault), 5_000e6);
        uint256 actual = seniorVault.deposit(5_000e6, alice);
        vm.stopPrank();
        assertEq(preview, actual, "A02: Preview must match actual shares");
    }

    function test_A03_seniorVault_prematureWithdrawal_reverts() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(seniorVault), 1_000e6);
        seniorVault.deposit(1_000e6, alice);
        vm.expectRevert();
        seniorVault.withdraw(500e6, alice, alice);
        vm.stopPrank();
    }

    function test_A04_seniorVault_withdrawalAfterLock() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(seniorVault), 1_000e6);
        seniorVault.deposit(1_000e6, alice);
        vm.stopPrank();

        vm.roll(block.number + 20); // past lock (10 blocks)
        vm.startPrank(alice);
        uint256 bal = mockUSDC.balanceOf(alice);
        seniorVault.withdraw(500e6, alice, alice);
        assertEq(mockUSDC.balanceOf(alice) - bal, 500e6, "A04: Should withdraw exact amount");
        vm.stopPrank();
    }

    function test_A05_seniorVault_emergencyWithdraw_penalty() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(seniorVault), 10_000e6);
        uint256 shares = seniorVault.deposit(10_000e6, alice);
        uint256 bal = mockUSDC.balanceOf(alice);
        seniorVault.emergencyWithdraw(shares, alice);
        uint256 received = mockUSDC.balanceOf(alice) - bal;
        vm.stopPrank();
        // 5% penalty: receive 9500
        assertApproxEqAbs(received, 9_500e6, 1e6, "A05: Emergency should deduct 5%");
    }

    function test_A06_seniorVault_receivePremium_increasesAssets() public {
        // receivePremium requires CORE_ROLE — use the core contract
        uint256 before = seniorVault.totalAssets();
        mockUSDC.mint(address(core), 1_000e6);
        vm.startPrank(address(core));
        mockUSDC.approve(address(seniorVault), 1_000e6);
        seniorVault.receivePremium(1_000e6);
        vm.stopPrank();
        assertEq(seniorVault.totalAssets(), before + 1_000e6, "A06: Premium increases totalAssets");
    }

    function test_A07_seniorVault_withdrawForClaim_accessControl() public {
        vm.prank(alice);
        vm.expectRevert();
        seniorVault.withdrawForClaim(1e6, alice);
    }

    // ── Junior Vault ──

    function test_A08_juniorVault_deposit() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(juniorVault), 5_000e6);
        uint256 shares = juniorVault.deposit(5_000e6, alice);
        vm.stopPrank();
        assertGt(shares, 0, "A08: Should receive shares");
    }

    function test_A09_juniorVault_prematureWithdrawal_reverts() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(juniorVault), 1_000e6);
        juniorVault.deposit(1_000e6, alice);
        vm.expectRevert();
        juniorVault.withdraw(500e6, alice, alice);
        vm.stopPrank();
    }

    function test_A10_juniorVault_withdrawalAfterLock() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(juniorVault), 5_000e6);
        juniorVault.deposit(5_000e6, alice);
        vm.stopPrank();

        vm.roll(block.number + 30); // past lock (20 blocks)
        vm.startPrank(alice);
        juniorVault.withdraw(1_000e6, alice, alice);
        vm.stopPrank();
    }

    function test_A11_juniorVault_sjRatio_blocks_withdrawal() public {
        // Create a state where S/J ratio is at limit (5:1)
        // Deposit 50k senior, 10k junior (fresh deposits by alice)
        vm.startPrank(alice);
        mockUSDC.approve(address(seniorVault), 50_000e6);
        seniorVault.deposit(50_000e6, alice);
        mockUSDC.approve(address(juniorVault), 10_000e6);
        juniorVault.deposit(10_000e6, alice);
        vm.stopPrank();

        vm.roll(block.number + 300_000); // past locks
        // Junior total = 35k, Senior total = 150k → ratio ~4.3:1
        // Withdrawing enough Junior to push past 5:1 should revert
        // 150k / (35k - 5001) = 5.0 → just over limit
        vm.prank(alice);
        vm.expectRevert();
        juniorVault.withdraw(5_001e6, alice, alice);
    }

    function test_A12_juniorVault_withdrawForClaim_partial() public {
        // withdrawForClaim requires CORE_ROLE
        vm.startPrank(address(core));
        uint256 juniorBal = juniorVault.totalAssets();
        juniorVault.withdrawForClaim(juniorBal + 1_000e6, address(core));
        vm.stopPrank();
        assertEq(juniorVault.totalAssets(), 0, "A12: Junior should be drained");
    }

    function test_A13_juniorVault_receivePremium() public {
        uint256 before = juniorVault.totalAssets();
        mockUSDC.mint(address(core), 500e6);
        vm.startPrank(address(core));
        mockUSDC.approve(address(juniorVault), 500e6);
        juniorVault.receivePremium(500e6);
        vm.stopPrank();
        assertEq(juniorVault.totalAssets(), before + 500e6, "A13: Premium increases Junior");
    }

    function test_A14_chainlinkFeed_isLive() public view {
        int256 price = _getChainlinkPrice();
        assertGt(price, 0, "A14: Chainlink must return positive price");
        // ETH should be between $500 and $10000
        assertGt(price, 500e8, "A14: ETH too cheap");
        assertLt(price, 10_000e8, "A14: ETH too expensive");
    }
}
