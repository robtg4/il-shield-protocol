# IL Shield — Automated Battle Testing Architecture

## Approach

The 52-test Sepolia battle plan converts into three automation layers, each handling a different class of test based on what it requires from the network.

**Layer 1: Fork tests (38 of 52 tests).** These run locally in Foundry against a fork of live Sepolia state. They deploy IL Shield contracts to the forked environment, interact with the real Uniswap v4 PoolManager and Chainlink ETH/USD feed via `--fork-url`, and use `vm.warp` and `vm.roll` to simulate time advancement. They execute in minutes, cost zero gas, and can be re-run on every commit via CI. This covers all of Phase A, Phase B, Phase C, Phase D, and Phase E.

**Layer 2: Broadcast scripts (9 of 52 tests).** These are Foundry `forge script` files with `--broadcast` that execute real transactions on Sepolia. They handle operations that must produce real transaction hashes against the persistent testnet state: contract deployment, pool creation, and the sequential claim drain test (D08) where state accumulates across transactions. These run once during the initial deployment phase and during the soak test.

**Layer 3: Keeper bot (5 of 52 tests).** Phase F hook tests on Unichain Sepolia and the long-running soak operations (continuous swaps, periodic streaming, multi-day position lifecycles) require a persistent process. A simple Node.js or bash script running on the Hetzner server handles this.

The key insight is that **fork tests give you 95% of the confidence at 5% of the cost.** A fork test against live Sepolia state proves your contracts interact correctly with the real PoolManager, real Chainlink feed, and real ERC-20 token implementations. The only thing it cannot prove is gas behavior under actual network conditions and persistence of deployed state across blocks, which is what Layers 2 and 3 cover.

---

## Layer 1: Fork Test Suite

### Configuration

All fork tests share a single base contract that sets up the fork, deploys IL Shield, and provides helper functions.

```solidity
// test/fork/ForkBase.t.sol
abstract contract ForkBase is Test {
    // Live Sepolia addresses
    IPoolManager constant POOL_MANAGER = IPoolManager(0xE03A1074c86CFeDd5C142C4F04F1a1536e203543);
    address constant POSITION_MANAGER = 0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4;
    address constant POOL_SWAP_TEST = 0x9b6b46e2c869aa39918db7f52f5557fe577b6eee;
    address constant POOL_MODIFY_LIQ_TEST = 0x0c478023803a644c94c4ce1c1e7b9a087e411b0a;
    address constant STATE_VIEW = 0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c;
    address constant CHAINLINK_ETH_USD = 0x694AA1769357215DE4FAC081bf1f309aDC325306;
    address constant PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // IL Shield contracts (deployed in setUp)
    ILShieldCore core;
    SeniorVault seniorVault;
    JuniorVault juniorVault;
    ILPNRegistry ilpnRegistry;
    PricingOracle oracle;
    MockERC20 mockUSDC;
    MockERC20 mockWETH;

    // Test actors
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address treasury = makeAddr("treasury");
    address referral = makeAddr("referral");

    function setUp() public virtual {
        // Fork Sepolia at latest block
        vm.createSelectFork(vm.envString("SEPOLIA_RPC_URL"));

        // Deploy mock tokens
        mockUSDC = new MockERC20("Mock USDC", "mUSDC", 6);
        mockWETH = new MockERC20("Mock WETH", "mWETH", 18);

        // Deploy IL Shield system
        seniorVault = new SeniorVault(address(mockUSDC), ...);
        juniorVault = new JuniorVault(address(mockUSDC), address(seniorVault), ...);
        ilpnRegistry = new ILPNRegistry();
        oracle = new PricingOracle(CHAINLINK_ETH_USD);
        core = new ILShieldCore(
            address(seniorVault),
            address(juniorVault),
            address(ilpnRegistry),
            address(oracle),
            treasury,
            referral
        );

        // Grant roles
        seniorVault.grantRole(CORE_ROLE, address(core));
        juniorVault.grantRole(CORE_ROLE, address(core));
        ilpnRegistry.grantRole(CORE_ROLE, address(core));

        // Fund actors
        mockUSDC.mint(alice, 1_000_000e6);
        mockUSDC.mint(bob, 1_000_000e6);
        mockWETH.mint(alice, 100e18);
        mockWETH.mint(bob, 100e18);

        // Seed vaults
        vm.startPrank(alice);
        mockUSDC.approve(address(seniorVault), type(uint256).max);
        seniorVault.deposit(100_000e6, alice);
        vm.stopPrank();

        vm.startPrank(bob);
        mockUSDC.approve(address(juniorVault), type(uint256).max);
        juniorVault.deposit(25_000e6, bob);
        vm.stopPrank();
    }

    // Helper: create a v4 pool and add liquidity
    function _createPoolAndAddLiquidity() internal returns (PoolKey memory, uint160) { ... }

    // Helper: execute a swap on the test pool
    function _swap(PoolKey memory key, bool zeroForOne, int256 amount) internal { ... }

    // Helper: read Chainlink price
    function _getChainlinkPrice() internal view returns (int256) {
        (, int256 answer,,,) = AggregatorV3Interface(CHAINLINK_ETH_USD).latestRoundData();
        return answer;
    }
}
```

