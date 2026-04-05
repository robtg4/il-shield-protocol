// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILShieldCore} from "../../src/core/ILShieldCore.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {JuniorVault} from "../../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../../src/core/PricingOracle.sol";
import {IPositionAdapter} from "../../src/interfaces/IPositionAdapter.sol";
import {ILMath} from "../../src/libraries/ILMath.sol";

contract MockUSDC_AI is ERC20 {
    constructor() ERC20("USDC", "USDC") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MockFeed_AI {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, 2500e8, block.timestamp, block.timestamp, 1);
    }
    function decimals() external pure returns (uint8) { return 8; }
}

/// @notice Adapter returning configurable position data
contract ConfigurableAdapter is IPositionAdapter {
    PositionData private _pos;
    string private _name;
    string private _id;

    constructor(
        uint160 sqrtPrice,
        int24 tl,
        int24 tu,
        uint128 liq,
        address pool,
        string memory name_,
        string memory id_
    ) {
        _pos = PositionData({
            sqrtPriceX96: sqrtPrice,
            tickLower: tl,
            tickUpper: tu,
            liquidity: liq,
            token0: address(0x1),
            token1: address(0x2),
            feeRate: 3000,
            pool: pool
        });
        _name = name_;
        _id = id_;
    }

    function getPosition(uint256) external view override returns (PositionData memory) { return _pos; }
    function getPoolPrice(address) external view override returns (uint160) { return _pos.sqrtPriceX96; }
    function dexName() external view override returns (string memory) { return _name; }
    function dexId() external view override returns (string memory) { return _id; }
}

/// @notice Adapter returning zero liquidity
contract ZeroLiqAdapter is IPositionAdapter {
    function getPosition(uint256) external pure override returns (PositionData memory) {
        return PositionData(0, 0, 0, 0, address(0), address(0), 0, address(0));
    }
    function getPoolPrice(address) external pure override returns (uint160) { return 0; }
    function dexName() external pure override returns (string memory) { return "Zero"; }
    function dexId() external pure override returns (string memory) { return "zero"; }
}

