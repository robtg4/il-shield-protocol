// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILShieldCore} from "../src/core/ILShieldCore.sol";
import {SeniorVault} from "../src/core/SeniorVault.sol";
import {JuniorVault} from "../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../src/core/PricingOracle.sol";

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

contract GasBenchmarkTest is Test {
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
    address depositor = makeAddr("depositor");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        chainlinkFeed = new MockChainlinkFeed(2000e8);

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

        registry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        oracle.grantRole(KEEPER_ROLE, admin);
        core.grantRole(KEEPER_ROLE, admin);

        // Configure pools 1..10 with high expectedVolPerLiq so premiumRate = 0
        for (uint256 i = 1; i <= 10; i++) {
            oracle.configurePool(bytes32(i), address(chainlinkFeed), address(0), 0.50e18, 3000, 1e18);
        }

        core.setWarmingPeriodBlocks(0);

        // Seed vaults
        usdc.mint(depositor, 125_000e6);
        vm.startPrank(depositor);
        usdc.approve(address(seniorVault), 100_000e6);
        seniorVault.deposit(100_000e6, depositor);
        usdc.approve(address(juniorVault), 25_000e6);
        juniorVault.deposit(25_000e6, depositor);
        vm.stopPrank();

        // Fund alice generously
        usdc.mint(alice, 100_000e6);
    }

    /// @notice Helper to register a position as alice with premiumRate = 0
    function _registerAsAlice(uint256 positionId) internal returns (uint256 ilpnId) {
        vm.startPrank(alice);
        usdc.approve(address(core), 100e6);
        ilpnId = core.register(positionId, 2, 216_000, 100e6, referrer);
        vm.stopPrank();
    }

    /// @notice Set premiumRatePerBlock for a position via vm.store
    function _setPositionPremiumRate(uint256 ilpnId, uint256 rate) internal {
        uint256 mappingSlot = 2;
        bytes32 baseSlot = keccak256(abi.encode(ilpnId, mappingSlot));
        bytes32 rateSlot = bytes32(uint256(baseSlot) + 4);
        vm.store(address(core), rateSlot, bytes32(rate));
    }

    function test_gas_register() public {
        vm.startPrank(alice);
        usdc.approve(address(core), 100e6);
        core.register(1, 2, 216_000, 100e6, referrer);
        vm.stopPrank();
    }

    function test_gas_settle_withPayout() public {
        // Since liquidity=0, IL=0, payout=0. Measures settle path with zero payout.
        uint256 ilpnId = _registerAsAlice(1);
        vm.roll(block.number + 1);

        vm.prank(alice);
        core.settle(ilpnId, 1 << 96, "");
    }

    function test_gas_settle_noPayout() public {
        // Same as above - with liquidity=0, payout is always 0
        uint256 ilpnId = _registerAsAlice(1);
        vm.roll(block.number + 1);

        vm.prank(alice);
        core.settle(ilpnId, 1 << 96, "");
    }

    function test_gas_processStreaming_single() public {
        uint256 ilpnId = _registerAsAlice(1);
        // Set a non-zero rate so streaming actually does work
        _setPositionPremiumRate(ilpnId, 100);
        vm.roll(block.number + 100);

        uint256[] memory ids = new uint256[](1);
        ids[0] = ilpnId;
        core.processStreaming(ids);
    }

    function test_gas_processStreaming_batch10() public {
        // Register 10 positions
        uint256[] memory ids = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            ids[i] = _registerAsAlice(i + 1);
            _setPositionPremiumRate(ids[i], 100);
        }

        vm.roll(block.number + 100);
        core.processStreaming(ids);
    }

    function test_gas_seniorDeposit() public {
        usdc.mint(alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(seniorVault), 1_000e6);
        seniorVault.deposit(1_000e6, alice);
        vm.stopPrank();
    }

    function test_gas_seniorWithdraw() public {
        usdc.mint(alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(seniorVault), 1_000e6);
        seniorVault.deposit(1_000e6, alice);
        vm.stopPrank();

        // Advance past lock duration (100_800 blocks)
        vm.roll(block.number + 100_801);

        vm.prank(alice);
        seniorVault.withdraw(500e6, alice, alice);
    }

    function test_gas_juniorDeposit() public {
        usdc.mint(alice, 1_000e6);
        vm.startPrank(alice);
        usdc.approve(address(juniorVault), 1_000e6);
        juniorVault.deposit(1_000e6, alice);
        vm.stopPrank();
    }

    function test_gas_juniorWithdrawForClaim() public {
        // withdrawForClaim requires CORE_ROLE
        juniorVault.grantRole(CORE_ROLE, admin);
        juniorVault.withdrawForClaim(100e6, alice);
    }
}
