# IL Shield Protocol — Development Plan & Agent Team Structure

**Version 1.0 — April 2026**

---

## Executive Summary

IL Shield is a parametric impermanent loss protection protocol for Uniswap v4 LPs. This plan outlines a 24-week path from smart contract development through mainnet deployment, executed by a coordinated team of 16 specialized AI agents.

---

## Phase 0: Foundation (Weeks 1–2)

### Objectives
- Project scaffolding and CI/CD pipeline
- Math libraries with full test coverage
- Python reference implementations for cross-validation

### Deliverables

| Task | Owner Agent | Status |
|------|-------------|--------|
| Foundry project init + dependencies | Deployment Agent | ✅ Complete |
| ILMath.sol — IL computation library | Math Engine Agent | ✅ Complete |
| PremiumMath.sol — Net IL premium formula | Math Engine Agent | ✅ Complete |
| ConcentrationFactor.sol — Tick range multiplier | Math Engine Agent | ✅ Complete |
| VolatilityLib.sol — Yang-Zhang estimator + GWAV | Math Engine Agent | ✅ Complete |
| il_math_reference.py — Python IL computation | Math Engine Agent | ✅ Complete |
| premium_model.py — Python premium computation | Math Engine Agent | ✅ Complete |
| Unit tests: ILMath fuzz (10K+ runs vs Python) | Unit Test Agent | Pending |
| Unit tests: PremiumMath property tests | Unit Test Agent | Pending |
| GitHub Actions CI: build + test on every PR | Deployment Agent | Pending |

### Success Criteria
- All math libraries compile with 0 warnings
- ILMath fuzz tests pass 10,000 runs with 0 failures against Python reference
- PremiumMath monotonicity properties hold across full input domain
- Gas: ILMath.computeIL < 50,000 gas

---

## Phase 1: Core Protocol (Weeks 3–5)

### Objectives
- Full position lifecycle: register → stream → settle
- Tranched vault mechanics with first-loss waterfall
- Oracle integration with circuit breakers

### Deliverables

| Task | Owner Agent | Status |
|------|-------------|--------|
| ILShieldCore.sol — Registry + settlement engine | Core Protocol Agent | ✅ Complete |
| SeniorVault.sol — ERC-4626 senior tranche | Vault Agent | ✅ Complete |
| JuniorVault.sol — ERC-4626 junior tranche | Vault Agent | ✅ Complete |
| ILPNRegistry.sol — Soulbound ERC-721 | NFT Agent | ✅ Complete |
| PricingOracle.sol — Multi-source oracle | Core Protocol Agent | ✅ Complete |
| All interfaces (6 files) | Core Protocol Agent | ✅ Complete |
| Unit: SeniorVault ERC-4626 compliance suite | Unit Test Agent | Pending |
| Unit: JuniorVault S/J ratio enforcement | Unit Test Agent | Pending |
| Unit: ILPNRegistry non-transferability | Unit Test Agent | Pending |
| Unit: PricingOracle staleness + composition | Unit Test Agent | Pending |
| Integration: FullSettlement.t.sol (end-to-end) | Integration Test Agent | Pending |
| Integration: TrancheWaterfall.t.sol | Integration Test Agent | Pending |
| Integration: OracleCircuitBreaker.t.sol | Integration Test Agent | Pending |

### Success Criteria
- register() < 250,000 gas, settle() < 350,000 gas
- ERC-4626 compliance: all standard methods behave correctly
- Tranche waterfall: Junior fully exhausted before Senior touched
- Oracle circuit breaker triggers at 3% divergence

---

## Phase 2: Hook + Periphery (Weeks 6–7)

### Objectives
- Uniswap v4 native hook integration
- User-facing router and keeper infrastructure
- ZK coprocessor integration

### Deliverables