contract AdapterIntegration is Test {
    MockUSDC_AI usdc;
    ILShieldCore core;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILPNRegistry registry;
    PricingOracle oracle;
    MockFeed_AI feed;

    ConfigurableAdapter adapterA; // entry at 1:1
    ConfigurableAdapter adapterB; // entry at different price

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    address alice = address(0xA11CE);
    address treasury = address(0x7EA5);
    address constant POOL_ADDR = address(0x999);
    bytes32 POOL_ID = bytes32(uint256(uint160(POOL_ADDR)));

    // sqrtPriceX96 for 1:1
    uint160 constant SQRT_1_1 = 79228162514264337593543950336;
    // sqrtPriceX96 for ~1.2 (20% move): sqrt(1.2) * 2^96
    uint160 constant SQRT_1_2 = 86787299046364038601618741436;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC_AI();
        feed = new MockFeed_AI();
        registry = new ILPNRegistry(address(this));
        oracle = new PricingOracle(address(this));
        seniorVault = new SeniorVault(IERC20(address(usdc)), address(this));
        juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), address(this));
        core = new ILShieldCore(address(usdc), address(seniorVault), address(juniorVault), address(registry), address(oracle), treasury, address(this));

        registry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        oracle.grantRole(KEEPER_ROLE, address(this));
        core.grantRole(KEEPER_ROLE, address(this));

        oracle.configurePool(POOL_ID, address(feed), address(0), 0.35e18, 3000, 1e18);

        // Seed vaults
        usdc.mint(address(this), 100_000_000e6);
        usdc.approve(address(seniorVault), 50_000_000e6);
        seniorVault.deposit(50_000_000e6, address(this));
        usdc.approve(address(juniorVault), 10_000_000e6);
        juniorVault.deposit(10_000_000e6, address(this));

        usdc.mint(alice, 10_000_000e6);

        // Two adapters with different entry prices
        adapterA = new ConfigurableAdapter(SQRT_1_1, -6000, 6000, 1e12, POOL_ADDR, "DEX A", "dex-a");
        adapterB = new ConfigurableAdapter(SQRT_1_2, -6000, 6000, 1e12, POOL_ADDR, "DEX B", "dex-b");

        core.approveAdapter(address(adapterA), true);
        core.approveAdapter(address(adapterB), true);

        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
    }

    function test_register_approvedAdapter_succeeds() public {
        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        uint256 id = core.register(address(adapterA), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        (, uint160 entrySqrt, int24 tl, int24 tu, uint128 liq,,,,,,,,,,) = core.positions(id);
        assertEq(entrySqrt, SQRT_1_1, "entrySqrtPriceX96 from adapter");
        assertEq(tl, -6000, "tickLower from adapter");
        assertEq(tu, 6000, "tickUpper from adapter");
        assertEq(liq, 1e12, "liquidity from adapter");

        emit log_named_uint("entrySqrtPriceX96", entrySqrt);
        emit log_named_uint("liquidity", liq);
        emit log_named_int("tickLower", tl);
        emit log_named_int("tickUpper", tu);
    }

    function test_register_unapprovedAdapter_reverts() public {
        ConfigurableAdapter rogue = new ConfigurableAdapter(SQRT_1_1, -6000, 6000, 1e12, POOL_ADDR, "Rogue", "rogue");
        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert(ILShieldCore.AdapterNotApproved.selector);
        core.register(address(rogue), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();
    }

    function test_register_zeroLiquidity_reverts() public {
        ZeroLiqAdapter zeroAdapter = new ZeroLiqAdapter();
        core.approveAdapter(address(zeroAdapter), true);

        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert(ILShieldCore.EmptyPosition.selector);
        core.register(address(zeroAdapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();
    }

    function test_register_revokedAdapter_reverts() public {
        // First register succeeds
        vm.startPrank(alice);
        usdc.approve(address(core), 1000e6);
        core.register(address(adapterA), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        // Revoke
        core.approveAdapter(address(adapterA), false);

        // Second register fails
        vm.startPrank(alice);
        vm.expectRevert(ILShieldCore.AdapterNotApproved.selector);
        core.register(address(adapterA), 2, 2, 50_400, 500e6, address(0));
        vm.stopPrank();
    }

    function test_settle_adapterPosition_nonZeroIL() public {
        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        uint256 id = core.register(address(adapterA), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 10);

        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, SQRT_1_2, ""); // settle at +20%

        uint256 payout = usdc.balanceOf(alice) - bal;
        assertGt(payout, 0, "payout > 0 for adapter position with real IL");
        emit log_named_uint("payout (adapter, 20% move)", payout);
    }

    function test_settle_twoAdapters_differentPayouts() public {
        // Large premium → large maxPayout so we don't cap
        vm.startPrank(alice);
        usdc.approve(address(core), 2_000_000e6);
        uint256 idA = core.register(address(adapterA), 1, 2, 50_400, 1_000_000e6, address(0));
        uint256 idB = core.register(address(adapterB), 2, 2, 50_400, 1_000_000e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 10);

        // Settle both at same exit price
        uint160 exitSqrt = 94473795017117205112252740403; // ~sqrt(1.4) * 2^96

        uint256 balA = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(idA, exitSqrt, "");
        uint256 payoutA = usdc.balanceOf(alice) - balA;

        uint256 balB = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(idB, exitSqrt, "");
        uint256 payoutB = usdc.balanceOf(alice) - balB;

        // Different entry prices → different IL → different payouts
        assertTrue(payoutA != payoutB, "Different adapters should yield different payouts");
        emit log_named_uint("payout A (entry 1:1)", payoutA);
        emit log_named_uint("payout B (entry 1.2:1)", payoutB);
    }

    function test_settle_tierRatios_realData() public {
        // Large premium → high maxPayout so tiers aren't capped equally
        vm.startPrank(alice);
        usdc.approve(address(core), 3_000_000e6);
        uint256 id0 = core.register(address(adapterA), 1, 0, 50_400, 1_000_000e6, address(0)); // 50%
        uint256 id1 = core.register(address(adapterA), 2, 1, 50_400, 1_000_000e6, address(0)); // 75%
        uint256 id2 = core.register(address(adapterA), 3, 2, 50_400, 1_000_000e6, address(0)); // 100%
        vm.stopPrank();

        vm.roll(block.number + 10);

        uint256 bal0 = usdc.balanceOf(alice);
        vm.prank(alice); core.settle(id0, SQRT_1_2, "");
        uint256 p0 = usdc.balanceOf(alice) - bal0;

        uint256 bal1 = usdc.balanceOf(alice);
        vm.prank(alice); core.settle(id1, SQRT_1_2, "");
        uint256 p1 = usdc.balanceOf(alice) - bal1;

        uint256 bal2 = usdc.balanceOf(alice);
        vm.prank(alice); core.settle(id2, SQRT_1_2, "");
        uint256 p2 = usdc.balanceOf(alice) - bal2;

        // 50:75:100 ratio
        assertApproxEqRel(p1 * 2, p0 * 3, 0.01e18, "75/50 ratio");
        assertApproxEqRel(p2, p0 * 2, 0.01e18, "100/50 ratio");

        emit log_named_uint("payout tier0 (50%)", p0);
        emit log_named_uint("payout tier1 (75%)", p1);
        emit log_named_uint("payout tier2 (100%)", p2);
    }

    function test_existing_functions_unchanged() public {
        vm.startPrank(alice);
        usdc.approve(address(core), 1000e6);
        uint256 id = core.register(address(adapterA), 1, 2, 50_400, 500e6, address(0));

        // topUpPremium
        usdc.approve(address(core), 100e6);
        core.topUpPremium(id, 100e6);
        vm.stopPrank();

        // processStreaming
        vm.roll(block.number + 100);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        core.processStreaming(ids);

        // cancelProtection
        uint256 balBefore = usdc.balanceOf(alice);
        vm.prank(alice);
        core.cancelProtection(id);
        uint256 refund = usdc.balanceOf(alice) - balBefore;
        assertGt(refund, 0, "cancelProtection refund > 0");
        emit log_named_uint("cancelProtection refund", refund);
    }
}
