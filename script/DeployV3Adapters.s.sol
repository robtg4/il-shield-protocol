// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {UniswapV3Adapter} from "../src/adapters/UniswapV3Adapter.sol";
import {ILShieldCore} from "../src/core/ILShieldCore.sol";

/// @title DeployV3Adapters
/// @notice Deploy UniswapV3Adapter instances for Uni v3, SushiSwap v3, PancakeSwap v3 on Sepolia
contract DeployV3Adapters is Script {
    // Sepolia NonfungiblePositionManager addresses
    address constant UNI_V3_PM    = 0x1238536071E1c677A632429e3655c799b22cDA52;
    address constant SUSHI_V3_PM  = 0x544bA588efD839d2692Fc31EA991cD39993c135F;
    address constant PCS_V3_PM    = 0x46A15B0b27311cedF172AB29E4f4766fbE7F4364;

    // ILShieldCore V2 on Sepolia
    address constant CORE = 0xdbB160dc5f8e00A8f216042F6b1Dc16055B10722;

    function run() external {
        uint256 key = vm.envUint("DEPLOYER_PRIVATE_KEY");
        console.log("=== Deploying V3 Adapters on Sepolia ===");

        vm.startBroadcast(key);

        UniswapV3Adapter uniAdapter = new UniswapV3Adapter(UNI_V3_PM, "Uniswap v3", "uniswap-v3");
        console.log("Uniswap v3 Adapter:", address(uniAdapter));

        UniswapV3Adapter sushiAdapter = new UniswapV3Adapter(SUSHI_V3_PM, "SushiSwap v3", "sushiswap-v3");
        console.log("SushiSwap v3 Adapter:", address(sushiAdapter));

        UniswapV3Adapter pcsAdapter = new UniswapV3Adapter(PCS_V3_PM, "PancakeSwap v3", "pancakeswap-v3");
        console.log("PancakeSwap v3 Adapter:", address(pcsAdapter));

        // Approve all on ILShieldCore
        ILShieldCore core = ILShieldCore(CORE);
        core.approveAdapter(address(uniAdapter), true);
        core.approveAdapter(address(sushiAdapter), true);
        core.approveAdapter(address(pcsAdapter), true);

        vm.stopBroadcast();

        console.log("");
        console.log("=== All V3 Adapters Deployed & Approved ===");
        console.log("Uniswap v3:    ", address(uniAdapter));
        console.log("SushiSwap v3:  ", address(sushiAdapter));
        console.log("PancakeSwap v3:", address(pcsAdapter));
    }
}