| Task | Owner Agent | Status |
|------|-------------|--------|
| ILShieldHook.sol — v4 hook (7 callbacks) | Hook Agent | ✅ Complete |
| TickAccumulator.sol — Per-block tick storage | Hook Agent | ✅ Complete |
| ILShieldRouter.sol — Multicall + permit | Core Protocol Agent | ✅ Complete |
| KeeperModule.sol — Gelato + Chainlink Automation | Keeper Agent | ✅ Complete |
| BrevisCallback.sol — ZK proof verification | Core Protocol Agent | ✅ Complete |
| Integration: HookMode.t.sol (pool lifecycle) | Integration Test Agent | Pending |
| Deploy scripts (Deploy, DeployHook, Seed) | Deployment Agent | ✅ Complete |

### Success Criteria
- afterSwap hook callback < 20,000 gas
- Tick accumulator correctly computes TWAP over arbitrary windows
- CREATE2 salt mining produces valid hook addresses
- Router multicall bundles register+fund atomically

---

## Phase 3: Testing & Hardening (Weeks 8–10)

### Objectives
- Invariant testing for protocol-wide safety properties
- Fork tests against live mainnet state
- Gas optimization to meet all targets
- Historical backtesting

### Deliverables

| Task | Owner Agent |
|------|-------------|
| VaultSolvency.t.sol — Senior + Junior ≥ claims | Invariant Test Agent |
| PremiumMonotonicity.t.sol — σ₁ < σ₂ ⟹ premium₁ ≤ premium₂ | Invariant Test Agent |
| MainnetFork.t.sol — Live Uniswap v4 + Chainlink | Fork Test Agent |
| BacktestIL.t.sol — Historical ETH 2020–2025 | Fork Test Agent |
| Gas optimization pass (all targets met) | Math Engine Agent + Core Protocol Agent |
| Flash loan attack vectors | Security Agent |
| Oracle manipulation scenarios | Security Agent |
| MEV extraction analysis | Security Agent |
| Reentrancy audit (all external calls) | Security Agent |
| Slither + Mythril static analysis | Security Agent |

### Success Criteria
- 0 invariant violations across 5,000 runs at depth 100
- Fork tests pass against live Uniswap v4 PoolManager
- All gas targets met (see Gas Budget in spec)
- 0 critical/high findings from static analysis
- Historical backtest validates 60–80% combined ratio

### Gas Budget Verification

| Operation | Target (mainnet) | Target (L2) |
|-----------|----------------:|------------:|
| `register()` | < 250,000 | < 150,000 |
| `settle()` (no ZK) | < 350,000 | < 200,000 |
| `settle()` (with Brevis) | < 600,000 | < 400,000 |
| `processStreaming()` per pos | < 80,000 | < 50,000 |
| `afterSwap` hook | < 20,000 | < 15,000 |
| Vault `deposit()` | < 120,000 | < 80,000 |
| Vault `withdraw()` | < 150,000 | < 100,000 |

---

## Phase 4: Simulation & Battle Testing (Weeks 11–14)

### Objectives
- Deploy to Unichain Sepolia devnet
- Agent-based market simulation
- Stress test across 5 market scenarios

### 4.1 Devnet Deployment

1. Deploy full contract suite to **Unichain Sepolia**
2. Configure mock Chainlink feeds with controllable prices
3. Seed vaults: $5M Senior, $1M Junior (testnet USDC)
4. Activate Gelato keeper for streaming and vol updates
5. Create 3 test pools: ETH/USDC, ETH/USDT, WBTC/ETH

### 4.2 Simulation Agent Framework

The Simulation Agent orchestrates a multi-agent market simulation:

