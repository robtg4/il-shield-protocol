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
import {ILMath} from "../../src/libraries/ILMath.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function decimals() public pure override returns (uint8) { return 6; }
}

contract MockWETH is ERC20 {
    constructor() ERC20("Mock WETH", "mWETH") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

interface AggregatorV3Interface {
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
    function decimals() external view returns (uint8);
}

/// @title ForkBase
/// @notice Shared base for all fork tests — deploys IL Shield against live Sepolia state
abstract contract ForkBase is Test {
    // Live Sepolia infrastructure
    address constant CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant V4_POOL_MANAGER = 0xE03A1074c86CFeDd5C142C4F04F1a1536e203543;
    address constant V4_POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant V4_POOL_SWAP_TEST = 0x9B6b46e2c869aa39918Db7f52f5557FE577B6eEe;
    address constant V4_STATE_VIEW = 0xE1Dd9c3fA50EDB962E442f60DfBc432e24537E4C;

    // IL Shield contracts
    ILShieldCore core;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILPNRegistry ilpnRegistry;
    PricingOracle oracle;
    MockUSDC mockUSDC;
    MockWETH mockWETH;

    bytes32 constant CORE_ROLE = keccak256("CORE_ROLE");
    bytes32 constant KEEPER_ROLE = keccak256("KEEPER_ROLE");
    bytes32 constant POOL_ID = bytes32(uint256(1));

    // Test actors — use low addresses guaranteed to be EOAs on Sepolia
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address treasury = address(0x7EA5);
    address referral = address(0xEF);

    function setUp() public virtual {
        // Fork Sepolia at latest block
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));

        // Deploy mock tokens on fork
        mockUSDC = new MockUSDC();
        mockWETH = new MockWETH();

        // Deploy IL Shield
        ilpnRegistry = new ILPNRegistry(address(this));
        oracle = new PricingOracle(address(this));
        seniorVault = new SeniorVault(IERC20(address(mockUSDC)), address(this));
        juniorVault = new JuniorVault(IERC20(address(mockUSDC)), address(seniorVault), address(this));
        core = new ILShieldCore(
            address(mockUSDC),
            address(seniorVault),
            address(juniorVault),
            address(ilpnRegistry),
            address(oracle),
            treasury,
            address(this)
        );

        // Grant roles
        ilpnRegistry.grantRole(CORE_ROLE, address(core));
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        oracle.grantRole(KEEPER_ROLE, address(this));
        core.grantRole(KEEPER_ROLE, address(this));

        // Configure oracle with LIVE Chainlink
        oracle.configurePool(POOL_ID, CHAINLINK_ETH_USD, address(0), 0.35e18, 3000, 1e18);

        // Testnet-friendly parameters
        core.setWarmingPeriodBlocks(0);
        core.setFullCoverageRampBlocks(1);
        seniorVault.setMinLockDuration(10);
        juniorVault.setMinLockDuration(20);

        // Fund actors
        mockUSDC.mint(alice, 1_000_000e6);
        mockUSDC.mint(bob, 1_000_000e6);
        mockWETH.mint(alice, 100e18);
        mockWETH.mint(bob, 100e18);

        // Seed vaults
        mockUSDC.mint(address(this), 200_000e6);
        mockUSDC.approve(address(seniorVault), 100_000e6);
        seniorVault.deposit(100_000e6, address(this));
        mockUSDC.approve(address(juniorVault), 25_000e6);
        juniorVault.deposit(25_000e6, address(this));
    }

    /// @notice Chainlink anchor — first test in every fork suite
    function test_00_chainlinkAnchor() public {
        (, int256 answer,, uint256 updatedAt,) = AggregatorV3Interface(CHAINLINK_ETH_USD).latestRoundData();
        assertGt(answer, 500e8, "ETH too cheap");
        assertLt(answer, 20_000e8, "ETH too expensive");
        assertGt(updatedAt, block.timestamp - 2 hours, "Chainlink stale >2h");
        emit log_named_int("Chainlink ETH/USD", answer);
        emit log_named_uint("Fork (block)", block.number);
    }

    /// @notice Read live Chainlink price
    function _getChainlinkPrice() internal view returns (int256) {
        (, int256 answer,,,) = AggregatorV3Interface(CHAINLINK_ETH_USD).latestRoundData();
        return answer;
    }

    /// @notice Register a position as a given user
    function _registerAs(address user, uint256 premium) internal returns (uint256 ilpnId) {
        vm.startPrank(user);
        mockUSDC.approve(address(core), premium);
        ilpnId = core.register(1, 2, 216_000, premium, address(0));
        vm.stopPrank();
    }

    /// @notice Register with real position parameters (entry price + liquidity injected via vm.store)
    function _registerWithPosition(
        address user,
        uint256 premium,
        uint160 entrySqrtPriceX96,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity
    ) internal returns (uint256 ilpnId) {
        ilpnId = _registerAs(user, premium);
        // The positions mapping is at slot 2 in ILShieldCore (after AccessControl + ReentrancyGuard + Pausable storage)
        // Each Position occupies multiple slots. We need to find the base slot for positions[ilpnId].
        // mapping slot = keccak256(abi.encode(key, mappingSlot))
        // The exact slot depends on inherited contract storage. Use vm.store to write directly.
        //
        // Position struct layout (each field in order):
        //   slot+0: poolId (bytes32)
        //   slot+1: entrySqrtPriceX96 (uint160) | tickLower (int24) | tickUpper (int24)  [packed]
        //   slot+2: liquidity (uint128) | coverageTier (uint8) | coverageStartBlock (uint48) | coverageEndBlock (uint48)
        //
        // We need to find the mapping slot. ILShieldCore inherits:
        //   AccessControl (uses ERC7201 namespaced storage)
        //   ReentrancyGuard (uses ERC7201 namespaced storage)
        //   Pausable (uses ERC7201 namespaced storage)
        //   Then own storage: positions at slot 0, nextPositionId at slot 1, etc.
        // With via_ir and OZ5 namespaced storage, positions mapping is at slot 0.

        // positions mapping is at storage slot 2 (after _roles at 0, _paused at 1)
        bytes32 baseSlot = keccak256(abi.encode(uint256(ilpnId), uint256(2)));

        // Slot+1: pack entrySqrtPriceX96 (160 bits) | tickLower (24 bits) | tickUpper (24 bits)
        // Layout: [tickUpper(24) | tickLower(24) | entrySqrtPriceX96(160)] from LSB
        uint256 packed1 = uint256(entrySqrtPriceX96);
        packed1 |= uint256(uint24(tickLower)) << 160;
        packed1 |= uint256(uint24(tickUpper)) << 184;
        vm.store(address(core), bytes32(uint256(baseSlot) + 1), bytes32(packed1));

        // Slot+2: pack liquidity (128 bits) | coverageTier (8 bits) | coverageStartBlock (48 bits) | coverageEndBlock (48 bits)
        // Read existing slot to preserve coverageTier and coverage blocks
        bytes32 existing2 = vm.load(address(core), bytes32(uint256(baseSlot) + 2));
        uint256 slot2 = uint256(existing2);
        // Clear liquidity (bottom 128 bits) and write new
        slot2 = (slot2 >> 128) << 128; // clear bottom 128
        slot2 |= uint256(liquidity);
        vm.store(address(core), bytes32(uint256(baseSlot) + 2), bytes32(slot2));
    }
}
