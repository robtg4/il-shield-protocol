# CLAUDE.md — IL Shield Protocol Engineering Specification

## Project Overview

IL Shield is a tokenized impermanent loss protection protocol for Uniswap v4 liquidity providers. The protocol operates as a peripheral financial overlay on existing Uniswap pools, with an optional native v4 hook for greenfield deployments. LPs register existing positions, pay streaming premiums in USDC, and receive parametric IL payouts from a tranched underwriting vault when they close their positions.

This specification defines the full smart contract system, test suite, and deployment pipeline. The target is a Foundry-based monorepo producing auditable, gas-optimized Solidity contracts deployable to Ethereum mainnet and L2s (Arbitrum, Base, Unichain).

---

## Repository Structure

```
il-shield/
├── CLAUDE.md                          # This file
├── foundry.toml                       # Foundry configuration
├── remappings.txt                     # Import remappings
├── .env.example                       # Environment variables template
│
├── src/
│   ├── core/
│   │   ├── ILShieldCore.sol           # Position registry, premium streaming, claim settlement
│   │   ├── SeniorVault.sol            # ERC-4626 senior tranche (fixed yield, last-loss)
│   │   ├── JuniorVault.sol            # ERC-4626 junior tranche (residual yield, first-loss)
│   │   ├── ILPNRegistry.sol           # ERC-721 non-transferable protection NFTs
│   │   └── PricingOracle.sol          # Net IL premium computation + vol feed composition
│   │
│   ├── hook/
│   │   ├── ILShieldHook.sol           # Uniswap v4 hook (optional native mode)
│   │   └── TickAccumulator.sol        # tickCumulative storage for IL computation
│   │
│   ├── libraries/
│   │   ├── ILMath.sol                 # IL computation: entry/exit price → IL amount
│   │   ├── PremiumMath.sol            # Net IL premium formula + C-level coefficient
│   │   ├── ConcentrationFactor.sol    # Tick range → concentration multiplier
│   │   └── VolatilityLib.sol          # Yang-Zhang realized vol estimator
│   │
│   ├── interfaces/
│   │   ├── IILShieldCore.sol
│   │   ├── ISeniorVault.sol
│   │   ├── IJuniorVault.sol
│   │   ├── IILPNRegistry.sol
│   │   ├── IPricingOracle.sol
│   │   └── IILShieldHook.sol
│   │
│   └── periphery/
│       ├── ILShieldRouter.sol         # Multicall helper: register + fund premium in one tx
│       ├── KeeperModule.sol           # Gelato-compatible keeper for vol updates + settlement assist
│       └── BrevisCallback.sol         # Brevis zkCoprocessor integration for historical data
│
├── test/
│   ├── unit/
│   │   ├── ILMath.t.sol               # IL computation fuzz tests against Python reference
│   │   ├── PremiumMath.t.sol          # Premium formula property tests
│   │   ├── SeniorVault.t.sol          # ERC-4626 compliance + tranche mechanics
│   │   ├── JuniorVault.t.sol          # First-loss absorption + utilization throttling
│   │   ├── ILPNRegistry.t.sol         # Non-transferability enforcement
│   │   └── PricingOracle.t.sol        # Oracle composition + staleness checks
│   │
│   ├── integration/
│   │   ├── FullSettlement.t.sol       # End-to-end: register → accrue → settle
│   │   ├── HookMode.t.sol            # v4 hook lifecycle with PoolManager
│   │   ├── TrancheWaterfall.t.sol     # Junior exhaustion → Senior impact
│   │   └── OracleCircuitBreaker.t.sol # Price divergence → delay → median resolution
│   │
│   ├── invariant/
│   │   ├── VaultSolvency.t.sol        # Invariant: Senior + Junior assets >= outstanding claims
│   │   └── PremiumMonotonicity.t.sol  # Invariant: higher vol → higher premium (never inverted)
│   │
│   └── fork/
│       ├── MainnetFork.t.sol          # Fork test against live Uniswap v4 + Chainlink
│       └── BacktestIL.t.sol           # Historical IL backtest using forked state
│
├── script/
│   ├── Deploy.s.sol                   # Full deployment script
│   ├── DeployHook.s.sol               # Hook deployment with CREATE2 address mining
│   └── Seed.s.sol                     # Seed vault with initial USDC for testing
│
└── reference/
    ├── il_math_reference.py           # Python reference implementation for IL formula
    └── premium_model.py               # Python reference for premium computation
```

