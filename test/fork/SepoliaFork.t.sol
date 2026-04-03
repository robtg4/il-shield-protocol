// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ILShieldCore} from "../../src/core/ILShieldCore.sol";
import {SeniorVault} from "../../src/core/SeniorVault.sol";
import {JuniorVault} from "../../src/core/JuniorVault.sol";
import {ILPNRegistry} from "../../src/core/ILPNRegistry.sol";
import {PricingOracle} from "../../src/core/PricingOracle.sol";

/// @notice Fork test against live Ethereum Sepolia — real Chainlink, real Uniswap v4
/// @dev Run: forge test --match-contract SepoliaForkTest --fork-url $SEPOLIA_RPC_URL -vvv
contract SepoliaForkTest is Test {
    // Live Sepolia addresses
    address constant CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant V4_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant V4_POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant V4_POOL_SWAP_TEST = 0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe;

    // Test USDC (deployed in setUp)
    ERC20Mock usdc;

    // IL Shield contracts
    ILPNRegistry registry;
    PricingOracle oracle;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILShieldCore core;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");

    address admin;
    // Use address(uint160) to guarantee clean EOAs on fork
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        admin = address(this);

        // Deploy mock USDC on the fork
        usdc = new ERC20Mock("Test USDC", "USDC", 6);

        // Deploy IL Shield system
        registry = new ILPNRegistry(admin);
        oracle = new PricingOracle(admin);
        seniorVault = new SeniorVault(IERC20(address(usdc)), admin);
        juniorVault = new JuniorVault(IERC20(address(usdc)), address(seniorVault), admin);
        core = new ILShieldCore(
            address(usdc), address(seniorVault), address(juniorVault),
            address(registry), address(oracle), admin, admin
        );

        // Grant roles
        registry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        oracle.grantRole(KEEPER_ROLE, admin);
        core.grantRole(KEEPER_ROLE, admin);

        // Configure oracle with LIVE Chainlink feed
        bytes32 poolId = bytes32(uint256(1));
        oracle.configurePool(
            poolId,
            CHAINLINK_ETH_USD, // REAL Chainlink
            address(0),
            0.35e18,
            3000,
            1e18
        );

        // Testnet params
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        seniorVault.setMinLockDuration(0);
        juniorVault.setMinLockDuration(0);

        // Seed vaults
        usdc.mint(admin, 10_000_000e6);
        usdc.approve(address(seniorVault), 5_000_000e6);
        seniorVault.deposit(5_000_000e6, admin);
        usdc.approve(address(juniorVault), 1_000_000e6);
        juniorVault.deposit(1_000_000e6, admin);
    }

    /// @notice Verify Chainlink ETH/USD feed is live and returning valid data
    function test_fork_chainlinkFeedIsLive() public view {
        uint160 sqrtPrice = oracle.getChainlinkSqrtPriceX96(bytes32(uint256(1)));
        assertGt(sqrtPrice, 0, "Chainlink should return non-zero sqrtPriceX96");
        console.log("Chainlink sqrtPriceX96:", sqrtPrice);

        // Convert to readable price: price = (sqrtPrice / 2^96)^2
        uint256 price = uint256(sqrtPrice) * uint256(sqrtPrice) / (2 ** 192) * 1e18;
        console.log("Derived ETH price (approx):", price);
    }

    /// @notice Verify Uniswap v4 PoolManager is live
    function test_fork_v4PoolManagerIsLive() public view {
        uint256 codeSize;
        assembly { codeSize := extcodesize(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543) }
        assertGt(codeSize, 0, "V4 PoolManager should have code");
        console.log("V4 PoolManager codesize:", codeSize);
    }

    /// @notice Verify PositionManager is live
    function test_fork_v4PositionManagerIsLive() public view {
        uint256 codeSize;
        assembly { codeSize := extcodesize(0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4) }
        assertGt(codeSize, 0, "V4 PositionManager should have code");
    }

    /// @notice Full lifecycle: register → stream → settle with live Chainlink price
    function test_fork_fullSettlementWithLiveOracle() public {
        // Fund Alice
        usdc.mint(alice, 10_000e6);

        // Register
        vm.startPrank(alice);
        usdc.approve(address(core), 10_000e6);
        uint256 ilpnId = core.register(1, 2, 216_000, 1_000e6, address(0));
        vm.stopPrank();

        // Verify ILPN minted
        assertEq(registry.ownerOf(ilpnId), alice);

        // Advance and stream
        vm.roll(block.number + 100);
        uint256[] memory ids = new uint256[](1);
        ids[0] = ilpnId;
        core.processStreaming(ids);

        // Settle — this calls the LIVE Chainlink oracle
        vm.roll(block.number + 10);
        vm.startPrank(alice);
        core.settle(ilpnId, 79228162514264337593543950336, "");
        vm.stopPrank();

        // Verify ILPN burned (position settled)
        vm.expectRevert();
        registry.ownerOf(ilpnId);

        console.log("Full settlement with live Chainlink: SUCCESS");
    }

    /// @notice Verify oracle staleness check works with real feed timing
    function test_fork_oracleStalenessWithRealFeed() public {
        // The live Chainlink feed should be fresh (updated within 1 hour)
        uint160 price = oracle.getChainlinkSqrtPriceX96(bytes32(uint256(1)));
        assertGt(price, 0, "Fresh feed should return valid price");

        // Warp 2 hours into the future — feed becomes stale
        vm.warp(block.timestamp + 7200);
        vm.expectRevert(PricingOracle.StalePrice.selector);
        oracle.getChainlinkSqrtPriceX96(bytes32(uint256(1)));
    }

    /// @notice Register multiple positions and batch stream with live infra
    function test_fork_batchStreamingWithLiveOracle() public {
        usdc.mint(alice, 100_000e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 100_000e6);

        uint256[] memory ids = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            ids[i] = core.register(1, 2, 216_000, 500e6, address(0));
        }
        vm.stopPrank();

        // Advance and batch stream
        vm.roll(block.number + 500);
        uint256 gasBefore = gasleft();
        core.processStreaming(ids);
        uint256 gasUsed = gasBefore - gasleft();

        console.log("Batch streaming 10 positions gas:", gasUsed);
        assertLt(gasUsed, 5_000_000, "Batch streaming should be under 5M gas on fork");
    }

    /// @notice Vault waterfall with live oracle settlement
    function test_fork_vaultWaterfallWithSettlement() public {
        uint256 seniorBefore = seniorVault.totalAssets();
        uint256 juniorBefore = juniorVault.totalAssets();

        // Register and settle — IL=0 (no real liquidity), so no payout
        usdc.mint(alice, 10_000e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 10_000e6);
        uint256 ilpnId = core.register(1, 2, 216_000, 1_000e6, address(0));
        vm.stopPrank();

        vm.roll(block.number + 100);
        vm.startPrank(alice);
        core.settle(ilpnId, 79228162514264337593543950336, "");
        vm.stopPrank();

        // Vault TVLs should be unchanged (no IL payout)
        uint256 seniorAfter = seniorVault.totalAssets();
        uint256 juniorAfter = juniorVault.totalAssets();

        // Senior/Junior unchanged since no claims paid (IL=0)
        assertEq(seniorAfter, seniorBefore, "Senior unchanged (no IL payout)");
        assertEq(juniorAfter, juniorBefore, "Junior unchanged (no IL payout)");

        console.log("Vault waterfall: Senior", seniorAfter, "Junior", juniorAfter);
    }

    /// @notice Gas profiling on live fork
    function test_fork_gasProfile() public {
        usdc.mint(alice, 100_000e6);
        vm.startPrank(alice);
        usdc.approve(address(core), 100_000e6);

        uint256 g1 = gasleft();
        uint256 ilpnId = core.register(1, 2, 216_000, 1_000e6, address(0));
        uint256 registerGas = g1 - gasleft();

        vm.roll(block.number + 50);

        uint256 g2 = gasleft();
        core.settle(ilpnId, 79228162514264337593543950336, "");
        uint256 settleGas = g2 - gasleft();
        vm.stopPrank();

        console.log("Register gas (live fork):", registerGas);
        console.log("Settle gas (live fork):", settleGas);
    }
}

/// @notice Simple mock ERC20 for fork tests
contract ERC20Mock is ERC20 {
    uint8 private _dec;
    constructor(string memory name_, string memory symbol_, uint8 decimals_) ERC20(name_, symbol_) { _dec = decimals_; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public view override returns (uint8) { return _dec; }
}
