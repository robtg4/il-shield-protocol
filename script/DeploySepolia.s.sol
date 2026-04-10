// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ILShieldCore} from "../src/core/ILShieldCore.sol";
import {SeniorVault} from "../src/core/SeniorVault.sol";
import {JuniorVault} from "../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../src/core/PricingOracle.sol";

/// @notice Simple mock USDC for Sepolia (no USDC deployed on Sepolia by default)
contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

/// @title DeploySepolia
/// @notice Full deployment to Ethereum Sepolia with LIVE Chainlink + Uniswap v4
/// @dev This is the primary testnet deployment — real oracle, real v4 PoolManager
contract DeploySepolia is Script {
    // Live Sepolia addresses
    address constant CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant V4_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant V4_POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== IL Shield Ethereum Sepolia Deployment ===");
        console.log("Deployer:", deployer);
        console.log("Chainlink ETH/USD:", CHAINLINK_ETH_USD);
        console.log("V4 PoolManager:", V4_POOL_MANAGER);

        vm.startBroadcast(deployerKey);

        // 1. Deploy TestUSDC (Sepolia doesn't have a standard USDC)
        TestUSDC usdc = new TestUSDC();
        console.log("TestUSDC:", address(usdc));

        // Mint initial supply to deployer for vault seeding
        usdc.mint(deployer, 10_000_000e6); // 10M USDC

        // 2. Deploy ILPNRegistry
        ILPNRegistry ilpnRegistry = new ILPNRegistry(deployer);
        console.log("ILPNRegistry:", address(ilpnRegistry));

        // 3. Deploy PricingOracle
        PricingOracle pricingOracle = new PricingOracle(deployer);
        console.log("PricingOracle:", address(pricingOracle));

        // 4. Deploy SeniorVault
        SeniorVault seniorVault = new SeniorVault(IERC20(address(usdc)), deployer);
        console.log("SeniorVault:", address(seniorVault));

        // 5. Deploy JuniorVault
        JuniorVault juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), deployer);
        console.log("JuniorVault:", address(juniorVault));

        // 6. Deploy ILShieldCore
        ILShieldCore core = new ILShieldCore(
            address(usdc),
            address(seniorVault),
            address(juniorVault),
            address(ilpnRegistry),
            address(pricingOracle),
            deployer, // treasury
            deployer  // admin
        );
        console.log("ILShieldCore:", address(core));

        // 7. Grant roles
        bytes32 CORE_ROLE = keccak256("CORE_ROLE");
        bytes32 KEEPER_ROLE = keccak256("KEEPER_ROLE");

        ilpnRegistry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        pricingOracle.grantRole(KEEPER_ROLE, deployer);
        core.grantRole(KEEPER_ROLE, deployer);

        // 8. Configure ETH/USDC pool with LIVE Chainlink feed
        bytes32 ethUsdcPool = bytes32(uint256(1));
        pricingOracle.configurePool(
            ethUsdcPool,
            CHAINLINK_ETH_USD,
            address(0),
            0.70e18,            // 70% vol floor (realistic ETH realized vol)
            3000,               // 0.30% fee tier
            0                   // no fee income offset → full IL pricing
        );

        // 9. Testnet-friendly parameters
        core.setWarmingPeriodBlocks(10);       // ~2 min
        core.setFullCoverageRampBlocks(50);    // ~10 min
        seniorVault.setMinLockDuration(10);
        juniorVault.setMinLockDuration(20);

        // 10. Seed vaults
        usdc.approve(address(seniorVault), 5_000_000e6);
        seniorVault.deposit(5_000_000e6, deployer);

        usdc.approve(address(juniorVault), 1_000_000e6);
        juniorVault.deposit(1_000_000e6, deployer);

        // 11. Mint USDC to deployer for testing
        usdc.mint(deployer, 1_000_000e6); // Extra 1M for LP testing

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("TestUSDC:          ", address(usdc));
        console.log("ILPNRegistry:      ", address(ilpnRegistry));
        console.log("PricingOracle:     ", address(pricingOracle));
        console.log("SeniorVault:       ", address(seniorVault));
        console.log("JuniorVault:       ", address(juniorVault));
        console.log("ILShieldCore:      ", address(core));
        console.log("Senior TVL:         5,000,000 USDC");
        console.log("Junior TVL:         1,000,000 USDC");
        console.log("Chainlink:          LIVE ETH/USD");
        console.log("V4 PoolManager:    ", V4_POOL_MANAGER);
    }
}
