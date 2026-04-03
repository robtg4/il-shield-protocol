// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForkBase, console} from "./ForkBase.t.sol";
import {ILMath} from "../../src/libraries/ILMath.sol";

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

    function test_C09_settle_withNonZeroIL() public {
        // Entry at 1:1 (sqrtPrice = 2^96)
        uint160 entrySqrt = 79228162514264337593543950336;
        // Exit at 20% price increase: sqrt(1.2) * 2^96 ≈ 86,787,299,046,364,038,601,618,741,436
        uint160 exitSqrt = 86787299046364038601618741436;
        int24 tickLower = -6000;
        int24 tickUpper = 6000;
        uint128 liquidity = 1e18;

        // Register with real position parameters
        uint256 ilpnId = _registerWithPosition(alice, 500e6, entrySqrt, tickLower, tickUpper, liquidity);

        vm.roll(block.number + 10);

        // Compute expected IL
        uint256 expectedIL = ILMath.computeIL(entrySqrt, exitSqrt, tickLower, tickUpper, liquidity);
        assertGt(expectedIL, 0, "C09: IL must be non-zero for 20% price move");

        // Expected payout: min(IL * coverage, maxPayout) * (1 - 2% fee)
        // maxPayout = premium * 10 = 5000e6
        uint256 maxPayout = 500e6 * 10;
        uint256 coveredIL = expectedIL; // 100% tier
        uint256 cappedIL = coveredIL > maxPayout ? maxPayout : coveredIL;
        uint256 expectedPayout = cappedIL * 9800 / 10000; // 2% settlement fee

        // Settle
        uint256 balBefore = mockUSDC.balanceOf(alice);
        vm.prank(alice);
        core.settle(ilpnId, exitSqrt, "");
        uint256 actualPayout = mockUSDC.balanceOf(alice) - balBefore;

        console.log("C09 Computed IL:", expectedIL);
        console.log("C09 MaxPayout cap:", maxPayout);
        console.log("C09 Expected payout (after cap + fee):", expectedPayout);
        console.log("C09 Actual payout:", actualPayout);

        assertGt(actualPayout, 0, "C09: Payout must be >0");
        // 0.1% tolerance
        assertApproxEqRel(actualPayout, expectedPayout, 0.001e18, "C09: Payout matches expected within 0.1%");
    }
}