---

## Contract Specifications

### 1. ILShieldCore.sol

**Purpose:** Central registry and settlement engine. Manages position registrations, premium streaming, and claim settlement. Coordinates interactions between vaults, ILPN registry, pricing oracle, and external position data.

**State Variables:**

```solidity
// Position data
struct Position {
    bytes32 poolId;                 // Uniswap v4 pool identifier
    uint160 entrySqrtPriceX96;     // sqrtPriceX96 at registration time
    int24   tickLower;             // Position lower tick
    int24   tickUpper;             // Position upper tick
    uint128 liquidity;             // Liquidity amount
    uint8   coverageTier;          // 0: 50%, 1: 75%, 2: 100%
    uint48  coverageStartBlock;    // Block when coverage begins (after warming period)
    uint48  coverageEndBlock;      // Block when coverage expires
    uint256 premiumBalance;        // Remaining USDC premium deposit
    uint256 premiumRatePerBlock;   // Current streaming rate (USDC per block, 18 decimals)
    uint256 lastPremiumBlock;      // Last block premium was deducted
    uint256 maxPayout;             // Maximum claim payout in USDC
    bool    settled;               // Whether claim has been settled
}

mapping(uint256 => Position) public positions;  // ILPN tokenId => Position
uint256 public nextPositionId;

// Protocol parameters
uint256 public warmingPeriodBlocks;     // 48-72 hours in blocks (~14400-21600 on mainnet)
uint256 public fullCoverageRampBlocks;  // 7 days in blocks (~50400 on mainnet)
uint256 public settlementFeeRate;       // 200 = 2% (basis points)
uint256 public minCoverageDuration;     // Minimum 7 days in blocks

// Premium distribution splits (basis points, must sum to 10000)
uint256 public seniorShare;   // 7000 = 70%
uint256 public juniorShare;   // 1500 = 15%
uint256 public treasuryShare; // 1000 = 10%
uint256 public referralShare; // 500  = 5%

// Contract references
ISeniorVault public seniorVault;
IJuniorVault public juniorVault;
IILPNRegistry public ilpnRegistry;
IPricingOracle public pricingOracle;
address public treasury;
IERC20 public usdc;
```

**Core Functions:**

```solidity
/// @notice Register an existing Uniswap v4 position for IL protection
/// @param positionId The Uniswap v4 position NFT token ID
/// @param coverageTier 0=50%, 1=75%, 2=100% coverage
/// @param durationBlocks Coverage duration in blocks
/// @param premiumDeposit USDC amount deposited to fund streaming premiums
/// @param referrer Address of integration partner (or address(0))
/// @return ilpnId The minted ILPN token ID
function register(
    uint256 positionId,
    uint8 coverageTier,
    uint48 durationBlocks,
    uint256 premiumDeposit,
    address referrer
) external returns (uint256 ilpnId);

/// @notice Settle a claim after the LP has closed their Uniswap position
/// @param ilpnId The ILPN token ID to settle
/// @param settlementPrice The exit price (verified against oracle)
/// @param brevisProof Optional Brevis ZK proof for historical data
function settle(
    uint256 ilpnId,
    uint160 settlementSqrtPriceX96,
    bytes calldata brevisProof
) external;

/// @notice Top up premium balance for an existing position
/// @param ilpnId The ILPN token ID
/// @param amount Additional USDC to deposit
function topUpPremium(uint256 ilpnId, uint256 amount) external;

/// @notice Withdraw remaining premium balance (cancels protection)
/// @param ilpnId The ILPN token ID
function cancelProtection(uint256 ilpnId) external;

/// @notice Called by keeper or anyone to deduct accrued premiums and distribute
/// @param ilpnIds Array of ILPN token IDs to process
function processStreaming(uint256[] calldata ilpnIds) external;
```

**Settlement Logic (pseudo-implementation):**

