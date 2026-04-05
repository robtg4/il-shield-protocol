// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Script, console} from "forge-std/Script.sol";
import {UniswapV4Adapter} from "../src/adapters/UniswapV4Adapter.sol";
contract DeployAdapter is Script {
    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(key);
        UniswapV4Adapter adapter = new UniswapV4Adapter(
            0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4,
            0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C
        );
        console.log("UniswapV4Adapter:", address(adapter));
        vm.stopBroadcast();
    }
}
