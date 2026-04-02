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

contract AdversarialTest is Test {
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
    address bob = makeAddr("bob");
    address treasury = makeAddr("treasury");
    address referrer = makeAddr("referrer");

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

        // Configure pool with high expectedVolPerLiq so premiumRate = 0
        bytes32 poolId = bytes32(uint256(1));
        oracle.configurePool(poolId, address(chainlinkFeed), address(0), 0.50e18, 3000, 1e18);

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

        // Fund alice
        usdc.mint(alice, 10_000e6);
    }

    /// @notice Helper to register a position as alice
    function _registerAsAlice(uint256 positionId, uint256 premiumDeposit) internal returns (uint256 ilpnId) {
        vm.startPrank(alice);
        usdc.approve(address(core), premiumDeposit);
        ilpnId = core.register(positionId, 2, 50_400, premiumDeposit, referrer);
        vm.stopPrank();
    }

    /// @notice Set premiumRatePerBlock for a position via vm.store
    function _setPositionPremiumRate(uint256 ilpnId, uint256 rate) internal {
        // positions mapping at slot 0 (OZ5 uses ERC-7201 namespaced storage for inherited contracts)
        uint256 mappingSlot = 2;
        bytes32 baseSlot = keccak256(abi.encode(ilpnId, mappingSlot));
        // premiumRatePerBlock is at struct offset +4 from base
        bytes32 rateSlot = bytes32(uint256(baseSlot) + 4);
        vm.store(address(core), rateSlot, bytes32(rate));
    }

    function test_doubleClaim_reverts() public {
        uint256 ilpnId = _registerAsAlice(1, 100e6);

        // Advance past warming period
        vm.roll(block.number + 1);

        uint160 exitPrice = 1 << 96;

        // First settle succeeds
        vm.prank(alice);
        core.settle(ilpnId, exitPrice, "");

        // Second settle reverts (PositionAlreadySettled)
        vm.prank(alice);
        vm.expectRevert(ILShieldCore.PositionAlreadySettled.selector);
        core.settle(ilpnId, exitPrice, "");
    }

    function test_settleExpiredProtection_succeeds() public {
        // Register with minimum duration (50_400 blocks)
        uint256 ilpnId = _registerAsAlice(1, 100e6);

        // Advance well past coverage end
        vm.roll(block.number + 200_000);

        uint160 exitPrice = 1 << 96;

        // Settle should still succeed since ILShieldCore.settle does not check CoverageExpired
        vm.prank(alice);
        core.settle(ilpnId, exitPrice, "");

        // Verify settled
        (,,,,,,,,,,,,bool settled,,) = core.positions(ilpnId);
        assertTrue(settled, "Position should be settled even after expiry");
    }

    function test_premiumExhaustion_stopsCoverage() public {
        // Register with small premium
        uint256 ilpnId = _registerAsAlice(1, 1e6);

        // Set a non-zero premium rate via storage so streaming actually deducts
        // Rate of 100 per block; 1e6 deposit / 100 = 10_000 blocks to exhaust
        _setPositionPremiumRate(ilpnId, 100);

        // Advance 20_000 blocks (well past exhaustion point)
        vm.roll(block.number + 20_000);

        uint256[] memory ids = new uint256[](1);
        ids[0] = ilpnId;
        core.processStreaming(ids);

        // Check premium balance is 0
        (,,,,,,,,uint256 premBal,,,,,,) = core.positions(ilpnId);
        assertEq(premBal, 0, "Premium balance should be exhausted");

        // Settle — IL=0 since liquidity=0, payout=0
        uint160 exitPrice = 1 << 96;
        vm.prank(alice);
        core.settle(ilpnId, exitPrice, "");

        (,,,,,,,,,,,,bool settled,,) = core.positions(ilpnId);
        assertTrue(settled, "Position should be settled after premium exhaustion");
    }

    function test_nonOwnerSettle_reverts() public {
        uint256 ilpnId = _registerAsAlice(1, 100e6);

        vm.roll(block.number + 1);

        uint160 exitPrice = 1 << 96;

        // Bob tries to settle alice's position
        vm.prank(bob);
        vm.expectRevert(ILShieldCore.NotILPNOwner.selector);
        core.settle(ilpnId, exitPrice, "");
    }

    function test_cancelThenSettle_reverts() public {
        uint256 ilpnId = _registerAsAlice(1, 100e6);

        // Alice cancels protection
        vm.prank(alice);
        core.cancelProtection(ilpnId);

        // Now try to settle — should revert (PositionAlreadySettled since cancel sets settled=true)
        vm.prank(alice);
        vm.expectRevert(ILShieldCore.PositionAlreadySettled.selector);
        core.settle(ilpnId, 1 << 96, "");
    }
}
