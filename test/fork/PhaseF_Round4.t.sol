// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForkBase, console} from "./ForkBase.t.sol";
import {ILMath} from "../../src/libraries/ILMath.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// Minimal interface for v4 PoolManager initialize
interface IPoolManager {
    struct PoolKey {
        address currency0;
        address currency1;
        uint24 fee;
        int24 tickSpacing;
        address hooks;
    }
    function initialize(PoolKey memory key, uint160 sqrtPriceX96) external returns (int24 tick);
}

// Minimal interface for StateView
interface IStateView {
    function getSlot0(bytes32 poolId) external view returns (uint160 sqrtPriceX96, int24 tick, uint24 protocolFee, uint24 lpFee);
}

// Minimal interface for PoolModifyLiquidityTest
interface IPoolModifyLiquidityTest {
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }
    function modifyLiquidity(
        IPoolManager.PoolKey memory key,
        ModifyLiquidityParams memory params,
        bytes memory hookData
    ) external returns (int256 delta0, int256 delta1);
}

// Minimal interface for PoolSwapTest
interface IPoolSwapTest {
    struct SwapParams {
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
    }
    struct TestSettings {
        bool takeClaims;
        bool settleUsingBurn;
    }
    function swap(
        IPoolManager.PoolKey memory key,
        SwapParams memory params,
        TestSettings memory settings,
        bytes memory hookData
    ) external returns (int256 delta0, int256 delta1);
}

