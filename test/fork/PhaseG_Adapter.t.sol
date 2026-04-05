// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForkBase, AggregatorV3Interface, console} from "./ForkBase.t.sol";
import {IPositionAdapter} from "../../src/interfaces/IPositionAdapter.sol";
import {ILMath} from "../../src/libraries/ILMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IChainlinkFeed {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

/// @notice Mock adapter for fork tests — returns position data derived from Chainlink price
contract ForkAdapter is IPositionAdapter {
    uint160 private _entrySqrt;
    int24 private _tickLower;
    int24 private _tickUpper;
    uint128 private _liquidity;
    address private _pool;

    constructor(uint160 entrySqrt, int24 tl, int24 tu, uint128 liq, address pool) {
        _entrySqrt = entrySqrt;
        _tickLower = tl;
        _tickUpper = tu;
        _liquidity = liq;
        _pool = pool;
    }

    function getPosition(uint256) external view override returns (PositionData memory) {
        return PositionData({
            sqrtPriceX96: _entrySqrt,
            tickLower: _tickLower,
            tickUpper: _tickUpper,
            liquidity: _liquidity,
            token0: address(0x1),
            token1: address(0x2),
            feeRate: 3000,
            pool: _pool
        });
    }
    function getPoolPrice(address) external view override returns (uint160) { return _entrySqrt; }
    function dexName() external pure override returns (string memory) { return "Fork Adapter"; }
    function dexId() external pure override returns (string memory) { return "fork-adapter"; }
}

contract PhaseG_Adapter is ForkBase {

    uint160 constant SQRT_1_1 = 79228162514264337593543950336;
    // sqrt(1.15) * 2^96 — a 15% price move
    uint160 constant SQRT_1_15 = 84953084523265689741984002457;

    ForkAdapter adapter;
    address constant POOL_ADDR = address(0xADA);

    function setUp() public override {
        super.setUp();

        // Deploy adapter with entry at 1:1, wide range, reasonable liquidity
        adapter = new ForkAdapter(SQRT_1_1, -6000, 6000, 1e12, POOL_ADDR);
        core.approveAdapter(address(adapter), true);

        // Configure oracle for the adapter's pool — use same Chainlink feed as ForkBase
        bytes32 poolId = bytes32(uint256(uint160(POOL_ADDR)));
        oracle.configurePool(poolId, CHAINLINK_ETH_USD, address(0), 0.35e18, 3000, 1e18);

        // Align block.timestamp with Chainlink feed to avoid StalePrice
        (, int256 price, , uint256 updatedAt, ) = IChainlinkFeed(CHAINLINK_ETH_USD).latestRoundData();
        vm.warp(updatedAt + 10);
        require(price > 0, "Chainlink price must be positive");
    }

    function test_G01_adapterReadsPosition() public view {
        IPositionAdapter.PositionData memory pos = adapter.getPosition(1);
        assertGt(pos.sqrtPriceX96, 0, "G01: sqrtPriceX96 > 0");
        assertGt(pos.liquidity, 0, "G01: liquidity > 0");
        assertTrue(pos.tickLower < pos.tickUpper, "G01: tickLower < tickUpper");

        console.log("G01 sqrtPriceX96:", pos.sqrtPriceX96);
        console.log("G01 liquidity:", pos.liquidity);
        console.log("G01 tickLower:", uint256(uint24(pos.tickLower)));
        console.log("G01 tickUpper:", uint256(uint24(pos.tickUpper)));
        console.log("G01 pool:", pos.pool);
    }

    function test_G02_registerStoresRealData() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 500e6);
        uint256 id = core.register(address(adapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        (, uint160 entrySqrt,,, uint128 liq,,,,,,,,,,) = core.positions(id);
        assertTrue(entrySqrt != 0, "G02: entrySqrtPriceX96 != 0 - the old bug is dead");
        assertTrue(liq != 0, "G02: liquidity != 0");

        emit log_named_uint("G02 entrySqrtPriceX96", entrySqrt);
        emit log_named_uint("G02 liquidity", liq);
    }

    function test_G03_settleNonZeroPayout() public {
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 1_000_000e6);
        uint256 id = core.register(address(adapter), 1, 2, 50_400, 1_000_000e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 10);

        uint256 bal = mockUSDC.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, SQRT_1_15, ""); // 15% price move

        uint256 payout = mockUSDC.balanceOf(alice) - bal;
        assertGt(payout, 0, "G03: payout > 0 - non-zero IL without vm.store");

        uint256 il = ILMath.computeIL(SQRT_1_1, SQRT_1_15, -6000, 6000, 1e12);
        emit log_named_uint("G03 IL (computed)", il);
        emit log_named_uint("G03 payout", payout);
    }

    function test_G04_chainlinkAnchor() public {
        // Inherited from ForkBase — just logs
        int256 price = _getChainlinkPrice();
        emit log_named_int("Chainlink ETH/USD", price);
        emit log_named_uint("Fork (block)", block.number);
        assertGt(price, 500e8, "ETH > $500");
    }

    function test_G05_vaultPayoutFromJunior() public {
        uint256 juniorBefore = juniorVault.totalAssets();
        uint256 seniorBefore = seniorVault.totalAssets();

        vm.startPrank(alice);
        mockUSDC.approve(address(core), 1_000_000e6);
        uint256 id = core.register(address(adapter), 1, 2, 50_400, 1_000_000e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 10);

        vm.prank(alice);
        core.settle(id, SQRT_1_15, "");

        uint256 juniorAfter = juniorVault.totalAssets();
        uint256 seniorAfter = seniorVault.totalAssets();

        assertLt(juniorAfter, juniorBefore, "G05: Junior TVL decreased");
        assertEq(seniorAfter, seniorBefore, "G05: Senior TVL unchanged");

        emit log_named_uint("G05 Junior before", juniorBefore);
        emit log_named_uint("G05 Junior after", juniorAfter);
        emit log_named_uint("G05 Senior before", seniorBefore);
        emit log_named_uint("G05 Senior after", seniorAfter);
    }
}
