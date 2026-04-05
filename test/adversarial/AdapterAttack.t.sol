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

contract MockUSDC is ERC20 {
    constructor() ERC20("USDC", "USDC") {}
    function mint(address to, uint256 a) external { _mint(to, a); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MockFeed {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, 2500e8, block.timestamp, block.timestamp, 1);
    }
    function decimals() external pure returns (uint8) { return 8; }
}

/// @notice Legitimate adapter that returns valid position data
contract GoodAdapter is IPositionAdapter {
    function getPosition(uint256) external pure override returns (PositionData memory) {
        return PositionData({
            sqrtPriceX96: 79228162514264337593543950336,
            tickLower: -6000,
            tickUpper: 6000,
            liquidity: 1e15,
            token0: address(0x1),
            token1: address(0x2),
            feeRate: 3000,
            pool: address(0x999)
        });
    }
    function getPoolPrice(address) external pure override returns (uint160) { return 79228162514264337593543950336; }
    function dexName() external pure override returns (string memory) { return "Good"; }
    function dexId() external pure override returns (string memory) { return "good"; }
}

/// @notice Malicious adapter that inflates liquidity to drain vaults
contract InflatedLiquidityAdapter is IPositionAdapter {
    function getPosition(uint256) external pure override returns (PositionData memory) {
        return PositionData({
            sqrtPriceX96: 79228162514264337593543950336,
            tickLower: -6000,
            tickUpper: 6000,
            liquidity: type(uint128).max, // MAX liquidity to inflate IL
            token0: address(0x1),
            token1: address(0x2),
            feeRate: 3000,
            pool: address(0x999)
        });
    }
    function getPoolPrice(address) external pure override returns (uint160) { return 79228162514264337593543950336; }
    function dexName() external pure override returns (string memory) { return "Evil"; }
    function dexId() external pure override returns (string memory) { return "evil"; }
}

/// @notice Adapter that returns zero liquidity (empty position)
contract EmptyAdapter is IPositionAdapter {
    function getPosition(uint256) external pure override returns (PositionData memory) {
        return PositionData({
            sqrtPriceX96: 0,
            tickLower: 0,
            tickUpper: 0,
            liquidity: 0,
            token0: address(0),
            token1: address(0),
            feeRate: 0,
            pool: address(0)
        });
    }
    function getPoolPrice(address) external pure override returns (uint160) { return 0; }
    function dexName() external pure override returns (string memory) { return "Empty"; }
    function dexId() external pure override returns (string memory) { return "empty"; }
}

/// @notice Adapter that reverts on getPosition (simulates unavailable DEX)
contract RevertingAdapter is IPositionAdapter {
    function getPosition(uint256) external pure override returns (PositionData memory) {
        revert("DEX unavailable");
    }
    function getPoolPrice(address) external pure override returns (uint160) { revert("DEX unavailable"); }
    function dexName() external pure override returns (string memory) { return "Reverting"; }
    function dexId() external pure override returns (string memory) { return "revert"; }
}

/// @notice Adapter that returns manipulated entry price (stale/fake price)
contract ManipulatedPriceAdapter is IPositionAdapter {
    function getPosition(uint256) external pure override returns (PositionData memory) {
        return PositionData({
            sqrtPriceX96: 1, // Near-zero price → massive IL on any real exit
            tickLower: -6000,
            tickUpper: 6000,
            liquidity: 1e15,
            token0: address(0x1),
            token1: address(0x2),
            feeRate: 3000,
            pool: address(0x999)
        });
    }
    function getPoolPrice(address) external pure override returns (uint160) { return 1; }
    function dexName() external pure override returns (string memory) { return "Manipulated"; }
    function dexId() external pure override returns (string memory) { return "manipulated"; }
}