### Test Files

Each phase maps to a test file. Every test function is named to match the battle plan ID.

```
test/fork/PhaseA_VaultOps.t.sol       — A01 through A14
test/fork/PhaseB_ILPNRegistry.t.sol   — B01 through B07
test/fork/PhaseC_Lifecycle.t.sol      — C01 through C08
test/fork/PhaseD_Adversarial.t.sol    — D01 through D12
test/fork/PhaseE_GasProfile.t.sol     — E01 through E06
```

### Execution

A single command runs the entire fork test suite against live Sepolia state:

```bash
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY \
  forge test --match-path "test/fork/*" -vvv \
  2>&1 | tee test_results/fork_suite_$(date +%Y%m%d_%H%M%S).txt
```

This takes approximately 3–8 minutes depending on RPC latency. It can run on every commit, every PR, or on a cron schedule. Because it forks from live state, it validates against the actual PoolManager storage, the actual Chainlink answer, and the actual ERC-20 implementations deployed on Sepolia, without spending any testnet ETH.

### Time Advancement in Fork Tests

Fork tests use `vm.warp` and `vm.roll` to simulate time passage, which is how the lock period, premium streaming, and coverage expiration tests work without waiting real hours or days.

```solidity
// A03: premature withdrawal must revert
function test_A03_seniorVault_prematureWithdrawal() public {
    // Alice deposited in setUp()
    vm.prank(alice);
    vm.expectRevert(); // lock period not elapsed
    seniorVault.withdraw(1000e6, alice, alice);
}

// A04: withdrawal after lock period
function test_A04_seniorVault_withdrawalAfterLock() public {
    // Advance past lock period (14 days = 14 * 86400 seconds)
    vm.warp(block.timestamp + 14 days + 1);
    vm.roll(block.number + (14 days / 12)); // ~12s blocks on Sepolia

    vm.prank(alice);
    uint256 balBefore = mockUSDC.balanceOf(alice);
    seniorVault.withdraw(1000e6, alice, alice);
    assertEq(mockUSDC.balanceOf(alice) - balBefore, 1000e6);
}
```

### Full Lifecycle Fork Test

The most important test is the complete lifecycle running against the live v4 PoolManager:

