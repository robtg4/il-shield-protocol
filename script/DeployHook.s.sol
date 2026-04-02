// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {ILShieldHook} from "../src/hook/ILShieldHook.sol";
import {TickAccumulator} from "../src/hook/TickAccumulator.sol";

/// @title DeployHook
/// @notice Deploys IL Shield Hook with CREATE2 salt mining for correct address prefix
contract DeployHook is Script {
    /// @notice Required hook permission flags
    /// afterInitialize | afterAddLiquidity | beforeRemoveLiquidity | afterRemoveLiquidity | afterSwap
    /// | afterAddLiquidityReturnDelta | afterRemoveLiquidityReturnDelta
    uint160 constant REQUIRED_FLAGS =
        Hooks.AFTER_INITIALIZE_FLAG |
        Hooks.AFTER_ADD_LIQUIDITY_FLAG |
        Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG |
        Hooks.AFTER_REMOVE_LIQUIDITY_FLAG |
        Hooks.AFTER_SWAP_FLAG |
        Hooks.AFTER_ADD_LIQUIDITY_RETURNS_DELTA_FLAG |
        Hooks.AFTER_REMOVE_LIQUIDITY_RETURNS_DELTA_FLAG;

    function run() external {
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address poolManager = vm.envAddress("POOL_MANAGER");
        address ilShieldCore = vm.envAddress("IL_SHIELD_CORE");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        // Deploy TickAccumulator first (address doesn't matter)
        // Use a placeholder — actual hook address set after mining
        TickAccumulator tickAccumulator = new TickAccumulator(address(0));
        console.log("TickAccumulator (placeholder):", address(tickAccumulator));

        // Mine CREATE2 salt for correct hook address
        bytes memory creationCode = abi.encodePacked(
            type(ILShieldHook).creationCode,
            abi.encode(IPoolManager(poolManager), tickAccumulator, ilShieldCore)
        );

        (address hookAddress, bytes32 salt) = _mineSalt(deployer, creationCode);
        console.log("Mined hook address:", hookAddress);
        console.log("Salt:", vm.toString(salt));

        // Deploy hook at mined address
        ILShieldHook hook;
        assembly {
            hook := create2(0, add(creationCode, 0x20), mload(creationCode), salt)
        }
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("ILShieldHook deployed at:", address(hook));

        // Redeploy TickAccumulator with correct hook address
        TickAccumulator finalAccumulator = new TickAccumulator(address(hook));
        console.log("TickAccumulator (final):", address(finalAccumulator));

        vm.stopBroadcast();
    }

    /// @notice Mine a CREATE2 salt that produces an address with required hook flags
    function _mineSalt(address deployer, bytes memory creationCode)
        internal
        pure
        returns (address hookAddress, bytes32 salt)
    {
        bytes32 initCodeHash = keccak256(creationCode);

        for (uint256 i = 0; i < 100_000; i++) {
            salt = bytes32(i);
            hookAddress = _computeCreate2Address(deployer, salt, initCodeHash);

            // Check if the address has the correct flag bits set
            if (_hasRequiredFlags(hookAddress)) {
                return (hookAddress, salt);
            }
        }
        revert("Could not find valid salt in 100000 iterations");
    }

    function _computeCreate2Address(address deployer, bytes32 salt, bytes32 initCodeHash)
        internal
        pure
        returns (address)
    {
        return address(
            uint160(
                uint256(keccak256(abi.encodePacked(bytes1(0xff), deployer, salt, initCodeHash)))
            )
        );
    }

    function _hasRequiredFlags(address addr) internal pure returns (bool) {
        uint160 flags = uint160(addr) & Hooks.ALL_HOOK_MASK;
        // All required flags must be set, and no disallowed flags
        return (flags & REQUIRED_FLAGS) == REQUIRED_FLAGS;
    }
}
