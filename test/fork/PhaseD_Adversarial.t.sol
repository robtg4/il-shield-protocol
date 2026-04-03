// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForkBase, console} from "./ForkBase.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";

/// @title Phase D: Adversarial Tests (D01–D12)
contract PhaseD_Adversarial is ForkBase {

    function test_D01_doubleSettle_reverts() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.roll(block.number + 10);
        vm.startPrank(alice);
        core.settle(ilpnId, 79228162514264337593543950336, "");
        vm.expectRevert();
        core.settle(ilpnId, 79228162514264337593543950336, "");
        vm.stopPrank();
    }

    function test_D02_nonOwner_settle_reverts() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.roll(block.number + 10);
        vm.prank(bob);
        vm.expectRevert();
        core.settle(ilpnId, 79228162514264337593543950336, "");
    }

    function test_D03_cancelThenSettle_reverts() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.startPrank(alice);
        core.cancelProtection(ilpnId);
        vm.expectRevert();
        core.settle(ilpnId, 79228162514264337593543950336, "");
        vm.stopPrank();
    }

    function test_D04_staleOracle_reverts() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.roll(block.number + 10);
        vm.warp(block.timestamp + 3601); // Make Chainlink stale
        vm.prank(alice);
        vm.expectRevert();
        core.settle(ilpnId, 79228162514264337593543950336, "");
    }

    function test_D05_flashloan_sameBlock_zeroPayout() public {
        // Register and settle in same block — warming period gives 0 coverage
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 100e6);
        uint256 ilpnId = core.register(1, 2, 216_000, 100e6, address(0));
        uint256 bal = mockUSDC.balanceOf(alice);
        core.settle(ilpnId, 158456325028528675187087900672, "");
        assertEq(mockUSDC.balanceOf(alice), bal, "D05: Zero payout in same block");
        vm.stopPrank();
    }

    function test_D06_cancelReregister_noProfit() public {
        uint256 before = mockUSDC.balanceOf(alice);
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 1_000_000e6);
        for (uint256 i = 0; i < 10; i++) {
            uint256 id = core.register(1, 2, 216_000, 100e6, address(0));
            core.cancelProtection(id);
        }
        vm.stopPrank();
        assertEq(mockUSDC.balanceOf(alice), before, "D06: No profit from cancel cycle");
    }

    function test_D07_accessControl_governanceParams() public {
        vm.startPrank(alice);
        vm.expectRevert(); core.setWarmingPeriodBlocks(0);
        vm.expectRevert(); core.setSettlementFeeRate(0);
        vm.expectRevert(); core.setTreasury(alice);
        vm.expectRevert(); core.pause();
        vm.stopPrank();
    }

    function test_D08_drainJunior_sequentialClaims() public {
        // Register 5 positions
        uint256[] memory ids = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            ids[i] = _registerAs(alice, 100e6);
        }

        vm.roll(block.number + 10);

        // Settle all — IL=0 (no real liquidity), but mechanism tested
        uint256 juniorBefore = juniorVault.totalAssets();
        for (uint256 i = 0; i < 5; i++) {
            vm.prank(alice);
            core.settle(ids[i], 79228162514264337593543950336, "");
        }
        uint256 juniorAfter = juniorVault.totalAssets();
        // No IL, so Junior unchanged
        assertEq(juniorAfter, juniorBefore, "D08: Junior unchanged (no IL)");
    }

    function test_D09_selfGrantRole_fails() public {
        bytes32 adminRole = 0x00;
        vm.startPrank(alice);
        vm.expectRevert();
        core.grantRole(CORE_ROLE, alice);
        vm.expectRevert();
        seniorVault.grantRole(CORE_ROLE, alice);
        vm.expectRevert();
        ilpnRegistry.grantRole(CORE_ROLE, alice);
        vm.stopPrank();
    }

    function test_D10_oracleManipulation_nonKeeper() public {
        vm.startPrank(alice);
        vm.expectRevert();
        oracle.updateVolatility(POOL_ID, 1e18, 1e18);
        vm.expectRevert();
        oracle.updateTWAP(POOL_ID, 79228162514264337593543950336);
        vm.stopPrank();
    }

    function test_D11_vaultInflation_attack_defended() public {
        // ERC-4626 inflation attack — now defended by _decimalsOffset() = 6
        address attacker = address(0xBAD);
        address victim = address(0xF00D);
        mockUSDC.mint(attacker, 2_000_000e6);
        mockUSDC.mint(victim, 1_000e6);

        // Fresh vault — even with no pre-seeding, _decimalsOffset protects
        SeniorVault freshVault = new SeniorVault(IERC20(address(mockUSDC)), address(this));

        vm.startPrank(attacker);
        mockUSDC.approve(address(freshVault), 1);
        freshVault.deposit(1, attacker);
        mockUSDC.transfer(address(freshVault), 1_000_000e6); // donate 1M
        vm.stopPrank();

        vm.startPrank(victim);
        mockUSDC.approve(address(freshVault), 1_000e6);
        uint256 shares = freshVault.deposit(1_000e6, victim);
        vm.stopPrank();

        // With _decimalsOffset=6, victim MUST get shares
        assertTrue(shares > 0, "D11: Victim must get shares (decimalsOffset=6 protects)");

        uint256 redeemable = freshVault.previewRedeem(shares);
        console.log("D11 Victim shares:", shares);
        console.log("D11 Victim redeemable:", redeemable);
        // Victim should lose <1% to rounding
        assertGt(redeemable, 990e6, "D11: Victim must not lose >1%");
    }

    function test_D12_batchStreaming_gasLimit() public {
        // Register 50 positions
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 5_000_000e6);
        uint256[] memory ids = new uint256[](50);
        for (uint256 i = 0; i < 50; i++) {
            ids[i] = core.register(1, 2, 216_000, 10e6, address(0));
        }
        vm.stopPrank();

        vm.roll(block.number + 1000);

        uint256 g = gasleft();
        core.processStreaming(ids);
        uint256 gasUsed = g - gasleft();
        assertLt(gasUsed, 15_000_000, "D12: 50-position batch under 15M gas");
    }
}