```solidity
function _computeSettlementPrice(uint256 ilpnId) internal view returns (uint160) {
    uint160 chainlinkPrice = pricingOracle.getChainlinkSqrtPriceX96(positions[ilpnId].poolId);
    uint160 twapPrice = pricingOracle.getTWAPSqrtPriceX96(positions[ilpnId].poolId, 30 minutes);

    uint256 divergence = _absDiff(chainlinkPrice, twapPrice) * 10000 / chainlinkPrice;

    if (divergence > 300) {
        // >3% divergence: delay settlement, revert with specific error
        revert SettlementDelayed(ilpnId, chainlinkPrice, twapPrice, divergence);
    }

    return chainlinkPrice; // Canonical source when within tolerance
}

function _computePayout(uint256 ilpnId, uint160 exitSqrtPriceX96) internal view returns (uint256) {
    Position storage pos = positions[ilpnId];

    uint256 ilAmount = ILMath.computeIL(
        pos.entrySqrtPriceX96,
        exitSqrtPriceX96,
        pos.tickLower,
        pos.tickUpper,
        pos.liquidity
    );

    // Apply coverage tier
    uint256 coveredIL = ilAmount * _coverageMultiplier(pos.coverageTier) / 10000;

    // Apply warming period ramp
    uint256 elapsedBlocks = block.number - pos.coverageStartBlock;
    uint256 effectiveCoverage = elapsedBlocks >= fullCoverageRampBlocks
        ? 10000
        : (elapsedBlocks * 10000) / fullCoverageRampBlocks;
    coveredIL = coveredIL * effectiveCoverage / 10000;

    // Cap at maxPayout
    uint256 payout = coveredIL > pos.maxPayout ? pos.maxPayout : coveredIL;

    // Deduct settlement fee
    uint256 fee = payout * settlementFeeRate / 10000;
    return payout - fee;
}

function _executePayout(uint256 amount) internal {
    // Draw from Junior first
    uint256 juniorAssets = juniorVault.totalAssets();
    if (amount <= juniorAssets) {
        juniorVault.withdrawForClaim(amount, address(this));
    } else {
        // Junior exhausted, overflow to Senior
        if (juniorAssets > 0) {
            juniorVault.withdrawForClaim(juniorAssets, address(this));
        }
        uint256 overflow = amount - juniorAssets;
        seniorVault.withdrawForClaim(overflow, address(this));
    }
}
```

**Access Control:** OpenZeppelin `AccessControl` with roles: `DEFAULT_ADMIN_ROLE`, `KEEPER_ROLE` (for `processStreaming`), `GOVERNANCE_ROLE` (for parameter updates). Timelock on parameter changes (48 hours minimum).

**Gas Targets:** `register()` < 250,000 gas. `settle()` < 350,000 gas (without Brevis proof), < 600,000 gas (with Brevis proof). `processStreaming()` < 80,000 gas per position.

---

### 2. SeniorVault.sol

**Purpose:** ERC-4626 vault accepting USDC deposits from conservative underwriters. Pays fixed yield from premium income. Bears claim losses only after Junior is exhausted.

**Inherits:** OpenZeppelin `ERC4626`, `AccessControl`, `ReentrancyGuard`, `Pausable`.

**Key State:**

```solidity
uint256 public seniorYieldRatePerBlock;   // Target fixed yield rate (18 decimals)
uint256 public minLockDuration;           // 14 days in blocks
uint256 public emergencyWithdrawPenalty;  // 500 = 5% (basis points)

mapping(address => uint256) public depositBlock;  // Track lock periods

// Utilization-based withdrawal throttling
uint256 public constant INSTANT_THRESHOLD = 6000;   // 60% utilization
uint256 public constant SLOW_THRESHOLD = 8000;       // 80% utilization
uint256 public constant INSTANT_QUEUE = 0;
uint256 public constant SLOW_QUEUE = 21600;          // ~3 days in blocks
uint256 public constant EMERGENCY_QUEUE = 50400;     // ~7 days in blocks
```

**Key Functions:**

