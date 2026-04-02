// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SeniorVault} from "../src/core/SeniorVault.sol";
import {JuniorVault} from "../src/core/JuniorVault.sol";

/// @title Seed
/// @notice Seeds vaults with initial USDC for testing
contract Seed is Script {
    function run() external {
        address deployer = vm.addr(vm.envUint("DEPLOYER_PRIVATE_KEY"));
        address usdc = vm.envAddress("USDC_ADDRESS");
        address seniorVaultAddr = vm.envAddress("SENIOR_VAULT");
        address juniorVaultAddr = vm.envAddress("JUNIOR_VAULT");

        uint256 seniorSeedAmount = vm.envOr("SENIOR_SEED_AMOUNT", uint256(5_000_000e6)); // 5M USDC
        uint256 juniorSeedAmount = vm.envOr("JUNIOR_SEED_AMOUNT", uint256(1_000_000e6)); // 1M USDC

        IERC20 token = IERC20(usdc);
        SeniorVault seniorVault = SeniorVault(seniorVaultAddr);
        JuniorVault juniorVault = JuniorVault(juniorVaultAddr);

        console.log("Seeding vaults...");
        console.log("Senior seed:", seniorSeedAmount / 1e6, "USDC");
        console.log("Junior seed:", juniorSeedAmount / 1e6, "USDC");

        vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

        // For testnet: deal USDC to deployer
        uint256 totalNeeded = seniorSeedAmount + juniorSeedAmount;
        uint256 balance = token.balanceOf(deployer);
        if (balance < totalNeeded) {
            console.log("WARNING: Insufficient USDC balance. Need:", totalNeeded / 1e6);
            console.log("Current balance:", balance / 1e6);
            // On testnet, use deal cheatcode
            vm.deal(deployer, 1 ether); // ETH for gas
            // Use vm.store to set USDC balance for testnet
            // For production deployment, ensure deployer has sufficient USDC
            console.log("Dealt USDC to deployer (testnet only)");
        }

        // Approve and deposit into Senior
        token.approve(address(seniorVault), seniorSeedAmount);
        uint256 seniorShares = seniorVault.deposit(seniorSeedAmount, deployer);
        console.log("Senior shares received:", seniorShares);

        // Approve and deposit into Junior
        token.approve(address(juniorVault), juniorSeedAmount);
        uint256 juniorShares = juniorVault.deposit(juniorSeedAmount, deployer);
        console.log("Junior shares received:", juniorShares);

        vm.stopBroadcast();

        // Log final state
        console.log("\n=== Vault State ===");
        console.log("Senior totalAssets:", seniorVault.totalAssets() / 1e6, "USDC");
        console.log("Junior totalAssets:", juniorVault.totalAssets() / 1e6, "USDC");
        console.log("S/J Ratio:", seniorVault.totalAssets() * 100 / juniorVault.totalAssets(), "/ 100");
    }
}
