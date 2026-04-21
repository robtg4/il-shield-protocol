# IL Shield vs BELTA — Competitive Analysis

## Executive Summary

Both IL Shield and BELTA address the same problem: impermanent loss costs Uniswap LPs $1.5-3B annually. BELTA proposes a v4-only hook with fixed 35% coverage backed by a governance token. IL Shield offers user-chosen coverage (50-100%) across 5 DEXs, backed entirely by stablecoin vaults with no native token. IL Shield is further along in development (deployed with 252 tests) while BELTA has published a stronger backtest. Both approaches are viable; IL Shield's stablecoin-only collateral and multi-DEX reach make it the more robust and accessible protocol.

---

## Side-by-Side Comparison

| Dimension | IL Shield | BELTA |
|-----------|-----------|-------|
| **Coverage** | 50%, 75%, or 100% (user choice) | Fixed 35% |
| **Premium model** | Net IL actuarial pricing (per-block streaming) | 12% flat fee on LP income |
| **Collateral** | USDC only (stablecoin vaults) | BELTA token + USDC pool |
| **Native token** | None | BELTA + xBELTA staking |
| **DEX support** | Uni v3, Uni v4, PancakeSwap, SushiSwap, Aerodrome | Uniswap v4 only |
| **Risk tranching** | Senior (last-loss) + Junior (first-loss) | Single underwriting pool |
| **Minimum position** | None | $10,000 |
| **Hold period** | None (cancel anytime) | 72 hours minimum |
| **Oracle** | Chainlink + TWAP + circuit breaker | V4 internal tick data only |
| **Settlement** | Per-transaction | 7-day epochs |
| **Tests** | 252 passing, 97% branch coverage | "Foundry scaffold" (count unknown) |
| **Deployment** | Live on Ethereum Sepolia (4 DEX adapters) | Pre-testnet |
| **Backtest** | 6.2 years, monthly epochs | 5.1 years, weekly epochs |
| **Yield on idle** | Planned (Aave/Morpho) | Aave yield stacking (~5%/yr) |
| **Dynamic fees** | Planned (v4 hook EWMA) | beforeSwap fee scaling (up to 4x) |
| **Anti-gaming** | Warming period, coverage ramp, C-level repricing | Reject narrow ranges, min hold, epoch settlement |

---

## BELTA's Critical Weaknesses

### 1. Token-backed collateral = Bancor risk
BELTA has a governance token (BELTA) and staking vault (xBELTA). Revenue flows to token holders. This creates **correlated collateral risk** — the exact failure mode that killed Bancor v3. When the market crashes (triggering IL claims), the BELTA token will also crash, reducing the protocol's ability to pay claims when they're needed most.

**IL Shield:** Pure USDC collateral. Vault solvency is uncorrelated with market conditions.

### 2. Fixed 35% coverage = not real protection
LPs cannot choose their coverage level. 35% means a $1,000 IL event only reimburses $350. For LPs with concentrated positions in volatile markets, this is insufficient.

**IL Shield:** 50/75/100% tiers. At 100%, LPs recover their full IL minus a 2% fee.

### 3. V4 hook only = ignores majority of LP TVL
As of 2026, the vast majority of LP TVL remains on Uniswap v3, PancakeSwap v3, and SushiSwap v3. BELTA cannot serve these positions.

**IL Shield:** Multi-DEX adapters serve v3 and v4 positions across 5 DEXs. One `UniswapV3Adapter` contract deployed with different constructor args per DEX.

### 4. $10K minimum = excludes retail
The $10,000 minimum position requirement excludes retail LPs — the segment most vulnerable to IL and least able to hedge manually.

**IL Shield:** No minimum. A $50 LP position can be protected.

### 5. Single-pool architecture = no risk stratification
All underwriting capital in one pool. Conservative depositors share losses equally with risk-seeking depositors. No optionality.

**IL Shield:** Senior vault (8-12% APY, last-loss) vs Junior vault (20-50% APY, first-loss). Depositors choose their risk tolerance.

### 6. External perps dependency
BELTA's Phase 2+ relies on dYdX, GMX, and Hyperliquid for delta-hedging. These are external protocol dependencies that introduce counterparty risk, funding rate costs (~2%/yr), and liquidity availability concerns.

**IL Shield:** No external dependencies beyond Chainlink oracles (battle-tested, industry standard).

---

## IL Shield's Advantages (with evidence)

### Stablecoin-only collateral
- Vault solvency proven through invariant testing: 50,000 random operations, 0 violations
- Junior first-loss buffer protects Senior depositors during crises
- No token that can crash when claims peak

### User-chosen coverage
- 50% tier for cost-conscious LPs
- 100% tier for maximum protection
- Deposit guidance shows exactly how much to deposit for real coverage at each price move

### Multi-DEX addressable market
- 4 adapter contracts deployed on Sepolia reading real positions
- Fork tests verify adapter reads against live v3 NonfungiblePositionManagers
- ~10x larger addressable market vs v4-only approach

### Production readiness
- 252 tests (unit, integration, adversarial, invariant, fork)
- ILShieldCore: 97.06% branch coverage
- Live dapp with wallet connection, position detection, analytics
- Real V4 swap executed on forked Sepolia PoolManager

---

## Where BELTA is Ahead (honest assessment)

| Feature | BELTA | IL Shield | Gap |
|---------|-------|-----------|-----|
| Published backtest | 5.1yr, detailed | 6.2yr, comparable | **Closed** |
| Dynamic fee hook | beforeSwap EWMA, up to 4x | Planned, not implemented | **Open** |
| Yield on idle capital | Aave ~5%/yr | Planned, not implemented | **Open** |
| No oracle dependency | V4 tick data only | Chainlink + TWAP | Mitigated by circuit breaker |
| Epoch settlement | Anti-flash-loan | Per-tx with warming period | Different approach, both valid |

---

## Recommended Grant Positioning

### For Uniswap Foundation
- Lead with multi-DEX: "IL Shield protects LPs across the entire Uniswap ecosystem — v3 and v4 — plus PancakeSwap, SushiSwap, and Aerodrome. BELTA only serves v4."
- Emphasize no token: "No governance token means no Bancor-style collapse risk."
- Show the backtest: combined ratio 1.16x, survived all crises

### For Chainlink BUILD
- Lead with oracle integration: "IL Shield uses Chainlink ETH/USD as the settlement price oracle with a 3% divergence circuit breaker."
- Highlight the 252 tests including fork tests against live Chainlink feeds

### For General DeFi Grants
- Lead with the problem: "$1.5-3B annual IL losses, 60% of LP positions unprofitable"
- Show the tranche model as an innovation: "First tranched IL protection protocol — Senior depositors get bond-like yield, Junior depositors get equity-like returns"
- Emphasize production readiness vs BELTA's "scaffold" stage

---

*This analysis is based on BELTA's RFC posted on Uniswap Governance Forum and IL Shield's deployed codebase as of April 2026.*