```solidity
/// @notice Override deposit to enforce minimum lock
function deposit(uint256 assets, address receiver) public override returns (uint256) {
    depositBlock[receiver] = block.number;
    return super.deposit(assets, receiver);
}

/// @notice Override withdraw to enforce lock + utilization throttling
function withdraw(uint256 assets, address receiver, address owner)
    public override returns (uint256)
{
    require(block.number >= depositBlock[owner] + minLockDuration, "Lock active");
    require(_checkWithdrawalQueue(owner), "In withdrawal queue");
    return super.withdraw(assets, receiver, owner);
}

/// @notice Emergency withdrawal at penalty (always available)
function emergencyWithdraw(uint256 shares, address receiver) external nonReentrant {
    uint256 assets = previewRedeem(shares);
    uint256 penalty = assets * emergencyWithdrawPenalty / 10000;
    // Penalty stays in vault (benefits remaining depositors)
    _burn(msg.sender, shares);
    usdc.safeTransfer(receiver, assets - penalty);
}

/// @notice Called by ILShieldCore to draw funds for claim payouts
/// @dev Only callable after Junior is exhausted
function withdrawForClaim(uint256 amount, address to) external onlyRole(CORE_ROLE) {
    usdc.safeTransfer(to, amount);
}

/// @notice Receive premium income from ILShieldCore
function receivePremium(uint256 amount) external onlyRole(CORE_ROLE) {
    // Premium accrues to totalAssets(), increasing share price
    usdc.safeTransferFrom(msg.sender, address(this), amount);
}
```

**ERC-4626 Override:** `totalAssets()` returns the actual USDC balance of the vault including any amounts deployed to Aave/Morpho for idle yield, minus any pending claim obligations.

---

### 3. JuniorVault.sol

**Purpose:** ERC-4626 vault accepting USDC from risk-seeking underwriters. First-loss position. Receives residual yield after Senior obligations.

**Inherits:** Same as SeniorVault.

**Key Differences from Senior:**

```solidity
uint256 public minLockDuration;  // 30 days in blocks (longer than Senior)

// Senior protection constraint
uint256 public maxSeniorJuniorRatio;  // 50000 = 5:1 (basis points / 10000)

/// @notice Override withdraw to enforce Senior/Junior ratio floor
function withdraw(uint256 assets, address receiver, address owner)
    public override returns (uint256)
{
    // Check that withdrawal won't breach Senior/Junior ratio
    uint256 postWithdrawJunior = totalAssets() - assets;
    uint256 seniorAssets = seniorVault.totalAssets();
    require(
        postWithdrawJunior == 0 ? seniorAssets == 0 :
        seniorAssets * 10000 / postWithdrawJunior <= maxSeniorJuniorRatio,
        "Would breach S/J ratio"
    );
    require(block.number >= depositBlock[owner] + minLockDuration, "Lock active");
    return super.withdraw(assets, receiver, owner);
}

/// @notice Called by ILShieldCore to draw funds for claim payouts (first-loss)
function withdrawForClaim(uint256 amount, address to) external onlyRole(CORE_ROLE) {
    uint256 available = totalAssets();
    uint256 transferAmount = amount > available ? available : amount;
    usdc.safeTransfer(to, transferAmount);
}
```

---

### 4. ILPNRegistry.sol

**Purpose:** ERC-721 registry for non-transferable IL protection NFTs. Each token encodes exact position parameters.

**Inherits:** OpenZeppelin `ERC721`, `AccessControl`.

**Key Implementation:**

```solidity
/// @notice Override all transfer functions to make tokens soulbound
function _update(address to, uint256 tokenId, address auth)
    internal override returns (address)
{
    address from = _ownerOf(tokenId);
    // Allow minting (from == address(0)) and burning (to == address(0))
    // Block all transfers between non-zero addresses
    if (from != address(0) && to != address(0)) {
        revert NonTransferable();
    }
    return super._update(to, tokenId, auth);
}

/// @notice Mint a new ILPN (only callable by ILShieldCore)
function mint(address to, uint256 tokenId) external onlyRole(CORE_ROLE) {
    _safeMint(to, tokenId);
}

/// @notice Burn an ILPN on settlement or expiry (only callable by ILShieldCore)
function burn(uint256 tokenId) external onlyRole(CORE_ROLE) {
    _burn(tokenId);
}
```

**Metadata:** On-chain SVG rendering showing pool pair, coverage tier, coverage period, and current IL status. Implement via `tokenURI()` override generating base64-encoded SVG.

---

### 5. ILMath.sol (Library)

