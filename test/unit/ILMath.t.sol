// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ILMath} from "../../src/libraries/ILMath.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

contract ILMathTest is Test {
    uint160 constant MIN_SQRT_RATIO = 4295128739;
    uint160 constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    function test_computeIL_zeroPriceChange() public pure {
        uint160 sqrtPrice = 79228162514264337593543950336; // sqrt(1) * 2^96
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint128 liquidity = 1e18;

        uint256 il = ILMath.computeIL(sqrtPrice, sqrtPrice, tickLower, tickUpper, liquidity);
        assertEq(il, 0, "IL must be zero when price unchanged");
    }

    function test_computeIL_priceDoubles() public {
        uint160 entry = 79228162514264337593543950336;  // sqrt(1) * 2^96
        uint160 exit_ = 158456325028528675187087900672; // sqrt(4) * 2^96
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint128 liquidity = 1e18;

        uint256 solIL = ILMath.computeIL(entry, exit_, tickLower, tickUpper, liquidity);
        uint256 pythonIL = _callPython(entry, exit_, tickLower, tickUpper, liquidity);

        // Relative tolerance: 0.01% for rounding across split-division
        uint256 tolerance = pythonIL / 10000 + 1;
        assertApproxEqAbs(solIL, pythonIL, tolerance, "IL mismatch vs Python (price doubles)");
        assertTrue(solIL > 0, "IL must be positive when price changes");
    }

    function test_computeIL_priceHalves() public {
        uint160 entry = 158456325028528675187087900672; // sqrt(4) * 2^96
        uint160 exit_ = 79228162514264337593543950336;  // sqrt(1) * 2^96
        int24 tickLower = -887220;
        int24 tickUpper = 887220;
        uint128 liquidity = 1e18;

        uint256 solIL = ILMath.computeIL(entry, exit_, tickLower, tickUpper, liquidity);
        uint256 pythonIL = _callPython(entry, exit_, tickLower, tickUpper, liquidity);

        uint256 tolerance = pythonIL / 10000 + 1;
        assertApproxEqAbs(solIL, pythonIL, tolerance, "IL mismatch vs Python (price halves)");
        assertTrue(solIL > 0, "IL must be positive when price changes");
    }

    function test_computeIL_priceExitsRangeAbove() public {
        uint160 entry = 79228162514264337593543950336; // tick 0, within range
        int24 tickLower = -10000;
        int24 tickUpper = 10000;
        uint128 liquidity = 1e18;
        uint160 exit_ = TickMath.getSqrtPriceAtTick(20000);

        uint256 solIL = ILMath.computeIL(entry, exit_, tickLower, tickUpper, liquidity);
        uint256 pythonIL = _callPython(entry, exit_, tickLower, tickUpper, liquidity);

        uint256 tolerance = pythonIL / 10000 + 1;
        assertApproxEqAbs(solIL, pythonIL, tolerance, "IL mismatch (price exits range above)");
    }

    function test_computeIL_priceExitsRangeBelow() public {
        uint160 entry = 79228162514264337593543950336; // tick 0, within range
        int24 tickLower = -10000;
        int24 tickUpper = 10000;
        uint128 liquidity = 1e18;
        uint160 exit_ = TickMath.getSqrtPriceAtTick(-20000);

        uint256 solIL = ILMath.computeIL(entry, exit_, tickLower, tickUpper, liquidity);
        uint256 pythonIL = _callPython(entry, exit_, tickLower, tickUpper, liquidity);

        uint256 tolerance = pythonIL / 10000 + 1;
        assertApproxEqAbs(solIL, pythonIL, tolerance, "IL mismatch (price exits range below)");
    }

    function test_fuzz_computeIL_matchesPythonReference(
        uint160 entrySqrt,
        uint160 exitSqrt,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) public {
        // Bound sqrt prices to realistic range (approx $0.0001 to $1,000,000 for a token pair)
        // Tick -276000 to 276000 covers ~1e-12 to 1e12 price range
        uint160 minSqrt = TickMath.getSqrtPriceAtTick(-276000);
        uint160 maxSqrt = TickMath.getSqrtPriceAtTick(276000);
        entrySqrt = uint160(bound(uint256(entrySqrt), minSqrt, maxSqrt));
        exitSqrt = uint160(bound(uint256(exitSqrt), minSqrt, maxSqrt));
        // Tick range within ±200000
        tickLower = int24(bound(int256(tickLower), -200000, 200000));
        tickUpper = int24(bound(int256(tickUpper), int256(tickLower) + 10, 200010));
        vm.assume(tickUpper > tickLower);
        liquidity = uint128(bound(uint256(liquidity), 1e12, 1e22));

        uint256 solIL = ILMath.computeIL(entrySqrt, exitSqrt, tickLower, tickUpper, liquidity);
        uint256 pythonIL = _callPython(entrySqrt, exitSqrt, tickLower, tickUpper, liquidity);

        // 0.01% relative tolerance + 1 absolute wei for rounding
        uint256 maxVal = solIL > pythonIL ? solIL : pythonIL;
        uint256 tolerance = maxVal / 10000 + 1;

        assertApproxEqAbs(
            solIL,
            pythonIL,
            tolerance,
            string.concat(
                "IL mismatch: sol=", vm.toString(solIL),
                " py=", vm.toString(pythonIL)
            )
        );
    }

    /// @notice Call Python reference via FFI and decode abi-encoded uint256
    function _callPython(
        uint160 entry,
        uint160 exit_,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal returns (uint256) {
        string[] memory cmd = new string[](6);
        cmd[0] = "python3";
        cmd[1] = "reference/il_math_reference.py";
        cmd[2] = vm.toString(uint256(entry));
        cmd[3] = vm.toString(uint256(exit_));
        cmd[4] = vm.toString(int256(tickLower));
        cmd[5] = vm.toString(int256(tickUpper));

        // Need to pass liquidity as 6th arg — extend array
        string[] memory fullCmd = new string[](7);
        fullCmd[0] = cmd[0];
        fullCmd[1] = cmd[1];
        fullCmd[2] = cmd[2];
        fullCmd[3] = cmd[3];
        fullCmd[4] = cmd[4];
        fullCmd[5] = cmd[5];
        fullCmd[6] = vm.toString(uint256(liquidity));

        bytes memory result = vm.ffi(fullCmd);
        // Python outputs 0x{64 hex chars} which vm.ffi returns as 32 bytes
        return abi.decode(result, (uint256));
    }
}
