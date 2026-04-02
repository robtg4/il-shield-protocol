// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {ILPNRegistry} from "../../src/core/ILPNRegistry.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

contract ILPNRegistryTest is Test {
    ILPNRegistry registry;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    function setUp() public {
        registry = new ILPNRegistry(address(this));
        registry.grantRole(CORE_ROLE, address(this));
    }

    function test_mint_byCoreRole_succeeds() public {
        registry.mint(alice, 1);
        assertEq(registry.ownerOf(1), alice);
        assertEq(registry.balanceOf(alice), 1);
    }

    function test_mint_byNonCoreRole_reverts() public {
        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, CORE_ROLE)
        );
        registry.mint(alice, 1);
    }

    function test_transferFrom_reverts() public {
        registry.mint(alice, 1);

        vm.prank(alice);
        vm.expectRevert(ILPNRegistry.NonTransferable.selector);
        registry.transferFrom(alice, bob, 1);
    }

    function test_safeTransferFrom_reverts() public {
        registry.mint(alice, 1);

        vm.prank(alice);
        vm.expectRevert(ILPNRegistry.NonTransferable.selector);
        registry.safeTransferFrom(alice, bob, 1);
    }

    function test_approve_thenTransferFrom_reverts() public {
        registry.mint(alice, 1);

        // approve succeeds (ERC721 approve is not overridden)
        vm.prank(alice);
        registry.approve(bob, 1);

        // but transferFrom still reverts due to NonTransferable in _update
        vm.prank(bob);
        vm.expectRevert(ILPNRegistry.NonTransferable.selector);
        registry.transferFrom(alice, bob, 1);
    }

    function test_burn_byCoreRole_succeeds() public {
        registry.mint(alice, 1);
        assertEq(registry.balanceOf(alice), 1);

        registry.burn(1);
        assertEq(registry.balanceOf(alice), 0);

        vm.expectRevert();
        registry.ownerOf(1);
    }

    function test_burn_byNonCoreRole_reverts() public {
        registry.mint(alice, 1);

        vm.prank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, CORE_ROLE)
        );
        registry.burn(1);
    }
}