**Purpose:** Pure math library for computing IL from entry/exit price and tick range. Uses Uniswap's native `TickMath` and `SqrtPriceMath` libraries for precision.

**Core Function:**

```solidity
/// @notice Compute impermanent loss in token1 terms (e.g., USDC)
/// @param entrySqrtPriceX96 sqrtPriceX96 at position entry
/// @param exitSqrtPriceX96 sqrtPriceX96 at position exit
/// @param tickLower Lower tick of concentrated position
/// @param tickUpper Upper tick of concentrated position
/// @param liquidity Liquidity amount
/// @return ilAmount IL in token1 units (always >= 0)
function computeIL(
    uint160 entrySqrtPriceX96,
    uint160 exitSqrtPriceX96,
    int24 tickLower,
    int24 tickUpper,
    uint128 liquidity
) internal pure returns (uint256 ilAmount) {
    // Step 1: Compute position value at entry
    uint256 valueAtEntry = _positionValue(
        entrySqrtPriceX96, tickLower, tickUpper, liquidity, entrySqrtPriceX96
    );

    // Step 2: Compute position value at exit
    uint256 valueAtExit = _positionValue(
        exitSqrtPriceX96, tickLower, tickUpper, liquidity, exitSqrtPriceX96
    );

    // Step 3: Compute HODL value at exit
    // At entry, position held x0 of token0 and y0 of token1
    // HODL value = x0 * P_exit + y0
    (uint256 x0, uint256 y0) = _positionAmounts(
        entrySqrtPriceX96, tickLower, tickUpper, liquidity
    );
    uint256 hodlValue = _token0ValueInToken1(x0, exitSqrtPriceX96) + y0;

    // Step 4: IL = max(0, HODL - LP value)
    ilAmount = hodlValue > valueAtExit ? hodlValue - valueAtExit : 0;
}
```

**Implementation Notes:**

All sqrt price math must use Uniswap's `SqrtPriceMath.getAmount0Delta()` and `getAmount1Delta()` for position amount computation. Use `FullMath.mulDiv()` for safe fixed-point multiplication. All intermediate calculations use `uint256` to avoid overflow. The function must handle three cases: price within range, price below range (100% token0), and price above range (100% token1).

**Required: Python reference implementation** in `reference/il_math_reference.py` that computes identical results for fuzz test comparison. Use `decimal` module with 96 bits of precision to match `sqrtPriceX96` format.

---

### 6. PremiumMath.sol (Library)

**Purpose:** Compute the streaming premium rate using the net IL framework.

**Core Function:**

```solidity
/// @notice Compute premium rate per block
/// @param sigma Annualized volatility (18 decimals, e.g., 0.70e18 = 70%)
/// @param feeRate Pool fee rate (e.g., 3000 = 0.30%)
/// @param expectedVolumePerLiquidity Expected volume/liquidity ratio per block (18 decimals)
/// @param concentrationFactor C(R) from tick range (18 decimals)
/// @param coverageTier 0=50%, 1=75%, 2=100%
/// @param utilizationBps Current vault utilization in basis points
/// @param cLevel Current C-level coefficient (18 decimals)
/// @return ratePerBlock Premium rate in USDC per unit liquidity per block (18 decimals)
function computePremiumRate(
    uint256 sigma,
    uint256 feeRate,
    uint256 expectedVolumePerLiquidity,
    uint256 concentrationFactor,
    uint8 coverageTier,
    uint256 utilizationBps,
    uint256 cLevel
) internal pure returns (uint256 ratePerBlock) {
    // E[GrossIL] per block = (sigma^2 / 8) * C(R) / blocksPerYear
    uint256 grossILPerBlock = FullMath.mulDiv(
        FullMath.mulDiv(sigma, sigma, 1e18),
        concentrationFactor,
        8 * BLOCKS_PER_YEAR * 1e18
    );

    // E[FeeIncome] per block = feeRate * expectedVolumePerLiquidity
    uint256 feeIncomePerBlock = FullMath.mulDiv(
        feeRate, expectedVolumePerLiquidity, 1e6  // feeRate is in 1e6 units
    );

    // NetIL per block = max(0, GrossIL - FeeIncome)
    uint256 netILPerBlock = grossILPerBlock > feeIncomePerBlock
        ? grossILPerBlock - feeIncomePerBlock
        : 0;

    // Apply risk loading: 1.40 + max(0, (sigma - 0.50) * 0.80)
    uint256 riskLoading = _computeRiskLoading(sigma);

    // Apply coverage tier multiplier
    uint256 tierMultiplier = _coverageTierMultiplier(coverageTier);

    // Apply utilization curve (kinked)
    uint256 utilizationMultiplier = _utilizationCurve(utilizationBps);

    // Apply C-level coefficient
    ratePerBlock = FullMath.mulDiv(
        FullMath.mulDiv(
            FullMath.mulDiv(netILPerBlock, riskLoading, 1e18),
            tierMultiplier, 1e18
        ),
        FullMath.mulDiv(utilizationMultiplier, cLevel, 1e18),
        1e18
    );
}
```

