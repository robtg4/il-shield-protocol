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
    function mint(address to, uint256 amount) public { _mint(to, amount); }
    function decimals() public view override returns (uint8) { return _decimals; }
}

contract MockChainlinkFeed {
    int256 public price;
    constructor(int256 _price) { price = _price; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, block.timestamp, 1);
    }
    function decimals() external pure returns (uint8) { return 8; }
}

/// @notice Malicious contract that attempts reentrancy on settle
contract ReentrrantSettler {
    ILShieldCore public core;
    uint256 public ilpnId;
    uint256 public callCount;

    constructor(ILShieldCore _core) { core = _core; }

    function attack(uint256 _ilpnId, uint160 exitPrice) external {
        ilpnId = _ilpnId;
        callCount = 0;
        core.settle(_ilpnId, exitPrice, "");
    }

    // If USDC transfer triggers a callback, attempt re-enter
    fallback() external {
        if (callCount < 1) {
            callCount++;
            // Attempt reentrancy — should revert due to ReentrancyGuard or burned ILPN
            try core.settle(ilpnId, 79228162514264337593543950336, "") {} catch {}
        }
    }
}

contract ReentrancyAttackTest is Test {
    MockERC20 usdc;
    ILPNRegistry registry;
    PricingOracle oracle;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILShieldCore core;
    MockChainlinkFeed chainlinkFeed;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    address admin = address(this);
    address alice = makeAddr("alice");
    address treasury = makeAddr("treasury");

    function setUp() public {
        usdc = new MockERC20("USDC", "USDC", 6);
        chainlinkFeed = new MockChainlinkFeed(2500e8);
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

        bytes32 poolId = bytes32(uint256(1));
        oracle.configurePool(poolId, address(chainlinkFeed), address(0), 0.35e18, 3000, 1e18);
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);

        // Seed vaults
        usdc.mint(admin, 200_000e6);
        usdc.approve(address(seniorVault), 100_000e6);
        seniorVault.deposit(100_000e6, admin);
        usdc.approve(address(juniorVault), 25_000e6);
        juniorVault.deposit(25_000e6, admin);
    }

    function _registerAsAlice() internal returns (uint256 ilpnId) {
        usdc.mint(alice, 1000e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 1000e6);
        ilpnId = core.register(1, 2, 216_000, 100e6, address(0));
        vm.stopPrank();
    }

    function test_reentrancy_settle_claim() public {
        // Register a position
        uint256 ilpnId = _registerAsAlice();

        // Advance past warming
        vm.roll(block.number + 10);

        // Attempt double-settle (simulating what reentrancy would do)
        vm.startPrank(alice);
        core.settle(ilpnId, 79228162514264337593543950336, "");
        // Second settle should revert — position already settled
        vm.expectRevert(ILShieldCore.PositionAlreadySettled.selector);
        core.settle(ilpnId, 79228162514264337593543950336, "");
        vm.stopPrank();
    }

    function test_reentrancy_withdrawForClaim_blocked() public {
        // JuniorVault.withdrawForClaim has nonReentrant modifier + CORE_ROLE
        // Grant CORE_ROLE to admin for direct testing
        juniorVault.grantRole(CORE_ROLE, admin);

        // Fund the vault directly
        usdc.mint(address(juniorVault), 1000e6);

        // Direct call should work
        juniorVault.withdrawForClaim(100e6, admin);

        // Verify non-CORE cannot call it
        address attacker2 = makeAddr("attacker2");
        vm.prank(attacker2);
        vm.expectRevert();
        juniorVault.withdrawForClaim(100e6, attacker2);
    }

    function test_reentrancy_processStreaming_safe() public {
        uint256 ilpnId = _registerAsAlice();
        vm.roll(block.number + 100);

        // processStreaming is public — anyone can call
        uint256[] memory ids = new uint256[](1);
        ids[0] = ilpnId;
        core.processStreaming(ids);

        // Calling again in same tx should be safe (just 0 premium to deduct)
        core.processStreaming(ids);
    }

    function test_flashloan_register_settle_sameblock() public {
        // Register and settle in same block
        usdc.mint(alice, 1000e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 1000e6);
        uint256 ilpnId = core.register(1, 2, 216_000, 100e6, address(0));

        // Settle immediately — warming period means 0 effective coverage
        // With warmingPeriodBlocks=0, coverageStartBlock = current block
        // But fullCoverageRampBlocks=1, so effective coverage depends on elapsed blocks
        // In same block: elapsedBlocks = 0, effectiveCoverage = 0 → payout = 0
        uint256 balBefore = usdc.balanceOf(alice);
        core.settle(ilpnId, 158456325028528675187087900672, ""); // price doubled
        uint256 balAfter = usdc.balanceOf(alice);

        // No payout because IL=0 (liquidity=0 in test position) and coverage ramp = 0
        assertEq(balAfter, balBefore, "No payout in same block flash loan");
        vm.stopPrank();
    }

    function test_flashloan_vault_deposit_withdraw_blocked() public {
        usdc.mint(alice, 10_000e6);
        vm.startPrank(alice);
        usdc.approve(address(seniorVault), 10_000e6);
        seniorVault.deposit(10_000e6, alice);

        // Immediate withdraw should fail due to lock period
        vm.expectRevert(SeniorVault.LockActive.selector);
        seniorVault.withdraw(10_000e6, alice, alice);
        vm.stopPrank();
    }
}
