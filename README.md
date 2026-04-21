# IL Shield Protocol

**Parametric impermanent loss protection for concentrated liquidity providers.**

![Tests](https://img.shields.io/badge/tests-252%20passing-brightgreen) ![Solidity](https://img.shields.io/badge/solidity-0.8.26-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Coverage](https://img.shields.io/badge/branch%20coverage-97%25-brightgreen) ![Chains](https://img.shields.io/badge/chains-Sepolia-purple)

[Website](https://ilshield.xyz) · [Research](https://ilshield.xyz/research) · [GitHub](https://github.com/robtg4/il-shield-protocol)

---

## Overview

IL Shield is insurance for concentrated liquidity providers. LPs pay a streaming USDC premium and receive parametric payouts when impermanent loss exceeds their fee income. Claims are paid from tranched stablecoin vaults — not from minted tokens, not from protocol reserves.

**The problem:** Impermanent loss costs LPs an estimated $1.5-3B annually. Over 60% of non-stablecoin concentrated positions end up unprofitable. Concentrated liquidity amplifies IL by 5-8x compared to full-range positions.

**The solution:** Actuarial pricing based on the Net IL framework (premium = max(0, gross IL - fee income) x risk loading). Stablecoin collateral means vault solvency is uncorrelated with the market crashes that trigger claims. Two-tranche underwriting gives depositors a risk/return spectrum. No native token.

**Backtested:** 6.2 years of ETH/USD data (2020-2026) including COVID, LUNA, FTX, and 2024 yen carry trade crashes. Combined ratio 1.16x — LPs receive more in payouts than they pay in premiums at every coverage tier. Protocol survives all historical stress scenarios.

---

## How It Works

```
LP Position → Register with IL Shield → Stream USDC Premium → Close Position
                                                                    │
                                                    IL > Fee Income? → Payout from Vaults
                                                    IL ≤ Fee Income? → Remaining premium refunded
```

1. **LP normally** — provide liquidity on any supported DEX
2. **Activate protection** — choose coverage tier (50/75/100%), deposit USDC premium
3. **Premium streams per-block** — small deduction each block, scales with position size
4. **Settle when ready** — if IL occurred, payout is automatic. If not, unused premium refunded.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ILShieldCore                                │
│          Registration · Premium Streaming · Settlement               │
├──────────┬──────────┬──────────────┬───────────────┬────────────────┤
│ Senior   │ Junior   │ ILPN         │ Pricing       │ ILShield       │
│ Vault    │ Vault    │ Registry     │ Oracle        │ Hook (v4)      │
│ ERC-4626 │ ERC-4626 │ Soulbound    │ Chainlink+    │ Optional       │
│ Last-loss│ 1st-loss │ ERC-721      │ TWAP+Vol      │ Atomic         │
└──────────┴──────────┴──────────────┴───────────────┴────────────────┘
```

| Contract | Purpose |
|----------|---------|
| **ILShieldCore** | Position registry, premium streaming, claim settlement |
| **SeniorVault** | ERC-4626 vault, last-loss tranche, 8-12% target APY |
| **JuniorVault** | ERC-4626 vault, first-loss tranche, 20-50% target APY |
| **ILPNRegistry** | Non-transferable ERC-721 protection position NFTs |
| **PricingOracle** | Chainlink + TWAP + volatility feeds for actuarial pricing |
| **ILShieldHook** | Optional Uniswap v4 hook for atomic in-pool protection |
| **UniswapV3Adapter** | Reads positions from any v3 fork (Uni, PCS, Sushi, Aero) |
| **UniswapV4Adapter** | Reads positions from v4 PositionManager + StateView |

---

## Key Features

- **Net IL pricing** — premium = max(0, gross IL - fee income) x risk loading x C-level
- **Tranched underwriting** — Senior vault (last-loss) + Junior vault (first-loss)
- **Multi-DEX** — Uniswap v3/v4, PancakeSwap, SushiSwap, Aerodrome via adapter pattern
- **User-chosen coverage** — 50%, 75%, or 100% of IL covered
- **Liquidity-scaled premiums** — larger positions pay proportionally more
- **Anti-adverse selection** — warming period, coverage ramp, streaming premiums, C-level repricing
- **Oracle integration** — Chainlink + TWAP with 3% divergence circuit breaker
- **Soulbound NFTs** — non-transferable ERC-721 protection tokens
- **No native token** — all stablecoin denominated

---

## Deployments

### Ethereum Sepolia (latest — v4 with liquidity scaling)

| Contract | Address |
|----------|---------|
| ILShieldCore | [`0x772F171b0b382D26961E3803c7FB1f206102a236`](https://sepolia.etherscan.io/address/0x772F171b0b382D26961E3803c7FB1f206102a236) |
| SeniorVault | [`0x71A79914bd89CA46D73Dd645357aC076f524C678`](https://sepolia.etherscan.io/address/0x71A79914bd89CA46D73Dd645357aC076f524C678) |
| JuniorVault | [`0xE4cf05DdE8c5f299C3798a49e2A6Be596C3b7E7d`](https://sepolia.etherscan.io/address/0xE4cf05DdE8c5f299C3798a49e2A6Be596C3b7E7d) |
| PricingOracle | [`0xa225407cC259241CeA87a4007443da5BcFF180F0`](https://sepolia.etherscan.io/address/0xa225407cC259241CeA87a4007443da5BcFF180F0) |
| V3 Adapter (Uniswap) | [`0x89eA6bdE36BB30bD8594F5855534f05866f3DF26`](https://sepolia.etherscan.io/address/0x89eA6bdE36BB30bD8594F5855534f05866f3DF26) |
| V3 Adapter (SushiSwap) | [`0x6183b311328Eb90B1437fBBfDfC434d333A633D6`](https://sepolia.etherscan.io/address/0x6183b311328Eb90B1437fBBfDfC434d333A633D6) |
| V3 Adapter (PancakeSwap) | [`0x2e41a526f217202FC06f3c6dD3B506f446772Ca0`](https://sepolia.etherscan.io/address/0x2e41a526f217202FC06f3c6dD3B506f446772Ca0) |

---

## Testing

### Summary

| Category | Tests | What it covers |
|----------|-------|---------------|
| Unit | 77 | ILMath fuzz (10K runs vs Python), PremiumMath properties, ERC-4626, ILPN |
| Integration | 7 | Full lifecycle, tranche waterfall, adversarial flows |
| Adversarial | 50 | Access control, economic attacks, oracle manipulation, reentrancy, adapter exploits |
| Invariant | 1 suite (50K calls) | Vault solvency across random operation sequences |
| Fork (Sepolia) | 84 | Live Chainlink, real V4 swap, adapter reads, settlement |
| **Total** | **252** | **0 failures** |

**ILShieldCore branch coverage: 97.06%** (33/34 branches).

### How to Run

```bash
# Full CI suite
forge test --no-match-path "test/fork/*"

# Fork tests (requires Sepolia RPC)
export SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv

# Coverage
forge coverage --ir-minimum --no-match-path "test/fork/*"
```

### Test Proof Index

| Proof | Location | What it proves |
|-------|----------|---------------|
| Round 5 manifest | [`test_results/PROOF_MANIFEST.md`](test_results/PROOF_MANIFEST.md) | 252 tests, 0 failures, Chainlink anchor |
| Fork proof (latest) | [`test_results/fork_proof_round6_*.txt`](test_results/) | 84 fork tests on live Sepolia |
| CI suite (latest) | [`test_results/ci_round6_*.txt`](test_results/) | 168 CI tests including fuzz |
| Coverage report | [`test_results/adapter_coverage.txt`](test_results/adapter_coverage.txt) | 97% ILShieldCore branch coverage |
| Gas analysis | [`test_results/gas_analysis.md`](test_results/gas_analysis.md) | All operations within gas budget |
| Coverage gaps | [`test_results/coverage_gaps.md`](test_results/coverage_gaps.md) | Documented untested paths |
| Live Sepolia S01-S10 | [`test_results/sepolia_live/`](test_results/sepolia_live/) | 9 live transaction tests with Etherscan hashes |
| E2E position metrics | [`test_results/sepolia_live/E2E_position_metrics.md`](test_results/sepolia_live/E2E_position_metrics.md) | Real V3 LP on anchor pool |
| Adapter unit tests | [`test_results/adapter_unit.txt`](test_results/adapter_unit.txt) | 14 adapter-specific tests |
| Adapter fork tests | [`test_results/adapter_fork.txt`](test_results/adapter_fork.txt) | V3 adapters read real positions on Sepolia |

### Key Test Highlights

- **ILMath fuzz:** 10,000 runs against Python reference (`reference/il_math_reference.py`), all match within 1 wei
- **PremiumMath properties:** 40,000 fuzz runs verifying monotonicity in volatility and concentration
- **Vault solvency invariant:** 1,000 runs with 50,000 random handler calls — 0 violations
- **Real V4 swap (F01):** Executed a swap on live forked Uniswap V4 PoolManager, verified price movement and IL computation
- **Live Sepolia S01-S10:** Mint, deposit, register, settle, double-settle revert, warming bypass revert, cancel refund, vault withdrawal — all with Etherscan-verifiable tx hashes
- **Adapter adversarial:** Unapproved adapter reverts, inflated liquidity capped, empty position reverts, revoke+re-register blocked, cross-DEX independent settlement

---

## Research

### Historical Backtest

6.2 years of ETH/USD data (Jan 2020 — Apr 2026), 76 monthly epochs on a $10K concentrated position.

| Metric | Unhedged | 50% Tier | 75% Tier | 100% Tier |
|--------|----------|----------|----------|-----------|
| Annual return | -10.1% | -9.3% | -8.9% | -8.5% |
| Net benefit (6.2yr) | — | +$489 | +$734 | +$979 |
| Combined ratio | — | 1.16x | 1.16x | 1.16x |

Protocol survives all historical crises: COVID (-61%), LUNA (-41%), FTX (-31%), yen carry trade (-34%).

See: [`research/backtest/BACKTEST_REPORT.md`](research/backtest/BACKTEST_REPORT.md)

### Stress Tests

| Event | Price Drop | IL (concentrated) | Payout (100%) | Junior Drawdown |
|-------|-----------|-------------------|---------------|-----------------|
| COVID | -61% | $2,070 | $2,029 | 4.0% |
| LUNA | -41% | $1,240 | $1,215 | 2.4% |
| FTX | -31% | $720 | $706 | 1.4% |
| -80% Bear (hypothetical) | -80% | $4,700 | $4,606 | 100% (Senior buffer absorbs overflow) |

See: [`research/stress_tests/STRESS_TEST_REPORT.md`](research/stress_tests/STRESS_TEST_REPORT.md)

### Research Index

| Document | Location |
|----------|----------|
| Backtest report | [`research/backtest/BACKTEST_REPORT.md`](research/backtest/BACKTEST_REPORT.md) |
| Backtest engine | [`research/backtest/il_backtest.py`](research/backtest/il_backtest.py) |
| Stress test report | [`research/stress_tests/STRESS_TEST_REPORT.md`](research/stress_tests/STRESS_TEST_REPORT.md) |
| Idle yield spec | [`research/features/IDLE_YIELD_SPEC.md`](research/features/IDLE_YIELD_SPEC.md) |
| Dynamic fee hook spec | [`research/features/DYNAMIC_FEE_SPEC.md`](research/features/DYNAMIC_FEE_SPEC.md) |
| IL math reference (Python) | [`reference/il_math_reference.py`](reference/il_math_reference.py) |
| Premium model reference | [`reference/premium_model.py`](reference/premium_model.py) |
| Engineering spec | [`CLAUDE.md`](CLAUDE.md) |
| Development plan | [`DEVELOPMENT_PLAN.md`](DEVELOPMENT_PLAN.md) |

---

## Security

- OpenZeppelin `AccessControl` + `ReentrancyGuard` + `Pausable` on all core contracts
- ERC-4626 inflation attack defense (virtual share offset 10^6)
- Oracle circuit breaker: 3% Chainlink/TWAP divergence delays settlement
- Flash loan protection: IL uses TWAP + Chainlink, not instantaneous pool price
- Anti-adverse selection: warming period, coverage ramp, streaming premiums, C-level repricing
- Premium balance + maxPayout stored in 18-decimal WAD to prevent truncation
- IL converted from token1 to USDC at settlement using sqrtPriceX96 for unit consistency
- 48h timelock on governance parameter changes (mainnet)

**Audit status:** Pre-audit. Planned: OpenZeppelin, Spearbit, Code4rena competitive audit, Certora formal verification.

---

## Roadmap

- ✅ Core contracts (ILShieldCore, Vaults, Oracle, Registry, Hook, Adapters)
- ✅ Multi-DEX adapter pattern (Uni v3/v4, PancakeSwap, SushiSwap, Aerodrome)
- ✅ 252 tests passing (97% branch coverage)
- ✅ Testnet deployment (Ethereum Sepolia, 4 DEX adapters)
- ✅ Frontend dapp (analytics, vault deposits, protection management)
- ✅ 6.2-year historical backtest + stress tests
- ✅ Competitive analysis + feature specs
- 🔄 Audit preparation
- ⏳ Security audits (OpenZeppelin + Spearbit + Code4rena)
- ⏳ Formal verification (Certora Prover on ILMath + settlement)
- ⏳ Idle yield integration (Aave v3 on vault USDC)
- ⏳ Dynamic fee hook (EWMA volatility, up to 4x scaling)
- ⏳ Mainnet launch (Ethereum, $10M vault cap)
- ⏳ L2 expansion (Arbitrum, Base, Unichain)

---

## Getting Started

```bash
git clone https://github.com/robtg4/il-shield-protocol.git
cd il-shield-protocol
forge install
forge build
forge test
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Run Backtest

```bash
python3 research/backtest/fetch_prices.py
python3 research/backtest/il_backtest.py
```

---

## Project Structure

```
il-shield-protocol/
├── src/
│   ├── core/           # ILShieldCore, Vaults, Registry, Oracle
│   ├── hook/           # V4 Hook, TickAccumulator
│   ├── libraries/      # ILMath, PremiumMath, ConcentrationFactor, VolatilityLib
│   ├── interfaces/     # Contract interfaces + IPositionAdapter
│   ├── adapters/       # UniswapV3Adapter, UniswapV4Adapter
│   └── periphery/      # Router, Keeper, Brevis
├── test/
│   ├── unit/           # 77 tests (ILMath fuzz, vaults, core, adapters)
│   ├── integration/    # 7 tests (lifecycle, waterfall, adversarial)
│   ├── adversarial/    # 50 tests (access control, economic, oracle, reentrancy, adapters)
│   ├── invariant/      # Vault solvency (50K handler calls)
│   └── fork/           # 84 tests (Sepolia — Chainlink, V4 swap, adapters)
├── research/
│   ├── backtest/       # Historical backtest engine + results
│   ├── stress_tests/   # Crisis scenario analysis
│   ├── competitive/    # BELTA comparison
│   └── features/       # Idle yield + dynamic fee specs
├── frontend/           # Next.js dapp
├── script/             # Deployment scripts
├── reference/          # Python reference implementations
├── test_results/       # Proof artifacts + live Sepolia results
├── specs/              # Protocol specifications
└── CLAUDE.md           # Engineering specification
```

## License

MIT