---

### 7. ILShieldHook.sol

**Purpose:** Optional Uniswap v4 hook for native integration on greenfield pools.

**Inherits:** `BaseHook` from `v4-periphery`.

**Hook Permissions:**

```solidity
function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
    return Hooks.Permissions({
        beforeInitialize: false,
        afterInitialize: true,
        beforeAddLiquidity: false,
        afterAddLiquidity: true,
        beforeRemoveLiquidity: true,
        afterRemoveLiquidity: true,
        beforeSwap: false,
        afterSwap: true,
        beforeDonate: false,
        afterDonate: false,
        beforeSwapReturnDelta: false,
        afterSwapReturnDelta: false,
        afterAddLiquidityReturnDelta: true,
        afterRemoveLiquidityReturnDelta: true
    });
}
```

**afterSwap Implementation:**

```solidity
function _afterSwap(
    address,
    PoolKey calldata key,
    IPoolManager.SwapParams calldata,
    BalanceDelta,
    bytes calldata
) internal override returns (bytes4, int128) {
    // Update tick accumulator (lightweight, every swap)
    PoolId poolId = key.toId();
    (, int24 currentTick,,) = poolManager.getSlot0(poolId);

    tickAccumulator.update(poolId, currentTick, block.number);

    return (BaseHook.afterSwap.selector, 0);
}
```

**Hook Deployment:** v4 hooks require specific address prefixes matching enabled permissions. Use CREATE2 with salt mining via the `HookMiner` library from `v4-periphery`. The deployment script (`script/DeployHook.s.sol`) must mine a valid salt before deploying.

---

## Testing Requirements

### Unit Tests

Every library function requires fuzz testing with at minimum 10,000 runs. `ILMath.computeIL()` must be fuzz-tested against the Python reference implementation (`reference/il_math_reference.py`) across the full input domain: sqrtPriceX96 from `MIN_SQRT_RATIO` to `MAX_SQRT_RATIO`, tick ranges from 1 tick to full range, and liquidity from 1 to `type(uint128).max`. All fuzz test failures must produce a reproducible seed.

`PremiumMath` property tests must verify: premium is monotonically non-decreasing in volatility, premium is monotonically non-decreasing in concentration factor, premium is zero when expected fee income exceeds expected gross IL, and premium approaches gross IL pricing as fee income approaches zero.

ERC-4626 vaults must pass the full OpenZeppelin ERC-4626 compliance test suite plus custom tests for: lock period enforcement, utilization-based withdrawal throttling, emergency withdrawal penalty, Senior/Junior ratio floor, and `withdrawForClaim` waterfall behavior.

ILPN Registry must verify: tokens cannot be transferred between non-zero addresses (`transferFrom`, `safeTransferFrom`, and `approve` all revert), minting is restricted to `CORE_ROLE`, burning is restricted to `CORE_ROLE`.

### Integration Tests

`FullSettlement.t.sol`: Deploy all contracts, register a position with a mock Uniswap v4 PositionManager, advance blocks to simulate premium streaming, mock a price change, call settle, and verify correct payout from Junior then Senior waterfall.

`HookMode.t.sol`: Use the Uniswap v4 test utilities (`Deployers.sol`) to create a pool with the IL Shield hook, add liquidity, perform swaps, verify tick accumulator updates, remove liquidity, and verify settlement payout.

