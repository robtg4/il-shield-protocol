// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ForkBase} from "./ForkBase.t.sol";
import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";

/// @title Phase B: ILPN Registry (B01–B07)
contract PhaseB_ILPNRegistry is ForkBase {

    function test_B01_mint_byCoreRole() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        assertEq(ilpnRegistry.ownerOf(ilpnId), alice, "B01: Alice owns ILPN");
    }

    function test_B02_mint_byNonCore_reverts() public {
        vm.prank(alice);
        vm.expectRevert();
        ilpnRegistry.mint(alice, 999);
    }

    function test_B03_transferFrom_reverts() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert();
        ilpnRegistry.transferFrom(alice, bob, ilpnId);
    }

    function test_B04_safeTransferFrom_reverts() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert();
        ilpnRegistry.safeTransferFrom(alice, bob, ilpnId);
    }

    function test_B05_burn_onSettle() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.roll(block.number + 10);
        vm.prank(alice);
        core.settle(ilpnId, 79228162514264337593543950336, "");
        vm.expectRevert();
        ilpnRegistry.ownerOf(ilpnId);
    }

    function test_B06_burn_byNonCore_reverts() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        vm.prank(alice);
        vm.expectRevert();
        ilpnRegistry.burn(ilpnId);
    }

    function test_B07_metadata_exists() public {
        uint256 ilpnId = _registerAs(alice, 100e6);
        string memory uri = ilpnRegistry.tokenURI(ilpnId);
        assertTrue(bytes(uri).length > 0, "B07: tokenURI must be non-empty");
    }
}
