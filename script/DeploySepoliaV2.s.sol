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
import {UniswapV4Adapter} from "../src/adapters/UniswapV4Adapter.sol";

contract TestUSDC is ERC20 {
    constructor() ERC20("Test USDC", "USDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

/// @title DeploySepoliaV2
/// @notice Full redeploy to Sepolia with adapter support
contract DeploySepoliaV2 is Script {
    address constant CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant V4_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant V4_POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant V4_STATE_VIEW = 0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        console.log("=== IL Shield Sepolia V2 Deployment (with Adapters) ===");
        console.log("Deployer:", deployer);

        vm.startBroadcast(deployerKey);

        // 1. Deploy TestUSDC
        TestUSDC usdc = new TestUSDC();
        usdc.mint(deployer, 10_000_000e6);
        console.log("TestUSDC:", address(usdc));

        // 2. Deploy core infrastructure
        ILPNRegistry ilpnRegistry = new ILPNRegistry(deployer);
        PricingOracle pricingOracle = new PricingOracle(deployer);
        SeniorVault seniorVault = new SeniorVault(IERC20(address(usdc)), deployer);
        JuniorVault juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), deployer);

        console.log("ILPNRegistry:", address(ilpnRegistry));
        console.log("PricingOracle:", address(pricingOracle));
        console.log("SeniorVault:", address(seniorVault));
        console.log("JuniorVault:", address(juniorVault));

        // 3. Deploy ILShieldCore (new version with adapter support)
        ILShieldCore core = new ILShieldCore(
            address(usdc),
            address(seniorVault),
            address(juniorVault),
            address(ilpnRegistry),
            address(pricingOracle),
            deployer,
            deployer
        );
        console.log("ILShieldCore:", address(core));

        // 4. Deploy UniswapV4Adapter
        UniswapV4Adapter v4Adapter = new UniswapV4Adapter(V4_POSITION_MANAGER, V4_STATE_VIEW);
        console.log("UniswapV4Adapter:", address(v4Adapter));

        // 5. Grant roles
        bytes32 CORE_ROLE = keccak256("CORE_ROLE");
        bytes32 KEEPER_ROLE = keccak256("KEEPER_ROLE");

        ilpnRegistry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        pricingOracle.grantRole(KEEPER_ROLE, deployer);
        core.grantRole(KEEPER_ROLE, deployer);

        // 6. Approve adapter
        core.approveAdapter(address(v4Adapter), true);
        console.log("V4 Adapter approved");

        // 7. Configure ETH/USDC pool
        // 7b. Configure ETH/USDC pool — mainnet-ready pricing
        bytes32 ethUsdcPool = bytes32(uint256(1));
        pricingOracle.configurePool(
            ethUsdcPool,
            CHAINLINK_ETH_USD,
            address(0),
            0.70e18,            // 70% vol floor (realistic ETH 30-day realized vol)
            3000,               // 0.30% fee tier
            0                   // expectedVolPerLiq = 0 → no fee income offset → full IL pricing
        );

        // 8. Testnet parameters (shorter timings for faster iteration)
        core.setWarmingPeriodBlocks(10);       // ~2 min (mainnet: 14400 = ~48h)
        core.setFullCoverageRampBlocks(50);    // ~10 min (mainnet: 50400 = ~7d)
        seniorVault.setMinLockDuration(10);    // ~2 min (mainnet: 100800 = ~14d)
        juniorVault.setMinLockDuration(20);    // ~4 min (mainnet: 201600 = ~28d)

        // 9. Seed vaults
        usdc.approve(address(seniorVault), 5_000_000e6);
        seniorVault.deposit(5_000_000e6, deployer);
        usdc.approve(address(juniorVault), 1_000_000e6);
        juniorVault.deposit(1_000_000e6, deployer);

        // 10. Extra USDC for testing
        usdc.mint(deployer, 1_000_000e6);

        vm.stopBroadcast();

        console.log("");
        console.log("=== V2 Deployment Complete ===");
        console.log("TestUSDC:           ", address(usdc));
        console.log("ILPNRegistry:       ", address(ilpnRegistry));
        console.log("PricingOracle:      ", address(pricingOracle));
        console.log("SeniorVault:        ", address(seniorVault));
        console.log("JuniorVault:        ", address(juniorVault));
        console.log("ILShieldCore:       ", address(core));
        console.log("UniswapV4Adapter:   ", address(v4Adapter));
        console.log("Chainlink:           LIVE ETH/USD");
        console.log("Senior TVL:          5,000,000 USDC");
        console.log("Junior TVL:          1,000,000 USDC");
    }
}