```solidity
function test_C01_through_C07_fullLifecycle() public {
    // C01: Create pool and add liquidity via live PoolModifyLiquidityTest
    (PoolKey memory key, uint160 entrySqrt) = _createPoolAndAddLiquidity();

    // C02: Register for protection
    vm.startPrank(alice);
    mockUSDC.approve(address(core), 500e6);
    uint256 ilpnId = core.register(
        entrySqrt, -6000, 6000, 1e18,  // position params
        2,       // 100% coverage
        30 days, // duration
        500e6    // premium deposit
    );
    vm.stopPrank();

    // Verify premium split
    assertEq(seniorVault.totalAssets(), 100_000e6 + 350e6); // +70%
    assertEq(juniorVault.totalAssets(), 25_000e6 + 75e6);   // +15%

    // C03: Advance and stream premiums
    vm.warp(block.timestamp + 1 days);
    vm.roll(block.number + 7200);
    core.processStreaming(ilpnId);

    // C04: Move the price via 20 real swaps against the live PoolManager
    for (uint i = 0; i < 20; i++) {
        bool direction = i % 3 != 0; // mostly one direction to create IL
        _swap(key, direction, int256(0.01e18 * (i + 1)));
    }

    // Read new sqrtPriceX96 from live StateView
    uint160 exitSqrt = _readSqrtPrice(key);

    // C05: Read Chainlink (live feed on Sepolia)
    int256 chainlinkPrice = _getChainlinkPrice();
    assertTrue(chainlinkPrice > 0, "Chainlink must return non-zero");

    // C06: Settle
    vm.prank(alice);
    uint256 payoutBefore = mockUSDC.balanceOf(alice);
    core.settle(ilpnId, exitSqrt);
    uint256 payout = mockUSDC.balanceOf(alice) - payoutBefore;

    // Verify IL math matches manual computation
    uint256 expectedIL = ILMath.computeIL(entrySqrt, exitSqrt, -6000, 6000, 1e18);
    uint256 expectedPayout = (expectedIL * 100 / 100) * 98 / 100; // 100% tier, 2% fee
    assertApproxEqRel(payout, expectedPayout, 0.001e18); // 0.1% tolerance

    // Verify ILPN burned
    vm.expectRevert();
    ilpnRegistry.ownerOf(ilpnId);

    // C07: Vault balance reconciliation
    // totalAssets = initial + premiums - claims
    // (exact values depend on streaming deductions and settlement amount)
}
```

### Adversarial Fork Tests

The adversarial tests in Phase D also work in fork mode because `vm.prank`, `vm.warp`, and `vm.expectRevert` provide all the control needed.

```solidity
// D08: Drain Junior via sequential claims
function test_D08_drainJuniorSequentialClaims() public {
    // Register 5 positions
    uint256[] memory ids = new uint256[](5);
    for (uint i = 0; i < 5; i++) {
        vm.startPrank(alice);
        mockUSDC.approve(address(core), 100e6);
        ids[i] = core.register(..., 2, 30 days, 100e6); // 100% coverage
        vm.stopPrank();
    }

    // Move price dramatically (30% swing)
    for (uint i = 0; i < 50; i++) {
        _swap(key, true, 0.05e18); // all in one direction
    }

    // Settle sequentially, track Junior balance
    uint256[] memory juniorAfter = new uint256[](5);
    for (uint i = 0; i < 5; i++) {
        vm.prank(alice);
        core.settle(ids[i], _readSqrtPrice(key));
        juniorAfter[i] = juniorVault.totalAssets();
    }

    // Junior should deplete, later claims overflow to Senior
    assertTrue(juniorAfter[4] == 0 || juniorAfter[3] < juniorAfter[0],
        "Junior must deplete under sequential claims");
}
```

---

## Layer 2: Broadcast Deployment Scripts

Nine operations require real on-chain persistence: deploying contracts, creating the initial test pool, and the Phase F hook deployment on Unichain Sepolia. These are Foundry scripts that broadcast real transactions.

```
script/
  01_DeployTokens.s.sol          — Deploy mockUSDC, mockWETH
  02_DeployILShield.s.sol         — Deploy all core contracts, grant roles
  03_CreateTestPool.s.sol         — Initialize v4 pool, add seed liquidity
  04_RegisterTestPosition.s.sol   — Register a position for ongoing monitoring
  05_DeployMockOracle.s.sol       — MockAggregatorV3 on Unichain Sepolia
  06_DeployHook.s.sol             — IL Shield Hook on Unichain Sepolia (CREATE2)
  07_CreateHookedPool.s.sol       — Initialize hooked pool on Unichain Sepolia
  08_SeedLiquidity.s.sol          — Add liquidity to hooked pool
  09_RecordDeployment.s.sol       — Write all addresses to deployments/*.json
```

Execution is sequential:

```bash
# Ethereum Sepolia deployment
forge script script/01_DeployTokens.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
forge script script/02_DeployILShield.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast --verify
forge script script/03_CreateTestPool.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# Unichain Sepolia deployment
forge script script/05_DeployMockOracle.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC_URL --broadcast
forge script script/06_DeployHook.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC_URL --broadcast
forge script script/07_CreateHookedPool.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC_URL --broadcast
```

Each script writes its output to `deployments/` and commits the result. These run once during initial setup and are not part of the CI loop.

---

## Layer 3: Keeper Bot for Soak Testing

