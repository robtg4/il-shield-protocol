// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {PricingOracle} from "../../src/core/PricingOracle.sol";

contract MockFeed {
    int256 public price;
    uint256 public updatedAt;
    constructor(int256 p) { price = p; updatedAt = block.timestamp; }
    function setPrice(int256 p) external { price = p; updatedAt = block.timestamp; }
    function setStale() external { updatedAt = block.timestamp - 3601; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, updatedAt, 1);
    }
    function decimals() external pure returns (uint8) { return 8; }
}

contract PricingOracleTest is Test {
    PricingOracle oracle;
    MockFeed feed;

    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 constant POOL_ID = bytes32(uint256(1));
    bytes32 constant POOL_UNCONFIGURED = bytes32(uint256(99));

    address admin = address(this);
    address keeper = makeAddr("keeper");
    address attacker = makeAddr("attacker");

    function setUp() public {
        vm.warp(1_700_000_000); // reasonable timestamp
        feed = new MockFeed(2500e8);
        oracle = new PricingOracle(admin);
        oracle.grantRole(KEEPER_ROLE, keeper);
        oracle.configurePool(POOL_ID, address(feed), address(0), 0.35e18, 3000, 1e14);
    }

    // --- Stale price ---
    function test_stalePrice_reverts() public {
        feed.setStale();
        vm.expectRevert(PricingOracle.StalePrice.selector);
        oracle.getChainlinkSqrtPriceX96(POOL_ID);
    }

    function test_freshPrice_succeeds() public view {
        uint160 sqrtPrice = oracle.getChainlinkSqrtPriceX96(POOL_ID);
        assertGt(sqrtPrice, 0);
    }

    // --- Unconfigured pool ---
    function test_unconfiguredPool_reverts() public {
        vm.expectRevert(PricingOracle.PoolNotConfigured.selector);
        oracle.getChainlinkSqrtPriceX96(POOL_UNCONFIGURED);
    }

    function test_unconfiguredPool_computePremium_reverts() public {
        vm.expectRevert(PricingOracle.PoolNotConfigured.selector);
        oracle.computePremiumRate(POOL_UNCONFIGURED, -1000, 1000, 2);
    }

    // --- Zero address feed ---
    function test_zeroAddressFeed_reverts() public {
        vm.expectRevert(PricingOracle.InvalidFeed.selector);
        oracle.configurePool(bytes32(uint256(2)), address(0), address(0), 0.35e18, 3000, 1e14);
    }

    // --- Negative/zero price ---
    function test_negativePrice_reverts() public {
        feed.setPrice(-100e8);
        vm.expectRevert(PricingOracle.InvalidFeed.selector);
        oracle.getChainlinkSqrtPriceX96(POOL_ID);
    }

    function test_zeroPrice_reverts() public {
        feed.setPrice(0);
        vm.expectRevert(PricingOracle.InvalidFeed.selector);
        oracle.getChainlinkSqrtPriceX96(POOL_ID);
    }

    // --- Volatility updates ---
    function test_volUpdate_byKeeper_succeeds() public {
        vm.prank(keeper);
        oracle.updateVolatility(POOL_ID, 0.5e18, 0.6e18);
        uint256 vol = oracle.getVolatility(POOL_ID);
        // max(realized=0.5, implied=0.6, floor=0.35) = 0.6
        assertEq(vol, 0.6e18);
    }

    function test_volUpdate_byNonKeeper_reverts() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, KEEPER_ROLE));
        oracle.updateVolatility(POOL_ID, 0.5e18, 0.6e18);
    }

    // --- TWAP updates ---
    function test_twapUpdate_byKeeper_succeeds() public {
        vm.prank(keeper);
        oracle.updateTWAP(POOL_ID, 79228162514264337593543950336);
        uint160 twap = uint160(uint256(oracle.twapPrices(POOL_ID)));
        assertEq(twap, 79228162514264337593543950336);
    }

    function test_twapUpdate_byNonKeeper_reverts() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, KEEPER_ROLE));
        oracle.updateTWAP(POOL_ID, 79228162514264337593543950336);
    }

    // --- Volatility composition ---
    function test_volatility_maxOfThree() public {
        // Set realized=0.4, implied=0.3, floor=0.35 → max = 0.4
        vm.prank(keeper);
        oracle.updateVolatility(POOL_ID, 0.4e18, 0.3e18);
        assertEq(oracle.getVolatility(POOL_ID), 0.4e18);
    }

    function test_volatility_floorWins() public {
        // Set realized=0.1, implied=0.2, floor=0.35 → max = 0.35
        vm.prank(keeper);
        oracle.updateVolatility(POOL_ID, 0.1e18, 0.2e18);
        assertEq(oracle.getVolatility(POOL_ID), 0.35e18);
    }

    function test_volatility_stale_fallback() public {
        vm.prank(keeper);
        oracle.updateVolatility(POOL_ID, 0.5e18, 0.8e18);
        // Advance past staleness threshold (2400 blocks)
        vm.roll(block.number + 2500);
        uint256 vol = oracle.getVolatility(POOL_ID);
        // Stale: implied replaced by 1.2x realized = 0.6. max(0.5, 0.6, 0.35) = 0.6
        assertEq(vol, 0.6e18);
    }

    // --- Admin ---
    function test_setCLevel() public {
        oracle.setCLevel(10e18);
        assertEq(oracle.cLevel(), 10e18);
    }

    function test_setVolFloor() public {
        oracle.setVolFloor(POOL_ID, 0.5e18);
        // Now with realized=floor default, vol = max(0.35, 0.35, 0.5) = 0.5
    }

    function test_computePremiumRate_returnsValue() public view {
        uint256 rate = oracle.computePremiumRate(POOL_ID, -1000, 1000, 2);
        // With high vol/liq, fees > IL, rate = 0
        assertEq(rate, 0);
    }

    // --- Branch coverage: _max3 all orderings ---
    function test_max3_impliedWins() public {
        // realized=0.1, implied=0.8, floor=0.35 → implied wins (a<b, b>=c)
        vm.prank(keeper);
        oracle.updateVolatility(POOL_ID, 0.1e18, 0.8e18);
        assertEq(oracle.getVolatility(POOL_ID), 0.8e18);
    }

    function test_max3_realizedWins_overFloor() public {
        // realized=0.9, implied=0.3, floor=0.35 → realized wins (a>=b, a>=c)
        vm.prank(keeper);
        oracle.updateVolatility(POOL_ID, 0.9e18, 0.3e18);
        assertEq(oracle.getVolatility(POOL_ID), 0.9e18);
    }

    function test_max3_floorWins_overBoth() public {
        // realized=0.1, implied=0.2, floor=0.35 → floor wins (a<b, b<c path via floor)
        vm.prank(keeper);
        oracle.updateVolatility(POOL_ID, 0.1e18, 0.2e18);
        assertEq(oracle.getVolatility(POOL_ID), 0.35e18);
    }

    function test_max3_floorWins_aGeBButLtC() public {
        // realized=0.3, implied=0.2, floor=0.35 → a>=b but a<c → floor wins
        vm.prank(keeper);
        oracle.updateVolatility(POOL_ID, 0.3e18, 0.2e18);
        assertEq(oracle.getVolatility(POOL_ID), 0.35e18);
    }

    // --- Branch: TWAP divergence is in ILShieldCore, not PricingOracle ---
    // The TWAP divergence median resolution path does not exist in PricingOracle.
    // PricingOracle only provides getTWAPSqrtPriceX96() which is a simple storage read.
    // The divergence check and median resolution are in ILShieldCore._computeSettlementPrice().
    // That function currently reverts on >3% divergence — there is no median fallback implemented.
    // The remaining uncovered PricingOracle branches are _sqrt(0) which requires price=0
    // (but we revert before reaching sqrt), and setUtilization which is a simple setter.

    function test_setUtilization_byKeeper() public {
        vm.prank(keeper);
        oracle.setUtilization(5000);
        assertEq(oracle.utilizationBps(), 5000);
    }

    function test_setUtilization_byNonKeeper_reverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        oracle.setUtilization(5000);
    }
}
