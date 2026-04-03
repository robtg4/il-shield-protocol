// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForkBase} from "./ForkBase.t.sol";

/// @title Phase C: Full Lifecycle (C01–C08)
contract PhaseC_Lifecycle is ForkBase {

    function test_C01_register_mintsILPN() public {
        uint256 ilpnId = _registerAs(alice, 500e6);
        assertEq(ilpnRegistry.ownerOf(ilpnId), alice, "C01: ILPN minted to alice");
    }

    function test_C02_register_deductsUSDC() public {
        uint256 before = mockUSDC.balanceOf(alice);
        _registerAs(alice, 500e6);
        assertEq(before - mockUSDC.balanceOf(alice), 500e6, "C02: Premium deducted");
    }

    function test_C03_processStreaming() public {
        uint256 ilpnId = _registerAs(alice, 500e6);
        vm.roll(block.number + 1000);
        uint256[] memory ids = new uint256[](1);
        ids[0] = ilpnId;
        core.processStreaming(ids);
        // With premiumRate=0 (fees>IL), balance unchanged but call succeeds
    }

    function test_C04_settle_withLiveChainlink() public {
        uint256 ilpnId = _registerAs(alice, 500e6);
        vm.roll(block.number + 10);

        // Settle — calls live Chainlink for price verification
        vm.prank(alice);
        core.settle(ilpnId, 79228162514264337593543950336, "");

        // ILPN burned
        vm.expectRevert();
        ilpnRegistry.ownerOf(ilpnId);
    }

    function test_C05_chainlink_price_crosscheck() public view {
        int256 price = _getChainlinkPrice();
        uint160 sqrtPrice = oracle.getChainlinkSqrtPriceX96(POOL_ID);
        assertGt(price, 0, "C05: Chainlink live");
        assertGt(sqrtPrice, 0, "C05: Oracle converts to sqrtPriceX96");
    }

    function test_C06_topUpPremium() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 200e6);
        core.topUpPremium(ilpnId, 200e6);
        vm.stopPrank();
    }

    function test_C07_cancelProtection_refund() public {
        uint256 before = mockUSDC.balanceOf(alice);
        uint256 ilpnId = _registerAs(alice, 500e6);
        vm.prank(alice);
        core.cancelProtection(ilpnId);
        uint256 after_ = mockUSDC.balanceOf(alice);
        // With premiumRate=0, full refund
        assertEq(after_, before, "C07: Full refund on cancel");
    }

    function test_C08_multiplePositions_lifecycle() public {
        // Register 3 positions
        uint256 id1 = _registerAs(alice, 100e6);
        uint256 id2 = _registerAs(alice, 200e6);
        uint256 id3 = _registerAs(bob, 300e6);

        vm.roll(block.number + 100);

        // Batch stream
        uint256[] memory ids = new uint256[](3);
        ids[0] = id1; ids[1] = id2; ids[2] = id3;
        core.processStreaming(ids);

        // Settle one, cancel one, leave one active
        vm.prank(alice);
        core.settle(id1, 79228162514264337593543950336, "");

        vm.prank(alice);
        core.cancelProtection(id2);

        // id3 still active
        assertEq(ilpnRegistry.ownerOf(id3), bob, "C08: Bob's position still active");
    }
}
