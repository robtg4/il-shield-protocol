// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {ILShieldCore} from "../../src/core/ILShieldCore.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {JuniorVault} from "../../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../../src/core/PricingOracle.sol";

contract MockERC20AC is ERC20 {
    uint8 private _decimals;
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) { _decimals = decimals_; }
    function mint(address to, uint256 amount) public { _mint(to, amount); }
    function decimals() public view override returns (uint8) { return _decimals; }
}

contract MockChainlinkFeedAC {
    int256 public price;
    constructor(int256 _price) { price = _price; }
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (1, price, block.timestamp, block.timestamp, 1);
    }
    function decimals() external pure returns (uint8) { return 8; }
}

contract AccessControlAttackTest is Test {
    MockERC20AC usdc;
    ILPNRegistry registry;
    PricingOracle oracle;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILShieldCore core;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;

    address admin = address(this);
    address attacker = makeAddr("attacker");
    address treasury = makeAddr("treasury");

    function setUp() public {
        usdc = new MockERC20AC("USDC", "USDC", 6);
        MockChainlinkFeedAC feed = new MockChainlinkFeedAC(2500e8);
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

        oracle.configurePool(bytes32(uint256(1)), address(feed), address(0), 0.35e18, 3000, 1e18);
    }

    function test_nonAdmin_cannot_setWarmingPeriod() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, GOVERNANCE_ROLE));
        core.setWarmingPeriodBlocks(1);
    }

    function test_nonAdmin_cannot_setSettlementFeeRate() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, GOVERNANCE_ROLE));
        core.setSettlementFeeRate(0);
    }

    function test_nonAdmin_cannot_setPremiumShares() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, GOVERNANCE_ROLE));
        core.setPremiumShares(10000, 0, 0, 0);
    }

    function test_nonAdmin_cannot_setTreasury() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, GOVERNANCE_ROLE));
        core.setTreasury(attacker);
    }

    function test_processStreaming_isPublic() public {
        // processStreaming has no role restriction — anyone can call it
        // This is by design: keepers or users can trigger premium processing
        uint256[] memory ids = new uint256[](0);
        vm.prank(attacker);
        core.processStreaming(ids); // Should not revert — empty array, no harm
    }

    function test_nonCore_cannot_mint_ilpn() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, CORE_ROLE));
        registry.mint(attacker, 999);
    }

    function test_nonCore_cannot_burn_ilpn() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, CORE_ROLE));
        registry.burn(0);
    }

    function test_nonCore_cannot_withdrawForClaim_senior() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, CORE_ROLE));
        seniorVault.withdrawForClaim(1e6, attacker);
    }

    function test_nonCore_cannot_withdrawForClaim_junior() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, CORE_ROLE));
        juniorVault.withdrawForClaim(1e6, attacker);
    }

    function test_nonCore_cannot_receivePremium_senior() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, CORE_ROLE));
        seniorVault.receivePremium(1e6);
    }

    function test_nonCore_cannot_receivePremium_junior() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, CORE_ROLE));
        juniorVault.receivePremium(1e6);
    }

    function test_attacker_cannot_pause_core() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, GOVERNANCE_ROLE));
        core.pause();
    }

    function test_attacker_cannot_pause_seniorVault() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, GOVERNANCE_ROLE));
        seniorVault.pause();
    }

    function test_attacker_cannot_pause_juniorVault() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, GOVERNANCE_ROLE));
        juniorVault.pause();
    }

    function test_selfGrant_coreRole_fails() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, DEFAULT_ADMIN_ROLE));
        registry.grantRole(CORE_ROLE, attacker);
    }

    function test_selfGrant_governanceRole_fails() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, DEFAULT_ADMIN_ROLE));
        core.grantRole(GOVERNANCE_ROLE, attacker);
    }

    function test_oracle_updateVolatility_nonKeeper_reverts() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, KEEPER_ROLE));
        oracle.updateVolatility(bytes32(uint256(1)), 0.5e18, 0.6e18);
    }

    function test_oracle_updateTWAP_nonKeeper_reverts() public {
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, attacker, KEEPER_ROLE));
        oracle.updateTWAP(bytes32(uint256(1)), 79228162514264337593543950336);
    }
}