```
┌─────────────────────────────────────────────────┐
│                 SIMULATION ENGINE                │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │ LP Agents│  │  Whale   │  │  Arbitrage   │  │
│  │ (20-50)  │  │  Agents  │  │  Agents      │  │
│  │          │  │  (5-10)  │  │  (10-20)     │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                                                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  │
│  │  Claim   │  │  Vault   │  │   Attack     │  │
│  │  Agents  │  │ Depositor│  │   Agents     │  │
│  │  (20-50) │  │  (10-20) │  │   (5-10)     │  │
│  └──────────┘  └──────────┘  └──────────────┘  │
│                                                  │
│  ┌──────────────────────────────────────────┐   │
│  │         Keeper Agent (1)                  │   │
│  │  - Process streaming every 7200 blocks   │   │
│  │  - Update vol every 1200 blocks          │   │
│  │  - Monitor circuit breakers              │   │
│  └──────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**LP Agents** (20-50 instances):
- Behaviors: Random position entry with varying tick ranges, coverage tiers, durations
- Distribution: 30% conservative (wide range, 50% tier), 40% moderate, 30% aggressive (tight range, 100% tier)
- Actions: register, topUpPremium, cancelProtection, settle

**Whale Agents** (5-10 instances):
- Behaviors: Large directional swaps to move prices
- Frequency: Every 100-500 blocks
- Size: 1-10% of pool liquidity per swap

**Arbitrage Agents** (10-20 instances):
- Behaviors: Cross-pool and cross-DEX arbitrage
- Trigger: >0.3% price deviation between sources
- Effect: Maintains price parity, generates swap volume

**Claim Agents** (20-50 instances):
- Behaviors: Settle positions at various IL levels
- Strategy: Some settle immediately on IL, others hold through vol

**Vault Depositor Agents** (10-20 instances):
- Behaviors: Deposit/withdraw from Senior and Junior vaults
- Distribution: 70% Senior (conservative), 30% Junior (risk-seeking)
- Actions: deposit, withdraw, emergencyWithdraw

**Attack Agents** (5-10 instances):
- Behaviors: Adverse selection (buy protection before anticipated vol events)
- Behaviors: Oracle manipulation attempts (large swaps before settlement)
- Behaviors: Flash loan attacks targeting settlement price
- Behaviors: Sandwich attacks on registration transactions

**Keeper Agent** (1 instance):
- Processes streaming premiums in batches
- Updates realized and implied volatility
- Monitors and triggers circuit breakers

### 4.3 Stress Test Scenarios

| Scenario | Volatility | Price Path | Expected Outcome |
|----------|-----------|------------|------------------|
| Normal Market | σ ≈ 40% | Random walk | Combined ratio 60-80%, Junior +29% APY |
| Moderate Vol | σ ≈ 70% | Trending with mean reversion | Combined ratio ~50%, Junior +44% APY |
| Crisis | σ ≈ 120% | Sharp drawdown (-40%) | Junior absorbs all claims, Senior unaffected |
| Flash Crash | σ ≈ 150%+ | -40% in 1 hour, recovery | Circuit breakers halt settlement, Junior wiped |
| Stablecoin Depeg | N/A | USDT -5% from peg | Vault basket limits exposure to 30% |

### 4.4 Fix Phase
- Triage all simulation findings by severity
- Critical/High: Fix immediately, re-run full simulation
- Medium: Fix and verify with targeted test
- Low: Document and schedule for post-launch

---

## Phase 5: Audit & Pre-Mainnet (Weeks 15–20)

### 5.1 Audit Pipeline

| Stage | Provider | Scope | Timeline | Budget |
|-------|----------|-------|----------|--------|
| Internal prep | Security Agent | Full contract suite | Week 15 | — |
| Audit 1 | OpenZeppelin or Trail of Bits | Core + Vaults + Oracle | Weeks 16-17 | $150-300K |
| Audit 2 | Spearbit | Hook + Libraries + Settlement | Weeks 17-18 | $100-200K |
| Competitive | Code4rena | Full protocol | Weeks 18-19 | $500K+ pot |
| Formal verification | Certora Prover | ILMath + settlement logic | Weeks 19-20 | $50-100K |

### 5.2 Bug Bounty
- Launch on Immunefi at Week 19
- Critical: up to $500K (vault drain, incorrect settlement)
- High: up to $100K (premium manipulation, oracle bypass)
- Medium: up to $25K (access control, DoS)

### 5.3 Remediation Protocol
- All Critical findings: 48-hour fix + re-audit of fix
- All High findings: 1-week fix cycle
- Medium/Low: batched fix before deployment
- No deployment until 0 open Critical/High across all audits

---

## Phase 6: Mainnet Deployment (Weeks 21–24)

### 6.1 Deployment Sequence

**Week 21: Ethereum Mainnet (Guarded Launch)**
- Deploy full suite with $10M total vault cap ($8M Senior, $2M Junior)
- 3 initial pools: ETH/USDC, ETH/USDT, WBTC/ETH
- Gelato + Chainlink Automation keepers activated
- OpenZeppelin Defender Sentinel monitoring

**Week 22: Unichain Mainnet**
- Deploy identical contracts (adjusted block times)
- Hook deployment with native pool creation
- Cross-chain keeper coordination

**Week 23: Monitoring & Cap Increase**
- 2-week observation period
- If combined ratio < 100% and no incidents: increase cap to $50M
- Graduate warming period: 72h → 48h based on data

**Week 24: L2 Expansion**
- Deploy to Arbitrum and Base
- Lower minimum position size for L2 (gas-viable at $100+ positions)
- Protocol-owned hook pools on each L2

### 6.2 Mainnet Monitoring

| Metric | Alert Threshold | Action |
|--------|----------------|--------|
| Combined ratio | > 100% monthly | Increase C-level by 20% |
| Junior buffer | < 10% of coverage | Pause new registrations |
| Chainlink staleness | > 30 min | Activate Pyth fallback |
| TWAP divergence | > 3% | Auto-delay settlements |
| Vault utilization | > 85% | Exponential premium increase |
| Gas costs | > 2x target | Investigate optimization |

---

## Agent Team Structure

### Smart Contract Agents

#### 1. Math Engine Agent
- **Responsibility:** ILMath, PremiumMath, ConcentrationFactor, VolatilityLib
- **Tools:** Foundry, Python reference implementations, Wolfram Alpha for verification
- **Inputs:** Mathematical spec (Section 5 of definitive spec)
- **Outputs:** Gas-optimized libraries, fuzz test vectors
- **Success Criteria:** All fuzz tests pass, gas targets met, numerical precision matches Python to ±1 wei
- **Interfaces With:** Unit Test Agent (test vectors), Core Protocol Agent (integration)

#### 2. Core Protocol Agent
- **Responsibility:** ILShieldCore, PricingOracle, position lifecycle
- **Tools:** Foundry, OpenZeppelin contracts, Chainlink interfaces
- **Inputs:** Architecture spec (Section 4, 8), libraries from Math Engine Agent
- **Outputs:** Core contracts with full NatSpec and event emission
- **Success Criteria:** Register/settle gas targets, correct premium streaming, accurate settlement
- **Interfaces With:** Vault Agent (claim payouts), NFT Agent (ILPN mint/burn), Math Engine Agent (libraries)

#### 3. Vault Agent
- **Responsibility:** SeniorVault, JuniorVault, ERC-4626 compliance
- **Tools:** Foundry, OpenZeppelin ERC4626 test suite
- **Inputs:** Vault spec (Sections 4.2, 7.2, 7.3), Core Protocol Agent API
- **Outputs:** Tranched vaults with withdrawal throttling and waterfall
- **Success Criteria:** Full ERC-4626 compliance, correct S/J ratio enforcement, lock periods
- **Interfaces With:** Core Protocol Agent (withdrawForClaim, receivePremium)

#### 4. NFT Agent
- **Responsibility:** ILPNRegistry, soulbound mechanics, on-chain SVG
- **Tools:** Foundry, OpenZeppelin ERC721
- **Inputs:** ILPN spec (Section 4.2), metadata requirements
- **Outputs:** Non-transferable ERC-721 with on-chain metadata
- **Success Criteria:** Transfer blocked between non-zero addresses, SVG renders correctly
- **Interfaces With:** Core Protocol Agent (mint/burn triggers)

#### 5. Hook Agent
- **Responsibility:** ILShieldHook, TickAccumulator, v4 integration
- **Tools:** Foundry, Uniswap v4-core, v4-periphery
- **Inputs:** Hook spec (Section 4.1, 4.2), v4 callback API
- **Outputs:** Hook with correct permissions, tick accumulation, return deltas
- **Success Criteria:** afterSwap < 20K gas, correct TWAP computation, CREATE2 deployment
- **Interfaces With:** Core Protocol Agent (settlement data), Deployment Agent (salt mining)

### Testing Agents

#### 6. Unit Test Agent
- **Responsibility:** Unit + fuzz tests for every library and contract
- **Tools:** Foundry (forge test), Python FFI for reference comparison
- **Inputs:** All contract source files, Python reference implementations
- **Outputs:** test/unit/*.t.sol files with 10K+ fuzz runs
- **Success Criteria:** 100% function coverage, 0 fuzz failures, property tests pass

#### 7. Integration Test Agent
- **Responsibility:** End-to-end flows, cross-contract interaction tests
- **Tools:** Foundry, mock contracts
- **Inputs:** Full contract suite, expected flow documentation
- **Outputs:** test/integration/*.t.sol
- **Success Criteria:** Full settlement flow works, tranche waterfall correct, circuit breakers trigger

#### 8. Invariant Test Agent
- **Responsibility:** Protocol-wide safety invariants
- **Tools:** Foundry invariant testing framework
- **Inputs:** Protocol invariants (vault solvency, premium monotonicity)
- **Outputs:** test/invariant/*.t.sol with 1000 runs, depth 50+
- **Success Criteria:** 0 violations across all invariants

#### 9. Fork Test Agent
- **Responsibility:** Mainnet fork tests, historical backtesting
- **Tools:** Foundry fork mode, RPC endpoints
- **Inputs:** Live Uniswap v4, Chainlink addresses, historical price data
- **Outputs:** test/fork/*.t.sol
- **Success Criteria:** Deployment works against live infra, gas targets met, backtest validates pricing

#### 10. Security Agent
- **Responsibility:** Adversarial testing, static analysis, vulnerability assessment
- **Tools:** Slither, Mythril, manual review, Foundry exploit PoCs
- **Inputs:** All contract source, known DeFi attack patterns
- **Outputs:** Security report, attack PoC tests, fix recommendations
- **Success Criteria:** 0 critical/high exploitable vulnerabilities

### Infrastructure Agents

#### 11. Deployment Agent
- **Responsibility:** Deploy scripts, multi-chain deployment, contract verification
- **Tools:** Foundry scripts, Etherscan API, chain-specific configs
- **Inputs:** Compiled contracts, deployment parameters per chain
- **Outputs:** Deployment scripts, verified contracts, deployment addresses
- **Success Criteria:** Deterministic deployments, all contracts verified on block explorers

#### 12. Keeper Agent
- **Responsibility:** Gelato + Chainlink Automation setup, vol update scheduling
- **Tools:** Gelato SDK, Chainlink Automation, keeper scripts
- **Inputs:** KeeperModule contract, vol data sources (Deribit API)
- **Outputs:** Automated keeper infrastructure, monitoring
- **Success Criteria:** Streaming processed within 24h, vol updated every 4h, 99.9% uptime

#### 13. Simulation Agent
- **Responsibility:** Agent-based market simulation, stress testing
- **Tools:** Python + web3.py, Foundry anvil (local chain), statistical analysis
- **Inputs:** Deployed devnet contracts, scenario parameters
- **Outputs:** Simulation results, combined ratio analysis, failure mode report
- **Success Criteria:** Protocol solvent across all 5 stress scenarios, combined ratio within target

### Peripheral Agents

#### 14. Frontend Agent
- **Responsibility:** React dashboard for LP registration, monitoring, claims
- **Tools:** React, Next.js, wagmi, viem, TailwindCSS
- **Inputs:** Contract ABIs, design mockups
- **Outputs:** Deployed web application
- **Success Criteria:** Users can register, monitor, and settle positions through UI

#### 15. Subgraph Agent
- **Responsibility:** The Graph indexing for analytics and frontend data
- **Tools:** The Graph, AssemblyScript
- **Inputs:** Contract events, entity schemas
- **Outputs:** Deployed subgraph on The Graph decentralized network
- **Success Criteria:** Real-time indexing of all protocol events, <5s query latency

#### 16. Monitoring Agent
- **Responsibility:** OpenZeppelin Defender setup, alerting, dashboards
- **Tools:** OZ Defender Sentinel, Grafana, PagerDuty
- **Inputs:** Contract addresses, alert thresholds
- **Outputs:** Monitoring dashboards, alert rules, incident playbooks
- **Success Criteria:** All critical metrics monitored, <1 min alert latency

---

## Agent Dependency Graph

```
                    ┌──────────────────┐
                    │  Math Engine (1) │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌──────────────┐ ┌─────────────┐ ┌──────────┐
    │Core Proto (2)│ │ Vault (3)   │ │ NFT (4)  │
    └──────┬───────┘ └──────┬──────┘ └────┬─────┘
           │                │              │
           ├────────────────┼──────────────┘
           ▼                ▼
    ┌──────────────┐ ┌─────────────┐
    │  Hook (5)    │ │ Unit Test(6)│
    └──────┬───────┘ └──────┬──────┘
           │                │
    ┌──────┴────────────────┴──────┐
    │     Integration Test (7)     │
    └──────────────┬───────────────┘
                   │
    ┌──────────────┼──────────────┐
    ▼              ▼              ▼
