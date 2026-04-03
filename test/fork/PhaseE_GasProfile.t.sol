// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForkBase, console} from "./ForkBase.t.sol";
import {ILMath} from "../../src/libraries/ILMath.sol";

/// @title Phase E: Gas Profiling on Live Fork (E01–E06)
contract PhaseE_GasProfile is ForkBase {

    function test_E01_gas_register() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 1_000e6);
        uint256 g = gasleft();
        core.register(1, 2, 216_000, 500e6, address(0));
        uint256 gasUsed = g - gasleft();
        vm.stopPrank();
        console.log("E01 register() gas:", gasUsed);
        assertLt(gasUsed, 500_000, "E01: register under 500K gas on fork");
    }

    function test_E02_gas_settle() public {
        uint256 ilpnId = _registerAs(alice, 500e6);
        vm.roll(block.number + 10);
        vm.startPrank(alice);
        uint256 g = gasleft();
        core.settle(ilpnId, 79228162514264337593543950336, "");
        uint256 gasUsed = g - gasleft();
        vm.stopPrank();
        console.log("E02 settle() gas:", gasUsed);
        assertLt(gasUsed, 500_000, "E02: settle under 500K gas on fork");
    }

    function test_E03_gas_processStreaming_single() public {
        uint256 ilpnId = _registerAs(alice, 500e6);
        vm.roll(block.number + 1000);
        uint256[] memory ids = new uint256[](1);
        ids[0] = ilpnId;
        uint256 g = gasleft();
        core.processStreaming(ids);
        uint256 gasUsed = g - gasleft();
        console.log("E03 processStreaming(1) gas:", gasUsed);
        assertLt(gasUsed, 200_000, "E03: single streaming under 200K gas");
    }

    function test_E04_gas_processStreaming_batch10() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 5_000_000e6);
        uint256[] memory ids = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            ids[i] = core.register(1, 2, 216_000, 100e6, address(0));
        }
        vm.stopPrank();

        vm.roll(block.number + 1000);
        uint256 g = gasleft();
        core.processStreaming(ids);
        uint256 gasUsed = g - gasleft();
        console.log("E04 processStreaming(10) gas:", gasUsed);
        console.log("E04 per-position:", gasUsed / 10);
        assertLt(gasUsed, 2_000_000, "E04: batch-10 under 2M gas");
    }

    function test_E05_gas_seniorDeposit() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(seniorVault), 10_000e6);
        uint256 g = gasleft();
        seniorVault.deposit(10_000e6, alice);
        uint256 gasUsed = g - gasleft();
        vm.stopPrank();
        console.log("E05 seniorVault.deposit() gas:", gasUsed);
        assertLt(gasUsed, 200_000, "E05: deposit under 200K gas");
    }

    function test_E06_gas_juniorDeposit() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(juniorVault), 5_000e6);
        uint256 g = gasleft();
        juniorVault.deposit(5_000e6, alice);
        uint256 gasUsed = g - gasleft();
        vm.stopPrank();
        console.log("E06 juniorVault.deposit() gas:", gasUsed);
        assertLt(gasUsed, 200_000, "E06: deposit under 200K gas");
    }

    function test_E07_gas_settle_withIL() public {
        // Register with real position params to produce non-zero IL
        uint160 entrySqrt = 79228162514264337593543950336; // 1:1
        uint160 exitSqrt = 86787299046364038601618741436;  // +20%
        uint256 ilpnId = _registerWithPosition(alice, 500e6, entrySqrt, -6000, 6000, 1e18);

        vm.roll(block.number + 10);

        vm.startPrank(alice);
        uint256 g = gasleft();
        core.settle(ilpnId, exitSqrt, "");
        uint256 gasUsed = g - gasleft();
        vm.stopPrank();

        console.log("E07 settle(with IL payout) gas:", gasUsed);
        assertLt(gasUsed, 500_000, "E07: settle with IL under 500K gas");
    }
}
