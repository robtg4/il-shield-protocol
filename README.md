# 🛡️ IL Shield Protocol

**Parametric impermanent loss protection for Uniswap v3/v4 liquidity providers.**

![Tests](https://img.shields.io/badge/tests-252%20passing-brightgreen) ![Solidity](https://img.shields.io/badge/solidity-0.8.26-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![Chains](https://img.shields.io/badge/chains-Sepolia%20%7C%20Unichain-purple)

[Website](https://il-shield-protocol.vercel.app) · [Research](https://il-shield-protocol.vercel.app/research) · [GitHub](https://github.com/robtg4/il-shield-protocol)

---

## Overview

IL Shield is insurance for Uniswap LPs. LPs pay a streaming USDC premium and receive parametric payouts when impermanent loss exceeds their fee income. Claims are paid from tranched stablecoin vaults — not from minted tokens, not from protocol reserves, not from alchemy.

**Why it exists:** Impermanent loss costs Uniswap LPs an estimated $1.5-3B annually. Over 60% of non-stablecoin concentrated liquidity positions end up unprofitable. Previous solutions either collapsed (Bancor minted BNT to pay claims — token crashed when the market crashed) or require options expertise most LPs don't have (Panoptic).

**Why it's different:** Stablecoin collateral means vault solvency is uncorrelated with the market crashes that trigger claims. Two-tranche underwriting (Senior: last-loss, Junior: first-loss) gives depositors a risk/return spectrum. No native token — all economics flow through USDC.

## How It Works

```
LP Position → Register with IL Shield → Stream USDC Premium → Close Position
                                                                    │
                                                    IL > Fee Income? → Payout from Vaults
                                                    IL ≤ Fee Income? → Remaining premium refunded
```

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

## Key Features

- **Net IL pricing** — premium = max(0, gross IL - fee income) × risk loading
- **Tranched underwriting** — Senior (last-loss) + Junior (first-loss) vaults
- **Multi-DEX** — Uniswap v3/v4, PancakeSwap, SushiSwap, Aerodrome via adapter pattern
- **Anti-adverse selection** — warming period, coverage ramp, streaming premiums, C-level repricing
- **Oracle integration** — Chainlink + TWAP with 3% divergence circuit breaker
- **Soulbound NFTs** — non-transferable ERC-721 protection tokens
- **No native token** — all stablecoin denominated, no governance token

## Deployments

### Ethereum Sepolia

| Contract | Address |
|----------|---------|
| ILShieldCore | [`0x772F171b...`](https://sepolia.etherscan.io/address/0x772F171b0b382D26961E3803c7FB1f206102a236) |
| SeniorVault | [`0x71A79914...`](https://sepolia.etherscan.io/address/0x71A79914bd89CA46D73Dd645357aC076f524C678) |
| JuniorVault | [`0xE4cf05Dd...`](https://sepolia.etherscan.io/address/0xE4cf05DdE8c5f299C3798a49e2A6Be596C3b7E7d) |
| PricingOracle | [`0xa225407c...`](https://sepolia.etherscan.io/address/0xa225407cC259241CeA87a4007443da5BcFF180F0) |
| V3 Adapter (Uni) | [`0x89eA6bdE...`](https://sepolia.etherscan.io/address/0x89eA6bdE36BB30bD8594F5855534f05866f3DF26) |
| V3 Adapter (Sushi) | [`0x6183b311...`](https://sepolia.etherscan.io/address/0x6183b311328Eb90B1437fBBfDfC434d333A633D6) |
| V3 Adapter (PCS) | [`0x2e41a526...`](https://sepolia.etherscan.io/address/0x2e41a526f217202FC06f3c6dD3B506f446772Ca0) |

## Getting Started

```bash
git clone https://github.com/robtg4/il-shield-protocol.git
cd il-shield-protocol
forge install
forge build
forge test
```

## Testing

**252 tests passing** across unit, integration, adversarial, invariant, and fork categories. ILMath fuzz-tested against Python reference for 10,000 runs. Vault solvency invariant verified across 50,000 random handler calls.

```bash
forge test --no-match-path "test/fork/*"                    # CI suite
forge test --match-path "test/fork/*" --fork-url $RPC -vvv  # Fork suite
forge coverage --ir-minimum --no-match-path "test/fork/*"   # Coverage
```

ILShieldCore branch coverage: **97.06%**.

## Security

OpenZeppelin AccessControl + ReentrancyGuard + Pausable. ERC-4626 inflation defense. Oracle circuit breaker. Flash loan protection via TWAP. 48h governance timelock.

**Audit status:** Pre-audit. Planned: OpenZeppelin, Spearbit, Code4rena, Certora.

## Roadmap

- ✅ Core contracts + multi-DEX adapters + 252 tests
- ✅ Testnet deployment (Ethereum Sepolia)
- ✅ Frontend dapp with analytics + vault deposits
- 🔄 Audit preparation
- ⏳ Security audits + formal verification
- ⏳ Mainnet launch (Ethereum + Unichain)
- ⏳ L2 expansion (Arbitrum, Base)

## License

MIT