`TrancheWaterfall.t.sol`: Seed both vaults, create multiple positions, settle claims that progressively exhaust Junior, verify Senior is drawn only after Junior reaches zero, verify Senior depositors' share price decreases proportionally.

`OracleCircuitBreaker.t.sol`: Mock Chainlink and TWAP feeds with divergent prices, verify settlement reverts with `SettlementDelayed`, advance time, set feeds to converge, verify settlement succeeds.

### Invariant Tests

`VaultSolvency.t.sol`: After any sequence of deposits, withdrawals, premium distributions, and claim settlements: `seniorVault.totalAssets() + juniorVault.totalAssets() >= totalOutstandingClaims`.

`PremiumMonotonicity.t.sol`: For any two volatility inputs σ₁ < σ₂ with all other inputs held constant: `premiumRate(σ₁) <= premiumRate(σ₂)`.

### Fork Tests

Fork Ethereum mainnet at a recent block. Deploy IL Shield against live Uniswap v4 PoolManager and Chainlink feeds. Register a real ETH/USDC position. Verify oracle reads succeed. Compute IL against current market state. Verify gas consumption matches targets.

---

## Dependencies

```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
optimizer = true
optimizer_runs = 200
solc_version = "0.8.26"
evm_version = "cancun"      # Required for transient storage (v4)
ffi = true                   # Required for Python reference comparison
fuzz = { runs = 10000 }
invariant = { runs = 1000, depth = 50 }

[profile.default.fmt]
line_length = 120
```

**Forge Dependencies (install via `forge install`):**

```
forge install OpenZeppelin/openzeppelin-contracts
forge install Uniswap/v4-core
forge install Uniswap/v4-periphery
forge install foundry-rs/forge-std
```

**Optional (for Brevis integration):**

```
forge install brevis-network/brevis-contracts
```

**npm Dependencies (for deployment scripts):**

```
npm install dotenv ethers
```

---

## Deployment Sequence

Phase 1 (testnet): Deploy all contracts to Sepolia. Use mock oracles. Single pool (ETH/USDC). Manual settlement. Validate gas targets.

Phase 2 (mainnet controlled): Deploy Core, Vaults, Registry, Oracle to Ethereum mainnet. $10M total vault cap. 3 pools. Gelato keeper for streaming and settlement. 3 audits complete before this phase.

Phase 3 (L2 expansion): Deploy to Arbitrum, Base, Unichain using same contract code. Adjust block time constants for L2 block cadence. Hook deployment on L2s where v4 is available.

---

## Security Considerations

All external calls must follow checks-effects-interactions pattern. Reentrancy guards on all state-mutating vault functions. Oracle staleness checks: Chainlink heartbeat < 60 seconds for mainnet, Pyth freshness < 300 seconds. Timelock all governance parameter changes (48 hours minimum). Maximum 25% of vault assets deployed to external yield protocols (Aave/Morpho). Circuit breaker: pause new registrations if Junior buffer drops below 10% of total outstanding coverage.

Flash loan protection: IL computation uses TWAP and Chainlink (not instantaneous pool price), preventing single-transaction price manipulation. The settlement circuit breaker (3% divergence threshold) provides additional protection.

---

## Gas Budget

| Operation | Target (mainnet) | Target (L2) |
|---|---|---|
| `register()` | < 250,000 | < 150,000 |
| `settle()` (no ZK proof) | < 350,000 | < 200,000 |
| `settle()` (with Brevis proof) | < 600,000 | < 400,000 |
| `processStreaming()` per position | < 80,000 | < 50,000 |
| `afterSwap` hook callback | < 20,000 | < 15,000 |
| Senior/Junior `deposit()` | < 120,000 | < 80,000 |
| Senior/Junior `withdraw()` | < 150,000 | < 100,000 |

---

## Code Style

Solidity: Follow Solidity Style Guide. NatSpec on all public/external functions. Custom errors (not require strings) for gas efficiency. Events on all state changes. Named return values where they improve readability. Constants for magic numbers. Internal functions prefixed with underscore.

Testing: Foundry test naming convention: `test_FunctionName_Condition_ExpectedResult()`. Use `vm.expectRevert()` for negative tests. Use `vm.prank()` for access control tests. Use `deal()` for token balance setup. Log gas usage with `vm.snapshotGasLastCall()` on critical paths.
