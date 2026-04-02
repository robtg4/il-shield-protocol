// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {JuniorVault} from "../../src/core/JuniorVault.sol";
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

contract JuniorVaultTest is Test {
    MockERC20 usdc;
    SeniorVault seniorVault;
    JuniorVault juniorVault;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    uint256 constant JUNIOR_LOCK_BLOCKS = 216_000;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        seniorVault = new SeniorVault(IERC20(address(usdc)), address(this));
        juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), address(this));

        seniorVault.grantRole(CORE_ROLE, address(this));
        juniorVault.grantRole(CORE_ROLE, address(this));
    }

    function test_deposit_and_redeem() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(juniorVault), amount);
        uint256 shares = juniorVault.deposit(amount, alice);
        vm.stopPrank();

        assertGt(shares, 0, "Should receive shares");
        assertEq(juniorVault.balanceOf(alice), shares, "Share balance mismatch");

        // Advance past lock period
        vm.roll(block.number + JUNIOR_LOCK_BLOCKS + 1);

        vm.startPrank(alice);
        uint256 redeemed = juniorVault.redeem(shares, alice, alice);
        vm.stopPrank();

        assertEq(redeemed, amount, "Should redeem full amount");
        assertEq(usdc.balanceOf(alice), amount, "USDC not returned");
    }

    function test_withdraw_beforeLock_reverts() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(juniorVault), amount);
        juniorVault.deposit(amount, alice);

        vm.expectRevert(JuniorVault.LockActive.selector);
        juniorVault.withdraw(amount, alice, alice);
        vm.stopPrank();
    }

    function test_withdraw_afterLock_succeeds() public {
        uint256 amount = 1000e6;
        deal(address(usdc), alice, amount);

        vm.startPrank(alice);
        usdc.approve(address(juniorVault), amount);
        juniorVault.deposit(amount, alice);
        vm.stopPrank();

        vm.roll(block.number + JUNIOR_LOCK_BLOCKS + 1);

        vm.startPrank(alice);
        uint256 shares = juniorVault.withdraw(amount, alice, alice);
        vm.stopPrank();

        assertGt(shares, 0, "Should burn shares");
        assertEq(usdc.balanceOf(alice), amount, "USDC not returned");
    }

    function test_sjRatio_blocks_withdrawal() public {
        // Seed Senior with 50_000e6
        deal(address(usdc), alice, 50_000e6);
        vm.startPrank(alice);
        usdc.approve(address(seniorVault), 50_000e6);
        seniorVault.deposit(50_000e6, alice);
        vm.stopPrank();

        // Seed Junior with 10_000e6
        deal(address(usdc), bob, 50_000e6); // extra for later deposit
        vm.startPrank(bob);
        usdc.approve(address(juniorVault), 50_000e6);
        juniorVault.deposit(10_000e6, bob);
        vm.stopPrank();

        // Advance past lock
        vm.roll(block.number + JUNIOR_LOCK_BLOCKS + 1);

        // Ratio is 50_000 / 10_000 = 5:1 = 50_000 bps. Withdrawing 1e6 would make it
        // 50_000 / 9_999 > 50_000 bps. Should revert.
        vm.startPrank(bob);
        vm.expectRevert(JuniorVault.WouldBreachSJRatio.selector);
        juniorVault.withdraw(1e6, bob, bob);
        vm.stopPrank();

        // Deposit 40_000e6 more into Junior (total Junior = 50_000e6, ratio = 1:1 = 10_000 bps)
        vm.startPrank(bob);
        juniorVault.deposit(40_000e6, bob);
        vm.stopPrank();

        // Advance past lock again (deposit resets depositBlock to current block)
        // Use absolute block number to avoid via_ir optimization issues
        vm.roll(500_000);

        // Now withdraw 1e6 should succeed (ratio after = 50_000 / 49_999 ~ 10_000 bps, within limit)
        vm.startPrank(bob);
        juniorVault.withdraw(1e6, bob, bob);
        vm.stopPrank();

        assertEq(usdc.balanceOf(bob), 1e6, "Should have received 1e6 USDC");
    }

    function test_withdrawForClaim_partial() public {
        // Junior has 10_000e6
        deal(address(usdc), alice, 10_000e6);
        vm.startPrank(alice);
        usdc.approve(address(juniorVault), 10_000e6);
        juniorVault.deposit(10_000e6, alice);
        vm.stopPrank();

        // Request 15_000e6 but only 10_000e6 available
        address recipient = makeAddr("recipient");
        juniorVault.withdrawForClaim(15_000e6, recipient);

        assertEq(usdc.balanceOf(recipient), 10_000e6, "Should transfer only available amount");
        assertEq(juniorVault.totalAssets(), 0, "Junior should be empty");
    }

    function test_withdrawForClaim_access_control() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, CORE_ROLE)
        );
        juniorVault.withdrawForClaim(100e6, bob);
    }

    function test_receivePremium_access_control() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, CORE_ROLE)
        );
        juniorVault.receivePremium(100e6);
    }
}
