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

    function test_C10_settle_uncappedIL() public {
        // Gap 1: Test IL math end-to-end without maxPayout cap interfering
        // Use smaller liquidity so IL fits within vault funds
        uint160 entrySqrt = 79228162514264337593543950336; // 1:1
        uint160 exitSqrt = 86787299046364038601618741436;  // +20%
        int24 tickLower = -6000;
        int24 tickUpper = 6000;
        uint128 liquidity = 1e12; // small liquidity so IL ~ few thousand USDC

        // Seed more into junior to cover payout
        mockUSDC.mint(address(this), 1_000_000e6);
        mockUSDC.approve(address(juniorVault), 1_000_000e6);
        juniorVault.deposit(1_000_000e6, address(this));

        uint256 ilpnId = _registerWithPosition(alice, 500e6, entrySqrt, tickLower, tickUpper, liquidity);

        // Override maxPayout to type(uint256).max via vm.store so cap never hits
        // maxPayout is at struct offset +6 (slot baseSlot + 6)
        bytes32 baseSlot = keccak256(abi.encode(uint256(ilpnId), uint256(2)));
        vm.store(address(core), bytes32(uint256(baseSlot) + 6), bytes32(type(uint256).max));

        vm.roll(block.number + 10);

        // Compute expected: IL * 100% coverage * (1 - 2% fee)
        uint256 expectedIL = ILMath.computeIL(entrySqrt, exitSqrt, tickLower, tickUpper, liquidity);
        // Coverage tier 100%, warming ramp complete (10 blocks > fullCoverageRampBlocks=1)
        // settlementFeeRate = 200 bps = 2%
        // payout = IL * 10000/10000 * (10000 - 200) / 10000
        // But _computePayout applies fee on the capped amount: payout = coveredIL - fee
        // fee = coveredIL * 200 / 10000, payout = coveredIL * 9800 / 10000
        uint256 expectedPayout = expectedIL * 9800 / 10000;

        uint256 balBefore = mockUSDC.balanceOf(alice);
        vm.prank(alice);
        core.settle(ilpnId, exitSqrt, "");
        uint256 actualPayout = mockUSDC.balanceOf(alice) - balBefore;

        console.log("C10 Expected IL:", expectedIL);
        console.log("C10 Expected payout (uncapped):", expectedPayout);
        console.log("C10 Actual payout:", actualPayout);

        assertGt(actualPayout, 0, "C10: Payout must be >0");
        assertGt(actualPayout, 5000e6, "C10: Payout must exceed old cap ($5000)");
        // 0.1% tolerance
        assertApproxEqRel(actualPayout, expectedPayout, 0.001e18, "C10: Uncapped payout matches IL math");
    }

    function test_C11_registerFromRealV4Position() public {
        // Gap 2: Document that register() does NOT read from PositionManager
        //
        // DESIGN FINDING: ILShieldCore.register() accepts a positionId but uses it
        // only as bytes32(positionId) for the poolId lookup. It does NOT call
        // PositionManager.getPoolAndPositionInfo() to read the actual position's
        // entry price, tick range, or liquidity. These are stored as zeros.
        //
        // This is a known design gap: the current implementation stores
        // entrySqrtPriceX96=0, tickLower=-887220, tickUpper=887220, liquidity=0
        // regardless of the actual Uniswap position.
        //
        // To fix this in production, register() would need to:
        //   1. Accept the PositionManager address as a constructor param
        //   2. Call positionManager.getPoolAndPositionInfo(positionId)
        //   3. Read the actual pool's current sqrtPriceX96 from StateView
        //   4. Store the real position parameters
        //
        // This test documents the gap by verifying the v4 PoolModifyLiquidityTest
        // contract is live and callable on the fork, but register() ignores it.

        // Verify PoolModifyLiquidityTest is live
        uint256 codeSize;
        address poolModLiq = 0x0C478023803a644c94c4CE1C1e7b9A087e411B0A;
        assembly { codeSize := extcodesize(poolModLiq) }
        assertGt(codeSize, 0, "C11: PoolModifyLiquidityTest is live on Sepolia");
        console.log("C11 PoolModifyLiquidityTest codesize:", codeSize);

        // Register — the positionId is not validated against v4
        uint256 ilpnId = _registerAs(alice, 100e6);
        assertEq(ilpnRegistry.ownerOf(ilpnId), alice, "C11: ILPN minted");

        // Read stored position — entrySqrtPriceX96 and liquidity are 0
        // This proves register() doesn't read from the real PositionManager
        bytes32 baseSlot = keccak256(abi.encode(uint256(ilpnId), uint256(2)));
        uint256 slot1 = uint256(vm.load(address(core), bytes32(uint256(baseSlot) + 1)));
        uint160 storedEntry = uint160(slot1); // bottom 160 bits
        console.log("C11 Stored entrySqrtPriceX96:", storedEntry);
        assertEq(storedEntry, 0, "C11 FINDING: entrySqrtPriceX96 is 0 - not read from v4");
    }

    function test_C12_nonZeroPremiumStreaming() public {
        // Gap 3: Configure oracle to produce non-zero premium rate
        // Use moderate vol so premium rate is manageable
        bytes32 modVolPool = bytes32(uint256(99));

        // Lower C-level from 5x to 0.001x for a manageable premium rate
        oracle.setCLevel(1e15); // 0.001

        oracle.configurePool(
            modVolPool,
            CHAINLINK_ETH_USD,
            address(0),
            0.50e18,  // 50% vol floor
            3000,
            0         // ZERO fees → netIL = grossIL > 0
        );

        // Register — lower tier (50%) and short duration
        mockUSDC.mint(alice, 10_000_000e6); // fund plenty
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 10_000_000e6);
        uint256 ilpnId = core.register(99, 0, 50_400, 5_000_000e6, address(0));
        vm.stopPrank();

        // Read premium rate
        bytes32 baseSlot = keccak256(abi.encode(uint256(ilpnId), uint256(2)));
        uint256 premiumRate = uint256(vm.load(address(core), bytes32(uint256(baseSlot) + 4)));
        console.log("C12 premiumRatePerBlock:", premiumRate);
        assertGt(premiumRate, 0, "C12: Premium rate must be >0 with high vol, zero fees");

        // Read premium balance before
        uint256 balBefore = uint256(vm.load(address(core), bytes32(uint256(baseSlot) + 3)));
        console.log("C12 Premium balance before:", balBefore);

        // Advance 1000 blocks and stream
        vm.roll(block.number + 1000);
        uint256[] memory ids = new uint256[](1);
        ids[0] = ilpnId;
        core.processStreaming(ids);

        // Read premium balance after
        uint256 balAfter = uint256(vm.load(address(core), bytes32(uint256(baseSlot) + 3)));
        console.log("C12 Premium balance after:", balAfter);

        uint256 expectedDeduction = premiumRate * 1000;
        uint256 actualDeduction = balBefore - balAfter;
        console.log("C12 Expected deduction:", expectedDeduction);
        console.log("C12 Actual deduction:", actualDeduction);

        assertGt(actualDeduction, 0, "C12: Premium must decrease");
        assertEq(actualDeduction, expectedDeduction, "C12: Deduction = rate * blocks");
    }
}
