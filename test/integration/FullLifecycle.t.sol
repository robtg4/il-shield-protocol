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

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) {
        _decimals = decimals_;
    }

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }
}

contract MockChainlinkFeed {
    int256 public price;
    uint8 public decimals_ = 8;

    constructor(int256 _price) {
        price = _price;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, block.timestamp, 1);
    }

    function decimals() external view returns (uint8) {
        return decimals_;
    }
}

contract FullLifecycleTest is Test {
    MockERC20 usdc;
    ILPNRegistry registry;
    PricingOracle oracle;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILShieldCore core;
    MockChainlinkFeed chainlinkFeed;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

    address admin = address(this);
    address alice = makeAddr("alice");
    address treasury = makeAddr("treasury");
    address referrer = makeAddr("referrer");

    function setUp() public {
        // Deploy mock USDC
        usdc = new MockERC20("USD Coin", "USDC", 6);

        // Deploy chainlink feed: ETH at $2000 (8 decimals)
        chainlinkFeed = new MockChainlinkFeed(2000e8);

        // Deploy core contracts
        registry = new ILPNRegistry(admin);
        oracle = new PricingOracle(admin);
        seniorVault = new SeniorVault(IERC20(address(usdc)), admin);
        juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), admin);
        core = new ILShieldCore(
            address(usdc),
            address(seniorVault),
            address(juniorVault),
            address(registry),
            address(oracle),
            treasury,
            admin
        );

        // Grant CORE_ROLE on registry, seniorVault, juniorVault to core
        registry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));

        // Grant KEEPER_ROLE on oracle and core to admin
        oracle.grantRole(KEEPER_ROLE, admin);
        core.grantRole(KEEPER_ROLE, admin);

        // Configure pool on oracle with high expectedVolPerLiq so feeIncome > grossIL,
        // resulting in premiumRate = 0. This avoids InsufficientPremium on registration.
        bytes32 poolId = bytes32(uint256(1));
        oracle.configurePool(poolId, address(chainlinkFeed), address(0), 0.50e18, 3000, 1e18);

        // Set warming period to 0 for simpler testing
        core.setWarmingPeriodBlocks(0);

        // Seed vaults
        address depositor = makeAddr("depositor");
        usdc.mint(depositor, 125_000e6);
        vm.startPrank(depositor);
        usdc.approve(address(seniorVault), 100_000e6);
        seniorVault.deposit(100_000e6, depositor);
        usdc.approve(address(juniorVault), 25_000e6);
        juniorVault.deposit(25_000e6, depositor);
        vm.stopPrank();

        // Fund LP (alice)
        usdc.mint(alice, 10_000e6);
    }

    /// @notice Set premiumRatePerBlock for a position via vm.store
    /// @dev positions mapping is at storage slot 2 (from forge inspect).
    ///      Position struct layout: poolId(+0), packed(+1), packed(+2),
    ///      premiumBalance(+3), premiumRatePerBlock(+4), lastPremiumBlock(+5),
    ///      maxPayout(+6), packed(+7), referrer(+8).
    function _setPositionPremiumRate(uint256 ilpnId, uint256 rate) internal {
        uint256 mappingSlot = 2;
        bytes32 baseSlot = keccak256(abi.encode(ilpnId, mappingSlot));
        bytes32 rateSlot = bytes32(uint256(baseSlot) + 4);
        vm.store(address(core), rateSlot, bytes32(rate));
    }

    function test_fullLifecycle() public {
        // ─── Step 1: Register ───────────────────────────────────────────
        uint256 positionId = 1;
        uint8 coverageTier = 2; // 100%
        uint48 durationBlocks = 216_000;
        uint256 premiumDeposit = 100e6;

        uint256 aliceBalBefore = usdc.balanceOf(alice);

        vm.startPrank(alice);
        usdc.approve(address(core), premiumDeposit);
        uint256 ilpnId = core.register(positionId, coverageTier, durationBlocks, premiumDeposit, referrer);
        vm.stopPrank();

        // Verify ILPN minted to alice
        assertEq(registry.ownerOf(ilpnId), alice);
        // Verify USDC transferred from alice
        assertEq(usdc.balanceOf(alice), aliceBalBefore - premiumDeposit);

        // ─── Step 2: Process streaming ──────────────────────────────────
        // premiumRate is 0 from oracle (feeIncome > grossIL). Set a non-zero rate
        // via storage to test streaming deduction.
        uint256 ratePerBlock = 100; // 100 wei per block (tiny, but non-zero)
        _setPositionPremiumRate(ilpnId, ratePerBlock);

        // Verify rate was set by reading it back
        (,,,,,,,,,uint256 storedRate,,,,,) = core.positions(ilpnId);
        assertEq(storedRate, ratePerBlock, "premiumRatePerBlock should be set");

        (,,,,,,,,uint256 premBalBefore,,,,,,) = core.positions(ilpnId);

        // Advance 1000 blocks
        vm.roll(block.number + 1000);

        uint256[] memory ids = new uint256[](1);
        ids[0] = ilpnId;
        core.processStreaming(ids);

        // Verify premium balance decreased
        (,,,,,,,,uint256 premBalAfter,,,,,,) = core.positions(ilpnId);
        assertLt(premBalAfter, premBalBefore, "Premium balance should decrease after streaming");

        // ─── Step 3: Settle ─────────────────────────────────────────────
        // With entrySqrtPriceX96=0 and liquidity=0, IL=0, payout=0
        // The ILPN should be burned
        uint160 exitSqrtPriceX96 = 1 << 96; // arbitrary price

        vm.prank(alice);
        core.settle(ilpnId, exitSqrtPriceX96, "");

        // Verify ILPN burned
        vm.expectRevert();
        registry.ownerOf(ilpnId);

        // Verify position is settled
        (,,,,,,,,,,,,bool settled,,) = core.positions(ilpnId);
        assertTrue(settled, "Position should be settled");
    }
}
