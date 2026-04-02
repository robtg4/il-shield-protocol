// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

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

contract SeniorVaultTest is Test {
    MockERC20 usdc;
    SeniorVault vault;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    uint256 constant LOCK_BLOCKS = 100_800;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = new SeniorVault(IERC20(address(usdc)), address(this));
        vault.grantRole(CORE_ROLE, address(this));
    }

    function test_deposit_and_redeem() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);
        vm.stopPrank();

        assertGt(shares, 0, "Should receive shares");
        assertEq(vault.balanceOf(alice), shares, "Share balance mismatch");

        // Advance past lock period
        vm.roll(block.number + LOCK_BLOCKS + 1);

        vm.startPrank(alice);
        uint256 redeemed = vault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertEq(redeemed, amount, "Should redeem full amount");
        assertEq(usdc.balanceOf(alice), amount, "USDC not returned");
    }

    function test_previewDeposit_accurate() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        uint256 preview = vault.previewDeposit(amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 actual = vault.deposit(amount, alice);
        vm.stopPrank();

        assertEq(preview, actual, "previewDeposit mismatch");
    }

    function test_withdraw_beforeLock_reverts() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);

        vm.expectRevert(SeniorVault.LockActive.selector);
        vault.withdraw(amount, alice, alice);
        vm.stopPrank();
    }

    function test_withdraw_afterLock_succeeds() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, alice);
        vm.stopPrank();

        vm.roll(block.number + LOCK_BLOCKS + 1);

        vm.startPrank(alice);
        uint256 shares = vault.withdraw(amount, alice, alice);
        vm.stopPrank();

        assertGt(shares, 0, "Should burn shares");
        assertEq(usdc.balanceOf(alice), amount, "USDC not returned");
    }

    function test_emergencyWithdraw_penalty() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(vault), amount);
        uint256 shares = vault.deposit(amount, alice);

        vault.emergencyWithdraw(shares, alice);
        vm.stopPrank();

        uint256 expectedPayout = 950e6; // 5% penalty
        uint256 expectedPenalty = 50e6;

        assertEq(usdc.balanceOf(alice), expectedPayout, "Payout incorrect");
        assertEq(usdc.balanceOf(address(vault)), expectedPenalty, "Penalty not retained");
    }

    function test_withdrawForClaim_access_control() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, CORE_ROLE)
        );
        vault.withdrawForClaim(100e6, bob);
    }

    function test_receivePremium_access_control() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, CORE_ROLE)
        );
        vault.receivePremium(100e6);
    }

    function test_receivePremium_increases_assets() public {
        // Deposit first
        uint256 depositAmount = 1000e6;
        deal(address(usdc), alice, depositAmount);

        vm.startPrank(alice);
        usdc.approve(address(vault), depositAmount);
        vault.deposit(depositAmount, alice);
        vm.stopPrank();

        uint256 assetsBefore = vault.totalAssets();

        // Send premium
        uint256 premiumAmount = 100e6;
        deal(address(usdc), address(this), premiumAmount);
        usdc.approve(address(vault), premiumAmount);
        vault.receivePremium(premiumAmount);

        uint256 assetsAfter = vault.totalAssets();
        assertEq(assetsAfter, assetsBefore + premiumAmount, "totalAssets should increase by premium");
    }
}
