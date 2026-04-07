// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {IPositionAdapter} from "../../src/interfaces/IPositionAdapter.sol";
import {UniswapV3Adapter} from "../../src/adapters/UniswapV3Adapter.sol";

/// @title PhaseH — V3 Adapter Fork Tests
/// @notice Validates deployed v3 adapters read real positions on Sepolia
contract PhaseH_V3Adapters is Test {
    // Deployed adapters on Sepolia
    address constant UNI_V3_ADAPTER   = 0x89eA6bdE36BB30bD8594F5855534f05866f3DF26;
    address constant SUSHI_V3_ADAPTER = 0x6183b311328Eb90B1437fBBfDfC434d333A633D6;
    address constant PCS_V3_ADAPTER   = 0x2e41a526f217202FC06f3c6dD3B506f446772Ca0;

    // Known live position IDs on Sepolia (from smoke test)
    uint256 constant UNI_V3_POS_ID = 1;
    uint256 constant SUSHI_V3_POS_ID = 1;

    // ILShieldCore V2
    address constant CORE = 0xdbB160dc5f8e00A8f216042F6b1Dc16055B10722;

    function setUp() public {
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));
    }

    function test_H01_uniV3Adapter_readsPosition() public view {
        IPositionAdapter adapter = IPositionAdapter(UNI_V3_ADAPTER);
        IPositionAdapter.PositionData memory pos = adapter.getPosition(UNI_V3_POS_ID);

        assertGt(pos.sqrtPriceX96, 0, "H01: sqrtPriceX96 > 0");
        assertGt(pos.liquidity, 0, "H01: liquidity > 0");
        assertTrue(pos.tickLower < pos.tickUpper, "H01: ticks valid");
        assertTrue(pos.token0 != address(0), "H01: token0 set");
        assertTrue(pos.token1 != address(0), "H01: token1 set");
        assertTrue(pos.pool != address(0), "H01: pool set");
        assertEq(pos.feeRate, 3000, "H01: fee 3000");

        console.log("H01 Uni v3 sqrtPriceX96:", pos.sqrtPriceX96);
        console.log("H01 Uni v3 liquidity:", pos.liquidity);
        console.log("H01 Uni v3 ticks:", uint256(uint24(pos.tickLower)), uint256(uint24(pos.tickUpper)));
        console.log("H01 Uni v3 pool:", pos.pool);
    }

    function test_H02_sushiV3Adapter_readsPosition() public view {
        IPositionAdapter adapter = IPositionAdapter(SUSHI_V3_ADAPTER);
        IPositionAdapter.PositionData memory pos = adapter.getPosition(SUSHI_V3_POS_ID);

        assertGt(pos.sqrtPriceX96, 0, "H02: sqrtPriceX96 > 0");
        assertGt(pos.liquidity, 0, "H02: liquidity > 0");
        assertTrue(pos.tickLower < pos.tickUpper, "H02: ticks valid");
        assertTrue(pos.pool != address(0), "H02: pool set");

        console.log("H02 Sushi v3 sqrtPriceX96:", pos.sqrtPriceX96);
        console.log("H02 Sushi v3 liquidity:", pos.liquidity);
        console.log("H02 Sushi v3 pool:", pos.pool);
    }

    function test_H03_pcsV3Adapter_deployed() public view {
        // PCS has no live positions with liquidity on Sepolia,
        // but we verify the adapter contract is deployed and callable
        uint256 codeSize;
        address adapter = PCS_V3_ADAPTER;
        assembly { codeSize := extcodesize(adapter) }
        assertGt(codeSize, 0, "H03: PCS adapter has code");

        string memory name = IPositionAdapter(adapter).dexName();
        assertEq(keccak256(bytes(name)), keccak256("PancakeSwap v3"), "H03: dexName correct");
        console.log("H03 PCS adapter codesize:", codeSize);
        console.log("H03 PCS dexName:", name);
    }

    function test_H04_allAdaptersApproved() public view {
        // Verify all 3 are approved on ILShieldCore
        (bool uniApproved) = abi.decode(
            _staticcall(CORE, abi.encodeWithSignature("approvedAdapters(address)", UNI_V3_ADAPTER)),
            (bool)
        );
        (bool sushiApproved) = abi.decode(
            _staticcall(CORE, abi.encodeWithSignature("approvedAdapters(address)", SUSHI_V3_ADAPTER)),
            (bool)
        );
        (bool pcsApproved) = abi.decode(
            _staticcall(CORE, abi.encodeWithSignature("approvedAdapters(address)", PCS_V3_ADAPTER)),
            (bool)
        );

        assertTrue(uniApproved, "H04: Uni v3 approved");
        assertTrue(sushiApproved, "H04: Sushi v3 approved");
        assertTrue(pcsApproved, "H04: PCS v3 approved");
        console.log("H04 All 3 v3 adapters approved on Core");
    }

    function test_H05_uniV3Adapter_getPoolPrice() public view {
        // Read position to get pool address, then verify getPoolPrice works
        IPositionAdapter adapter = IPositionAdapter(UNI_V3_ADAPTER);
        IPositionAdapter.PositionData memory pos = adapter.getPosition(UNI_V3_POS_ID);

        uint160 price = adapter.getPoolPrice(pos.pool);
        assertEq(price, pos.sqrtPriceX96, "H05: getPoolPrice matches getPosition");
        console.log("H05 getPoolPrice:", price);
    }

    function _staticcall(address target, bytes memory data) internal view returns (bytes memory) {
        (bool success, bytes memory result) = target.staticcall(data);
        require(success, "staticcall failed");
        return result;
    }
}