┌────────┐ ┌───────────┐ ┌───────────┐
│Invar(8)│ │ Fork (9)  │ │Security(10│
└────┬───┘ └─────┬─────┘ └─────┬─────┘
     │           │              │
     └───────────┼──────────────┘
                 ▼
    ┌────────────────────────┐
    │    Deployment (11)     │
    └────────────┬───────────┘
                 │
    ┌────────────┼──────────────┐
    ▼            ▼              ▼
┌────────┐ ┌──────────┐ ┌───────────┐
│Keep(12)│ │ Sim (13) │ │Frontend(14│
└────────┘ └──────────┘ └───────────┘
                         ┌───────────┐
                         │Subgraph(15│
                         └───────────┘
                         ┌───────────┐
                         │Monitor(16)│
                         └───────────┘
```

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Smart contract exploit | Medium | Critical | 3 audits + formal verification + $500K bug bounty |
| Oracle manipulation | Medium | High | 3-layer oracle (Chainlink + TWAP + Pyth), 3% circuit breaker |
| Adverse selection death spiral | Medium | High | 4-layer anti-selection: warming period, bonus-malus, tiered menu, C-level repricing |
| Junior vault depletion | Medium | Medium | Reinsurance (OrBit/Derive), 10% circuit breaker, Senior buffer |
| Regulatory action | Low | Critical | Bermuda BMA sandbox, non-transferable tokens, no native token |
| Stablecoin depeg | Low | High | Diversified basket (60/30/10), quarterly rebalance |
| Gas cost spike | Low | Medium | L2 deployment, batch processing, lazy settlement |
| Keeper downtime | Low | Medium | Redundant keepers (Gelato + Chainlink), permissionless fallback |

---

## Timeline Summary

```
Week  1-2  ████ Phase 0: Foundation (Math libraries, Python refs)
Week  3-5  ██████ Phase 1: Core Protocol (Core, Vaults, Oracle, Registry)
Week  6-7  ████ Phase 2: Hook + Periphery (Hook, Router, Keeper, Brevis)
Week  8-10 ██████ Phase 3: Testing & Hardening (Invariants, Fork, Gas, Security)
Week 11-14 ████████ Phase 4: Simulation (Devnet deploy, Agent simulation, Stress test)
Week 15-20 ████████████ Phase 5: Audit (OZ, Spearbit, Code4rena, Certora, Bug bounty)
Week 21-24 ████████ Phase 6: Mainnet (Ethereum, Unichain, Arbitrum, Base)
```

---

## Estimated Resources

| Category | Estimate |
|----------|----------|
| Smart contract development | 16 AI agents, 24 weeks |
| Audit budget | $800K–$1.1M (3 audits + competitive + formal verification) |
| Bug bounty (year 1) | $500K max payout pool |
| Keeper infrastructure | $5K–$10K/month (Gelato + Chainlink Automation) |
| Monitoring | $2K–$5K/month (OZ Defender + Grafana) |
| Initial vault seed | $3M–$5M (Junior: $1M protocol treasury, Senior: $2-4M strategic) |
| Frontend + subgraph | 4–6 weeks concurrent with audit phase |
