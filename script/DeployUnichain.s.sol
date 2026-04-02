// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ILShieldCore} from "../src/core/ILShieldCore.sol";
import {SeniorVault} from "../src/core/SeniorVault.sol";
import {JuniorVault} from "../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../src/core/PricingOracle.sol";

/// @notice Mock Chainlink feed for Unichain Sepolia (no real Chainlink on this chain)
contract MockChainlinkFeed {
    int256 public price;
    uint8 public constant decimals = 8;

    constructor(int256 _price) {
        price = _price;
    }

    function latestRoundData()
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        return (1, price, block.timestamp, block.timestamp, 1);
    }

    function setPrice(int256 _price) external {
        price = _price;
    }
}

/// @title DeployUnichain
/// @notice Full deployment to Unichain Sepolia with mock oracle
contract DeployUnichain is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address usdc = vm.envAddress("USDC_ADDRESS");

        console.log("=== IL Shield Unichain Sepolia Deployment ===");
        console.log("Deployer:", deployer);
        console.log("USDC:", usdc);

        vm.startBroadcast(deployerKey);

        // 1. Deploy Mock Chainlink Feed (ETH/USD at $2500)
        MockChainlinkFeed mockFeed = new MockChainlinkFeed(2500_00000000); // $2500 with 8 decimals
        console.log("MockChainlinkFeed:", address(mockFeed));

        // 2. Deploy ILPNRegistry
        ILPNRegistry ilpnRegistry = new ILPNRegistry(deployer);
        console.log("ILPNRegistry:", address(ilpnRegistry));

        // 3. Deploy PricingOracle
        PricingOracle pricingOracle = new PricingOracle(deployer);
        console.log("PricingOracle:", address(pricingOracle));

        // 4. Deploy SeniorVault
        SeniorVault seniorVault = new SeniorVault(IERC20(usdc), deployer);
        console.log("SeniorVault:", address(seniorVault));

        // 5. Deploy JuniorVault
        JuniorVault juniorVault = new JuniorVault(IERC20(usdc), address(seniorVault), deployer);
        console.log("JuniorVault:", address(juniorVault));

        // 6. Deploy ILShieldCore
        ILShieldCore core = new ILShieldCore(
            usdc,
            address(seniorVault),
            address(juniorVault),
            address(ilpnRegistry),
            address(pricingOracle),
            deployer, // treasury = deployer for testnet
            deployer
        );
        console.log("ILShieldCore:", address(core));

        // 7. Grant roles
        bytes32 CORE_ROLE = keccak256("CORE_ROLE");
        bytes32 KEEPER_ROLE = keccak256("KEEPER_ROLE");
        bytes32 GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");

        ilpnRegistry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        pricingOracle.grantRole(KEEPER_ROLE, deployer);
        core.grantRole(KEEPER_ROLE, deployer);

        // 8. Configure ETH/USDC pool on oracle with mock feed
        bytes32 ethUsdcPool = bytes32(uint256(1)); // positionId=1 maps to this poolId
        pricingOracle.configurePool(
            ethUsdcPool,
            address(mockFeed),  // Mock Chainlink
            address(0),         // No TWAP source yet
            0.35e18,            // 35% vol floor for ETH
            3000,               // 0.30% fee tier
            1e18                // High vol/liq to make premiumRate=0 (fees > IL)
        );

        // 9. Adjust parameters for testnet (shorter timings)
        core.setWarmingPeriodBlocks(10);        // ~2 minutes instead of 48 hours
        core.setFullCoverageRampBlocks(50);     // ~10 minutes instead of 7 days

        // Reduce vault lock periods for testing
        seniorVault.setMinLockDuration(10);     // ~2 minutes
        juniorVault.setMinLockDuration(20);     // ~4 minutes

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("MockChainlinkFeed:", address(mockFeed));
        console.log("ILPNRegistry:     ", address(ilpnRegistry));
        console.log("PricingOracle:    ", address(pricingOracle));
        console.log("SeniorVault:      ", address(seniorVault));
        console.log("JuniorVault:      ", address(juniorVault));
        console.log("ILShieldCore:     ", address(core));
        console.log("");
        console.log("Pool configured:   ETH/USDC (poolId=bytes32(1))");
        console.log("Warming period:    10 blocks (~2 min)");
        console.log("Coverage ramp:     50 blocks (~10 min)");
    }
}