/// @title AdapterAttackTest — Adversarial tests for multi-DEX adapter pattern
contract AdapterAttackTest is Test {
    MockUSDC usdc;
    ILShieldCore core;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILPNRegistry registry;
    PricingOracle oracle;
    MockFeed feed;

    GoodAdapter goodAdapter;
    InflatedLiquidityAdapter inflatedAdapter;
    EmptyAdapter emptyAdapter;
    RevertingAdapter revertingAdapter;
    ManipulatedPriceAdapter manipulatedAdapter;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    address alice = address(0xA11CE);
    address attacker = address(0xBAD);
    address treasury = address(0x7EA5);

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        feed = new MockFeed();
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

        // Configure oracle for adapter pool 0x999 and legacy pool bytes32(1)
        bytes32 poolId = bytes32(uint256(uint160(address(0x999))));
        oracle.configurePool(poolId, address(feed), address(0), 0.35e18, 3000, 1e18);
        oracle.configurePool(bytes32(uint256(1)), address(feed), address(0), 0.35e18, 3000, 1e18);

        // Seed vaults
        usdc.mint(address(this), 100_000_000e6);
        usdc.approve(address(seniorVault), 50_000_000e6);
        seniorVault.deposit(50_000_000e6, address(this));
        usdc.approve(address(juniorVault), 10_000_000e6);
        juniorVault.deposit(10_000_000e6, address(this));

        // Fund alice and attacker
        usdc.mint(alice, 10_000_000e6);
        usdc.mint(attacker, 10_000_000e6);

        // Deploy adapters
        goodAdapter = new GoodAdapter();
        inflatedAdapter = new InflatedLiquidityAdapter();
        emptyAdapter = new EmptyAdapter();
        revertingAdapter = new RevertingAdapter();
        manipulatedAdapter = new ManipulatedPriceAdapter();

        // Only approve the good adapter
        core.approveAdapter(address(goodAdapter), true);
    }

    // ═══ Access Control ═══

    function test_unapprovedAdapter_reverts() public {
        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert(ILShieldCore.AdapterNotApproved.selector);
        core.register(address(inflatedAdapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();
    }

    function test_nonGovernance_cannotApproveAdapter() public {
        vm.prank(attacker);
        vm.expectRevert();
        core.approveAdapter(address(inflatedAdapter), true);
    }

    function test_approveAdapter_thenRevoke() public {
        core.approveAdapter(address(inflatedAdapter), true);
        assertTrue(core.approvedAdapters(address(inflatedAdapter)));

        core.approveAdapter(address(inflatedAdapter), false);
        assertFalse(core.approvedAdapters(address(inflatedAdapter)));

        // Can no longer register with revoked adapter
        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert(ILShieldCore.AdapterNotApproved.selector);
        core.register(address(inflatedAdapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();
    }

    function test_zeroAddressAdapter_reverts() public {
        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert(ILShieldCore.AdapterNotApproved.selector);
        core.register(address(0), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();
    }

    // ═══ Malicious Adapter Exploits ═══

    function test_inflatedLiquidity_cappedByMaxPayout() public {
        // Even if an attacker gets their adapter approved, maxPayout caps the damage
        core.approveAdapter(address(inflatedAdapter), true);
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        uint256 id = core.register(address(inflatedAdapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 10);
        uint256 juniorBefore = juniorVault.totalAssets();
        uint256 bal = usdc.balanceOf(alice);

        vm.prank(alice);
        core.settle(id, 86787299046364038601618741436, ""); // 20% price move

        uint256 payout = usdc.balanceOf(alice) - bal;
        // maxPayout = 500e6 * 10 = 5000e6, minus 2% fee = 4900e6
        assertLe(payout, 5000e6, "Payout must be capped by maxPayout (10x premium)");
        console.log("Inflated liquidity payout (capped):", payout);
    }

    function test_emptyPosition_reverts() public {
        core.approveAdapter(address(emptyAdapter), true);

        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert(ILShieldCore.EmptyPosition.selector);
        core.register(address(emptyAdapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();
    }

    function test_revertingAdapter_bubblesUp() public {
        core.approveAdapter(address(revertingAdapter), true);

        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        vm.expectRevert("DEX unavailable");
        core.register(address(revertingAdapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();
    }

    function test_manipulatedEntryPrice_limitedByMaxPayout() public {
        // Attacker sets entry price to near-zero → IL would be astronomical
        // But maxPayout caps it
        core.approveAdapter(address(manipulatedAdapter), true);
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        uint256 id = core.register(address(manipulatedAdapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 10);
        uint256 bal = usdc.balanceOf(alice);
        vm.prank(alice);
        core.settle(id, 79228162514264337593543950336, ""); // settle at real price

        uint256 payout = usdc.balanceOf(alice) - bal;
        assertLe(payout, 5000e6, "Manipulated price payout still capped at 10x premium");
        console.log("Manipulated price payout (capped):", payout);
    }

    // ═══ Good Adapter — Happy Path ═══

    function test_goodAdapter_registerAndSettle() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        uint256 id = core.register(address(goodAdapter), 1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        // Verify position was populated from adapter
        (
            bytes32 poolId,
            uint160 entrySqrt,
            int24 tl,
            int24 tu,
            uint128 liq,
            ,,,,,,,,,
        ) = core.positions(id);

        assertEq(entrySqrt, 79228162514264337593543950336, "Entry price from adapter");
        assertEq(tl, -6000, "tickLower from adapter");
        assertEq(tu, 6000, "tickUpper from adapter");
        assertEq(liq, 1e15, "Liquidity from adapter");
        assertEq(poolId, bytes32(uint256(uint160(address(0x999)))), "Pool from adapter");

        // Settle
        vm.roll(block.number + 10);
        vm.prank(alice);
        core.settle(id, 79228162514264337593543950336, ""); // same price, IL=0
        console.log("Good adapter register + settle: PASS");
    }

    // ═══ Cross-DEX Independence ═══

    function test_crossDex_independentPositions() public {
        // Register from two different "adapters" and verify independent settlement
        GoodAdapter adapter2 = new GoodAdapter();
        core.approveAdapter(address(adapter2), true);
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        vm.startPrank(alice);
        usdc.approve(address(core), 1000e6);
        uint256 id1 = core.register(address(goodAdapter), 1, 2, 50_400, 500e6, address(0));
        uint256 id2 = core.register(address(adapter2), 2, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        assertTrue(id1 != id2, "IDs must differ");

        vm.roll(block.number + 10);

        // Settle first — second unaffected
        vm.prank(alice);
        core.settle(id1, 79228162514264337593543950336, "");

        // Second still active
        (,,,,,,,,,,,, bool settled1,,) = core.positions(id1);
        (,,,,,,,,,,,, bool settled2,,) = core.positions(id2);
        assertTrue(settled1, "Position 1 settled");
        assertFalse(settled2, "Position 2 still active");

        // Settle second
        vm.prank(alice);
        core.settle(id2, 79228162514264337593543950336, "");
        (,,,,,,,,,,,, bool settled2After,,) = core.positions(id2);
        assertTrue(settled2After, "Position 2 now settled");
        console.log("Cross-DEX independence: PASS");
    }

    // ═══ Legacy register still works ═══

    function test_legacyRegister_stillWorks() public {
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        vm.startPrank(alice);
        usdc.approve(address(core), 500e6);
        uint256 id = core.register(1, 2, 50_400, 500e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 10);
        vm.prank(alice);
        core.settle(id, 79228162514264337593543950336, "");
        console.log("Legacy register: PASS");
    }
}