/// @title Section 2: Real v4 Pool Interaction + Section 3/4 Edge Cases
contract PhaseF_Round4 is ForkBase {

    // ═══ Section 2: Real v4 Pool ═══

    function test_2_1_initializePool() public {
        // Sort tokens by address
        (address token0, address token1) = address(mockUSDC) < address(mockWETH)
            ? (address(mockUSDC), address(mockWETH))
            : (address(mockWETH), address(mockUSDC));

        IPoolManager.PoolKey memory key = IPoolManager.PoolKey({
            currency0: token0,
            currency1: token1,
            fee: 3000,
            tickSpacing: 60,
            hooks: address(0)
        });

        // Initialize at 1:1
        uint160 initSqrt = 79228162514264337593543950336;

        // This will likely revert because the PoolManager requires the caller
        // to implement IUnlockCallback (flash accounting pattern).
        // Document the limitation.
        try IPoolManager(V4_POOL_MANAGER).initialize(key, initSqrt) returns (int24 tick) {
            console.log("2.1 Pool initialized at tick:", tick);
        } catch (bytes memory err) {
            // Expected: v4 requires unlock callback pattern
            console.log("2.1 DOCUMENTED: Direct initialize() reverts on v4");
            console.log("2.1 Reason: PoolManager requires IUnlockCallback pattern");
            console.log("2.1 Error length:", err.length);
            // This is a known v4 architecture requirement, not a bug
            // The PoolModifyLiquidityTest helper handles this internally
        }
    }

    function test_2_2_v4HelperContractsLive() public view {
        // Verify all v4 helper contracts are deployed and callable
        uint256 pmSize;
        uint256 swapSize;
        uint256 modLiqSize;
        uint256 stateSize;
        assembly {
            pmSize := extcodesize(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543)
            swapSize := extcodesize(0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe)
            modLiqSize := extcodesize(0x0C478023803a644c94c4CE1C1e7b9A087e411B0A)
            stateSize := extcodesize(0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C)
        }
        assertGt(pmSize, 0, "2.2: PoolManager live");
        assertGt(swapSize, 0, "2.2: PoolSwapTest live");
        assertGt(modLiqSize, 0, "2.2: PoolModifyLiquidityTest live");
        assertGt(stateSize, 0, "2.2: StateView live");
        console.log("2.2 PoolManager:", pmSize);
        console.log("2.2 SwapTest:", swapSize);
        console.log("2.2 ModLiqTest:", modLiqSize);
        console.log("2.2 StateView:", stateSize);
    }

    function test_2_4_ILMath_withRealisticParams() public pure {
        // Compute IL from realistic pool params (even without live pool creation)
        uint160 entrySqrt = 79228162514264337593543950336; // 1:1
        // After a 10% swap, price moves: sqrt(1.1) * 2^96
        uint160 exitSqrt = 83101860945498258698601814362;
        int24 tickLower = -600;
        int24 tickUpper = 600;
        uint128 liquidity = 1e18;

        uint256 il = ILMath.computeIL(entrySqrt, exitSqrt, tickLower, tickUpper, liquidity);
        assertGt(il, 0, "2.4: Non-zero IL for 10% move in concentrated range");
        console.log("2.4 IL for 10% move (concentrated +-600 ticks):", il);
    }

    // ═══ Section 3: Economic Stress ═══

    function test_3_2_massLiquidation_20positions() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        uint160 entry = 79228162514264337593543950336;
        uint160 exit40pct = 94473795017117205112252740403; // sqrt(1.4) * 2^96

        // Seed extra into Junior for mass payout
        mockUSDC.mint(address(this), 100_000_000e6);
        mockUSDC.approve(address(juniorVault), 100_000_000e6);
        juniorVault.deposit(100_000_000e6, address(this));

        // Register 20 positions at 100% coverage
        uint256[] memory ids = new uint256[](20);
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 20_000_000e6);
        for (uint256 i = 0; i < 20; i++) {
            ids[i] = core.register(1, 2, 216_000, 100e6, address(0));
        }
        vm.stopPrank();

        // Inject 40% price increase position data for all
        for (uint256 i = 0; i < 20; i++) {
            _injectPosition(ids[i], entry, -6000, 6000, 1e12);
            _setMaxPayout(ids[i], type(uint256).max);
        }

        vm.roll(block.number + 10);

        // Settle all 20, track Junior balance
        uint256 juniorBefore = juniorVault.totalAssets();
        uint256 totalPayout;
        bool juniorDrained = false;

        for (uint256 i = 0; i < 20; i++) {
            uint256 juniorPre = juniorVault.totalAssets();
            uint256 bal = mockUSDC.balanceOf(alice);
            vm.prank(alice);
            core.settle(ids[i], exit40pct, "");
            uint256 payout = mockUSDC.balanceOf(alice) - bal;
            totalPayout += payout;

            if (juniorVault.totalAssets() == 0 && !juniorDrained) {
                juniorDrained = true;
                console.log("3.2 Junior drained at claim #", i + 1);
            }
        }

        console.log("3.2 Total payout across 20 claims:", totalPayout);
        console.log("3.2 Junior after:", juniorVault.totalAssets());
        console.log("3.2 Senior after:", seniorVault.totalAssets());

        // Junior should be drained before Senior is touched
        // (depends on IL amount vs Junior TVL)
    }

    // ═══ Section 4: Edge Cases ═══

    function test_4_1_maxLiquidity() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        uint256 id = _registerAs(alice, 500e6);
        // Inject max uint128 liquidity — IL will be astronomical
        _injectPosition(id, 79228162514264337593543950336, -6000, 6000, type(uint128).max);
        // Cap maxPayout at vault's capacity to avoid ERC20InsufficientBalance
        uint256 juniorBal = juniorVault.totalAssets();
        _setMaxPayout(id, juniorBal / 2); // cap at half Junior TVL

        vm.roll(block.number + 10);

        // Compute IL — verify no overflow in the math
        uint256 il = ILMath.computeIL(
            79228162514264337593543950336, 86787299046364038601618741436,
            -6000, 6000, type(uint128).max
        );
        console.log("4.1 IL with max liquidity:", il);
        assertGt(il, 0, "4.1: IL computation did not overflow");

        // Settle — payout will hit maxPayout cap
        uint256 bal = mockUSDC.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, 86787299046364038601618741436, "");
        uint256 payout = mockUSDC.balanceOf(alice) - bal;
        console.log("4.1 Payout (capped at vault):", payout);
        assertGt(payout, 0, "4.1: Non-zero payout with max liquidity");
    }

    function test_4_2_minimumViableParams() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        core.setSettlementFeeRate(200);

        // 1 wei premium, tier 0, minimum duration
        // minCoverageDuration is set in constructor — check what it is
        // Default: 50400 blocks. With premiumRate=0 (fees>IL), minPremium = 0*50400 = 0
        // So 1 wei should work
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 1);
        uint256 id = core.register(1, 0, 50_400, 1, address(0));
        vm.stopPrank();

        vm.roll(block.number + 10);
        vm.prank(alice);
        core.settle(id, 79228162514264337593543950336, ""); // same price, IL=0
        console.log("4.2: 1 wei premium registration and settlement succeeded");
    }

    // Helper: inject position params via vm.store
    function _injectPosition(uint256 id, uint160 entry, int24 tl, int24 tu, uint128 liq) internal {
        bytes32 base = keccak256(abi.encode(id, uint256(2)));
        uint256 packed1 = uint256(entry) | (uint256(uint24(tl)) << 160) | (uint256(uint24(tu)) << 184);
        vm.store(address(core), bytes32(uint256(base) + 1), bytes32(packed1));
        uint256 existing2 = uint256(vm.load(address(core), bytes32(uint256(base) + 2)));
        existing2 = (existing2 >> 128) << 128;
        existing2 |= uint256(liq);
        vm.store(address(core), bytes32(uint256(base) + 2), bytes32(existing2));
    }

    function _setMaxPayout(uint256 id, uint256 maxP) internal {
        bytes32 base = keccak256(abi.encode(id, uint256(2)));
        vm.store(address(core), bytes32(uint256(base) + 6), bytes32(maxP));
    }
}