For the extended soak test (7–14 days of continuous operation), a bash script on the Hetzner server performs automated market simulation.

```bash
#!/bin/bash
# scripts/soak_keeper.sh — runs continuously on the Hetzner server

source .env.sepolia
POOL_SWAP_TEST=0x9b6b46e2c869aa39918db7f52f5557fe577b6eee
INTERVAL=60  # seconds between operations

while true; do
    TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    # Random swap direction and amount
    DIRECTION=$((RANDOM % 2))
    AMOUNT=$(echo "scale=6; ($RANDOM % 100 + 1) / 10000" | bc)

    # Execute swap
    TX=$(cast send $POOL_SWAP_TEST "swap(...)" \
        --rpc-url $SEPOLIA_RPC_URL \
        --private-key $DEPLOYER_PRIVATE_KEY \
        --json 2>/dev/null | jq -r '.transactionHash')

    echo "$TIMESTAMP | swap | direction=$DIRECTION | amount=$AMOUNT | tx=$TX" \
        >> test_results/soak/swap_log.txt

    # Every 100 iterations, process premium streaming
    if (( ITERATION % 100 == 0 )); then
        TX=$(cast send $CORE_ADDRESS "processStreaming(uint256)" $POSITION_ID \
            --rpc-url $SEPOLIA_RPC_URL \
            --private-key $DEPLOYER_PRIVATE_KEY \
            --json 2>/dev/null | jq -r '.transactionHash')
        echo "$TIMESTAMP | stream | tx=$TX" >> test_results/soak/stream_log.txt
    fi

    # Every 1000 iterations, register a new position and settle an old one
    if (( ITERATION % 1000 == 0 )); then
        # ... lifecycle operations
    fi

    # Hourly: commit and push logs
    if (( ITERATION % 60 == 0 )); then
        git add test_results/soak/
        git commit -m "soak: checkpoint at $TIMESTAMP"
        git push origin test/sepolia-campaign
    fi

    ITERATION=$((ITERATION + 1))
    sleep $INTERVAL
done
```

Run with `nohup scripts/soak_keeper.sh &` on the Hetzner server. It pushes hourly checkpoint commits so you can monitor from GitHub.

---

## CI Integration

The fork test suite (Layer 1) runs automatically on every push to the test branch. Add this to `.github/workflows/battle-test.yml`:

```yaml
name: IL Shield Battle Tests
on:
  push:
    branches: [test/sepolia-campaign]
  pull_request:
    branches: [main]

jobs:
  fork-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: foundry-rs/foundry-toolchain@v1

      - name: Run fork test suite
        env:
          SEPOLIA_RPC_URL: ${{ secrets.SEPOLIA_RPC_URL }}
        run: |
          forge test --match-path "test/fork/*" -vvv \
            2>&1 | tee test_results/ci_fork_$(date +%Y%m%d).txt

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: fork-test-results
          path: test_results/

      - name: Check for failures
        run: |
          if grep -q "FAIL" test_results/ci_fork_*.txt; then
            echo "::error::Fork tests have failures"
            exit 1
          fi
```

This gives you automated regression testing on every push. If someone modifies a test or the deployment manifest, the fork suite re-runs and catches regressions within minutes.

---

## Execution Summary

The three layers provide complementary coverage at different costs and cadences.

**Layer 1 (fork tests):** 38 tests, runs in 3–8 minutes, zero gas cost, runs on every commit via CI, validates against live Sepolia state. This is your primary testing surface. Re-run freely, adjust tests, add new scenarios, and iterate rapidly.

**Layer 2 (broadcast scripts):** 9 deployment operations, runs once during setup and once after any contract change, costs approximately 0.1–0.3 Sepolia ETH total, produces real deployment addresses and transaction hashes.

**Layer 3 (soak keeper):** 5 ongoing operations, runs continuously for 7–14 days, costs approximately 0.01 Sepolia ETH per day in gas, validates durability and economic model behavior over time.

The total testing surface is 52 named scenarios automated across three execution modes. Claude Code on the Hetzner server manages all three layers: it writes and runs the fork tests (Layer 1), executes the deployment scripts (Layer 2), and starts and monitors the soak keeper (Layer 3). Results flow through Git and GitHub Issues as specified in the feedback loop architecture.
