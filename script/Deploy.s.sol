// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILShieldCore} from "../src/core/ILShieldCore.sol";
import {SeniorVault} from "../src/core/SeniorVault.sol";
import {JuniorVault} from "../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../src/core/PricingOracle.sol";

/// @title Deploy
/// @notice Full deployment script for IL Shield Protocol
contract Deploy is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envOr("TREASURY_ADDRESS", deployer);
        address chainlinkEthUsd = vm.envOr("CHAINLINK_ETH_USD", address(0));

        console.log("Deploying IL Shield Protocol...");
        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);
        console.log("Treasury:", treasury);

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        // 1. Deploy ILPNRegistry
        ILPNRegistry ilpnRegistry = new ILPNRegistry(deployer);
        console.log("ILPNRegistry:", address(ilpnRegistry));

        // 2. Deploy PricingOracle
        PricingOracle pricingOracle = new PricingOracle(deployer);
        console.log("PricingOracle:", address(pricingOracle));

        // 3. Deploy SeniorVault
        SeniorVault seniorVault = new SeniorVault(IERC20(usdc), deployer);
        console.log("SeniorVault:", address(seniorVault));

        // 4. Deploy JuniorVault
        JuniorVault juniorVault = new JuniorVault(IERC20(usdc), address(seniorVault), deployer);
        console.log("JuniorVault:", address(juniorVault));

        // 5. Deploy ILShieldCore
        ILShieldCore core = new ILShieldCore(
            usdc,
            address(seniorVault),
            address(juniorVault),
            address(ilpnRegistry),
            address(pricingOracle),
            treasury,
            deployer
        );
        console.log("ILShieldCore:", address(core));

        // 6. Grant CORE_ROLE
        bytes32 CORE_ROLE = keccak256("CORE_ROLE");
        ilpnRegistry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));

        // 7. Grant KEEPER_ROLE on oracle
        bytes32 KEEPER_ROLE = keccak256("KEEPER_ROLE");
        pricingOracle.grantRole(KEEPER_ROLE, deployer);
        core.grantRole(KEEPER_ROLE, deployer);

        // 8. Configure ETH/USDC pool on oracle if Chainlink feed provided
        if (chainlinkEthUsd != address(0)) {
            bytes32 ethUsdcPool = keccak256("ETH/USDC");
            pricingOracle.configurePool(
                ethUsdcPool,
                chainlinkEthUsd,
                address(0),
                0.70e18,    // 70% vol floor (realistic ETH)
                3000,       // 0.30% fee tier
                0           // no fee income offset → full IL pricing
            );
            console.log("Configured ETH/USDC pool oracle");
        }

        vm.stopBroadcast();

        console.log("\n=== Deployment Complete ===");
        console.log("ILPNRegistry:  ", address(ilpnRegistry));
        console.log("PricingOracle: ", address(pricingOracle));
        console.log("SeniorVault:   ", address(seniorVault));
        console.log("JuniorVault:   ", address(juniorVault));
        console.log("ILShieldCore:  ", address(core));
    }
}
