// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILShieldCore} from "../../src/core/ILShieldCore.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {JuniorVault} from "../../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../../src/core/PricingOracle.sol";

contract MockERC20Oracle is ERC20 {
    uint8 private _decimals;
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) { _decimals = decimals_; }
    function mint(address to, uint256 amount) public { _mint(to, amount); }
    function decimals() public view override returns (uint8) { return _decimals; }
}

/// @notice Chainlink feed mock with controllable timestamp
contract ControllableFeed {
    int256 public price;
    uint256 public updatedAt;

    constructor(int256 _price) {
        price = _price;
        updatedAt = block.timestamp;
    }

    function setPrice(int256 _price) external {
        price = _price;
        updatedAt = block.timestamp;
    }

    function setPriceWithoutTimestamp(int256 _price) external {
        price = _price;
        // Don't update timestamp — makes it stale
    }

    function setTimestamp(uint256 _ts) external {
        updatedAt = _ts;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, updatedAt, 1);
    }

    function decimals() external pure returns (uint8) { return 8; }
}

contract OracleAttackTest is Test {
    MockERC20Oracle usdc;
    ILPNRegistry registry;
    PricingOracle oracle;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILShieldCore core;
    ControllableFeed feed;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 constant POOL_ID = bytes32(uint256(1));

    address admin = address(this);
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address treasury = makeAddr("treasury");

    function setUp() public {
        // Start at a reasonable timestamp
        vm.warp(1_700_000_000);

        usdc = new MockERC20Oracle("USDC", "USDC", 6);
        feed = new ControllableFeed(2500e8);
        registry = new ILPNRegistry(admin);
        oracle = new PricingOracle(admin);
        seniorVault = new SeniorVault(IERC20(address(usdc)), admin);
        juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), admin);
        core = new ILShieldCore(address(usdc), address(seniorVault), address(juniorVault), address(registry), address(oracle), treasury, admin);

        registry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        oracle.grantRole(KEEPER_ROLE, admin);
        core.grantRole(KEEPER_ROLE, admin);

        oracle.configurePool(POOL_ID, address(feed), address(0), 0.35e18, 3000, 1e18);
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        // Seed vaults
        usdc.mint(admin, 200_000e6);
        usdc.approve(address(seniorVault), 100_000e6);
        seniorVault.deposit(100_000e6, admin);
        usdc.approve(address(juniorVault), 25_000e6);
        juniorVault.deposit(25_000e6, admin);
    }

    function _registerAsAlice() internal returns (uint256) {
        usdc.mint(alice, 1000e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 1000e6);
        uint256 ilpnId = core.register(1, 2, 216_000, 100e6, address(0));
        vm.stopPrank();
        vm.roll(block.number + 10);
        return ilpnId;
    }

    function test_staleOracle_reverts() public {
        uint256 ilpnId = _registerAsAlice();

        // Make oracle stale: advance time by 3601 seconds without updating feed
        vm.warp(block.timestamp + 3601);

        vm.prank(alice);
        vm.expectRevert(PricingOracle.StalePrice.selector);
        core.settle(ilpnId, 79228162514264337593543950336, "");
    }

    function test_negativeOraclePrice_reverts() public {
        uint256 ilpnId = _registerAsAlice();

        // Set negative price
        feed.setPrice(-100e8);

        vm.prank(alice);
        vm.expectRevert(PricingOracle.InvalidFeed.selector);
        core.settle(ilpnId, 79228162514264337593543950336, "");
    }

    function test_zeroOraclePrice_reverts() public {
        uint256 ilpnId = _registerAsAlice();

        // Set zero price
        feed.setPrice(0);

        vm.prank(alice);
        vm.expectRevert(PricingOracle.InvalidFeed.selector);
        core.settle(ilpnId, 79228162514264337593543950336, "");
    }

    function test_twapDivergence_blocksSettlement() public {
        uint256 ilpnId = _registerAsAlice();

        // Set TWAP to a very different price (divergence > 3%)
        // Chainlink returns ~sqrtPrice for $2500
        // Set TWAP to sqrtPrice for $1000 (very different)
        uint160 twapPrice = 79228162514264337593543950336; // sqrt(1) * 2^96
        oracle.updateTWAP(POOL_ID, twapPrice);

        vm.prank(alice);
        // Should revert due to >3% divergence between Chainlink and TWAP
        vm.expectRevert(); // SettlementPriceDisputed
        core.settle(ilpnId, 79228162514264337593543950336, "");
    }

    function test_twapZero_bypasses_check() public {
        uint256 ilpnId = _registerAsAlice();

        // TWAP = 0 (default, not set) — should bypass divergence check
        // Settlement should succeed
        vm.prank(alice);
        core.settle(ilpnId, 79228162514264337593543950336, "");
        // If we get here without revert, the bypass works
    }

    function test_settlement_withExtremeHighPrice() public {
        uint256 ilpnId = _registerAsAlice();

        // Settle with near-max sqrtPriceX96
        // This shouldn't overflow in ILMath (liquidity=0, so IL=0)
        uint160 extremePrice = 1461446703485210103287273052203988822378723970342; // MAX_SQRT_RATIO
        vm.prank(alice);
        core.settle(ilpnId, extremePrice, "");
    }

    function test_settlement_withExtremeMinPrice() public {
        uint256 ilpnId = _registerAsAlice();

        // Settle with near-min sqrtPriceX96
        uint160 minPrice = 4295128739; // MIN_SQRT_RATIO
        vm.prank(alice);
        core.settle(ilpnId, minPrice, "");
    }

    function test_doubleSettle_afterBurn() public {
        uint256 ilpnId = _registerAsAlice();

        vm.startPrank(alice);
        core.settle(ilpnId, 79228162514264337593543950336, "");

        // ILPN burned — second settle should revert
        vm.expectRevert(ILShieldCore.PositionAlreadySettled.selector);
        core.settle(ilpnId, 79228162514264337593543950336, "");
        vm.stopPrank();
    }

    function test_settle_otherUsersPosition() public {
        uint256 ilpnId = _registerAsAlice();

        // Bob tries to settle Alice's position
        vm.prank(bob);
        vm.expectRevert(ILShieldCore.NotILPNOwner.selector);
        core.settle(ilpnId, 79228162514264337593543950336, "");
    }
}
