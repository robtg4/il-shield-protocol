# IL Shield Protocol

Tokenized impermanent loss protection for Uniswap v4 liquidity providers.

## Overview

IL Shield is a peripheral protocol that wraps existing Uniswap v4 LP positions with parametric IL protection. LPs register positions, pay streaming premiums in USDC, and receive payouts from a tranched underwriting vault when measured IL exceeds fee income.

**Key mechanics:**
- **Parametric coverage** — IL computed from entry/exit sqrtPriceX96 via `ILMath.computeIL()`
- **Net IL premium** — premiums = max(0, GrossIL - FeeIncome) x risk loading x utilization curve x C-level
- **Tranched underwriting** — Junior vault absorbs losses first (first-loss), Senior protected until Junior exhausted
- **Soulbound ILPN** — non-transferable ERC-721 protection tokens
- **Oracle circuit breaker** — 3% Chainlink/TWAP divergence halts settlement

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ILShieldCore                                │
│          Position registry, premium streaming, settlement           │
├──────────┬──────────┬──────────────┬───────────────┬────────────────┤
│ SeniorVault │ JuniorVault │ ILPNRegistry │ PricingOracle │ ILShieldHook │
│ ERC-4626    │ ERC-4626    │ Soulbound    │ Chainlink+    │ V4 native    │
│ Last-loss   │ First-loss  │ ERC-721      │ TWAP+Vol      │ (optional)   │
└──────────┴──────────┴──────────────┴───────────────┴────────────────┘
```

### Contract Map

| Layer | Contract | Purpose |
|-------|----------|---------|
| **Core** | `ILShieldCore` | Position registry, premium streaming, claim settlement |
| **Core** | `SeniorVault` | ERC-4626 senior tranche — fixed yield, last-loss |
| **Core** | `JuniorVault` | ERC-4626 junior tranche — residual yield, first-loss |
| **Core** | `ILPNRegistry` | Non-transferable ERC-721 protection NFTs |
| **Core** | `PricingOracle` | Net IL premium computation + Chainlink/TWAP/vol feeds |
| **Hook** | `ILShieldHook` | Optional Uniswap v4 hook for native integration |
| **Hook** | `TickAccumulator` | Per-block tick cumulative storage for IL computation |
| **Library** | `ILMath` | IL computation: entry/exit price to IL amount |
| **Library** | `PremiumMath` | Net IL premium formula + C-level coefficient |
| **Library** | `ConcentrationFactor` | Tick range to concentration multiplier |
| **Library** | `VolatilityLib` | Yang-Zhang realized vol estimator |
| **Periphery** | `ILShieldRouter` | Multicall helper: register + fund in one tx |
| **Periphery** | `KeeperModule` | Gelato-compatible keeper for vol updates + settlement |
| **Periphery** | `BrevisCallback` | Brevis zkCoprocessor integration |

### Position Lifecycle

```
Register          Stream              Settle
   │                 │                   │
   ▼                 ▼                   ▼
LP deposits    Premiums deducted     IL computed from
USDC premium   per block and         entry/exit price.
               split:                Payout = IL × tier
ILPN minted    70% Senior            × ramp × (1 - fee)
               15% Junior
Warming        10% Treasury          Junior pays first.
period starts  5%  Referrer          Senior if Junior
                                     exhausted.
               (or treasury if       ILPN burned.
                no referrer)
```

## Deployments

### Ethereum Sepolia (primary testnet)

Live Chainlink oracle + real Uniswap V4 PoolManager.

| Contract | Address |
|----------|---------|
| ILShieldCore | [`0x73317bd4f7c196440DA38E1225012Eb579eBFBeF`](https://sepolia.etherscan.io/address/0x73317bd4f7c196440DA38E1225012Eb579eBFBeF) |
| SeniorVault | [`0x8BDE08C4BD88dbE16561F2990D7DE75B76Fc3752`](https://sepolia.etherscan.io/address/0x8BDE08C4BD88dbE16561F2990D7DE75B76Fc3752) |
| JuniorVault | [`0x0d6d128c1CF0a8E8032B7d3910A22197fDDC3bEA`](https://sepolia.etherscan.io/address/0x0d6d128c1CF0a8E8032B7d3910A22197fDDC3bEA) |
| ILPNRegistry | [`0xEcC2775fa0f0fF3b7D92199929b088432c7795f0`](https://sepolia.etherscan.io/address/0xEcC2775fa0f0fF3b7D92199929b088432c7795f0) |
| PricingOracle | [`0x43C39c44Ffac22E5b8C03A07Af433E21DC0f3743`](https://sepolia.etherscan.io/address/0x43C39c44Ffac22E5b8C03A07Af433E21DC0f3743) |
| USDC (test) | [`0xc6ffEA5afAf2fd72CF00140dd3DDa8841682128E`](https://sepolia.etherscan.io/address/0xc6ffEA5afAf2fd72CF00140dd3DDa8841682128E) |

External: Chainlink ETH/USD `0x694AA1769357215DE4FAC081bf1f309aDC325306` | V4 PoolManager `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543`

### Unichain Sepolia (secondary testnet)

Mock Chainlink oracle for controlled testing.

| Contract | Address |
|----------|---------|
| ILShieldCore | [`0x5CbE5E8Dce54091f9e19A986f49289b4f29771d1`](https://sepolia.uniscan.xyz/address/0x5CbE5E8Dce54091f9e19A986f49289b4f29771d1) |
| SeniorVault | [`0xBC021bA9301F1c62AE0Aa51aC6cdee5C85861d0B`](https://sepolia.uniscan.xyz/address/0xBC021bA9301F1c62AE0Aa51aC6cdee5C85861d0B) |
| JuniorVault | [`0x56343693d78a4FcE2c882c8ad86D81127C7F46cf`](https://sepolia.uniscan.xyz/address/0x56343693d78a4FcE2c882c8ad86D81127C7F46cf) |
| ILPNRegistry | [`0x4C94377DdDCeFa10d0c2473B92f7dC9E2f5e8b7f`](https://sepolia.uniscan.xyz/address/0x4C94377DdDCeFa10d0c2473B92f7dC9E2f5e8b7f) |
| PricingOracle | [`0x7D9E7B8cFa3D3607a73EFd880888da1eBB19CAee`](https://sepolia.uniscan.xyz/address/0x7D9E7B8cFa3D3607a73EFd880888da1eBB19CAee) |
| USDC | [`0x31d0220469e10c4E71834a79b1f276d740d3768F`](https://sepolia.uniscan.xyz/address/0x31d0220469e10c4E71834a79b1f276d740d3768F) |

## Test Suite

**216 tests | 100% pass rate | 0 failures**

| Category | Tests | Description |
|----------|-------|-------------|
| Unit | 77 | Isolated contract logic, fuzz tests vs Python reference |
| Integration | 7 | Cross-contract flows, tranche waterfall |
| Adversarial | 39 | Access control, economic attacks, oracle manipulation, reentrancy |
| Invariant | 1 suite (50K calls) | Vault solvency across random operation sequences |
| Fork | 73 | Live Sepolia infrastructure — Chainlink, V4, real swaps |
| Gas benchmark | 9 | Gas profiling on live fork |

### Key Coverage (core contracts)

| Contract | Branch Coverage |
|----------|----------------|
| ILShieldCore | **92.86%** (26/28) |
| JuniorVault | **83.33%** (5/6) |
| PricingOracle | **75.00%** (6/8) |
| SeniorVault | **66.67%** (4/6) |

### Key Highlights

- **ILMath fuzz tested** against Python reference (`reference/il_math_reference.py`) for 10,000 runs
- **PremiumMath property tests** verify monotonicity across 40,000 fuzz runs
- **Vault solvency invariant** holds across 1,000 runs with 50,000 random handler calls
- **Real V4 swap** executed on forked Sepolia PoolManager — price movement and IL verified
- **20-position mass liquidation** stress tested — Junior absorbs claims, Senior protected

See [TEST_REPORT.md](TEST_REPORT.md) for the full test report with every test name, gas measurement, and logged value.

## Build

```bash
forge build
```

## Test

```bash
# CI suite (no external dependencies)
forge test --no-match-path "test/fork/*"

# Fork tests (requires Sepolia RPC)
export SEPOLIA_RPC_URL="https://ethereum-sepolia-rpc.publicnode.com"
forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv

# Coverage
forge coverage --ir-minimum --no-match-path "test/fork/*"

# Fuzz with CI profile (50K runs)
forge test --match-path "test/unit/ILMath.t.sol" --profile ci
```

## Deploy

```bash
# Sepolia (with live Chainlink + V4)
forge script script/DeploySepolia.s.sol --rpc-url $SEPOLIA_RPC_URL --broadcast

# Unichain Sepolia (mock oracle)
forge script script/DeployUnichain.s.sol --rpc-url $UNICHAIN_SEPOLIA_RPC_URL --broadcast

# Generic deployment
forge script script/Deploy.s.sol --rpc-url <rpc_url> --broadcast
```

## Frontend

Next.js 16 + wagmi + viem + Tailwind CSS. Supports Ethereum Sepolia and Unichain Sepolia.

```bash
cd frontend
npm install
npm run dev
```

## Project Structure

```
il-shield-protocol/
├── src/
│   ├── core/           # ILShieldCore, Vaults, Registry, Oracle
│   ├── hook/           # V4 Hook, TickAccumulator
│   ├── libraries/      # ILMath, PremiumMath, ConcentrationFactor, VolatilityLib
│   ├── interfaces/     # Contract interfaces
│   └── periphery/      # Router, Keeper, Brevis
├── test/
│   ├── unit/           # Isolated tests + fuzz
│   ├── integration/    # Cross-contract flows
│   ├── adversarial/    # Attack vector tests
│   ├── invariant/      # Protocol safety invariants
│   └── fork/           # Live Sepolia fork tests
├── script/             # Deployment scripts
├── reference/          # Python reference implementations
├── frontend/           # Next.js dashboard
├── specs/              # Protocol specifications
├── test_results/       # Proof artifacts
├── CLAUDE.md           # Engineering specification
├── DEVELOPMENT_PLAN.md # 24-week roadmap + agent team structure
└── TEST_REPORT.md      # Comprehensive test report
```

## Documentation

- [CLAUDE.md](CLAUDE.md) — Full engineering specification (contracts, functions, parameters)
- [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) — 24-week development roadmap with 16-agent team structure
- [TEST_REPORT.md](TEST_REPORT.md) — Comprehensive test report with all 216 tests
- [specs/](specs/) — Protocol specifications and testing prompts

## Security

- OpenZeppelin `AccessControl` + `ReentrancyGuard` + `Pausable` on all core contracts
- ERC-4626 inflation attack defense via virtual share offset (10^6)
- Oracle circuit breaker: 3% Chainlink/TWAP divergence delays settlement
- Soulbound ILPNs: non-transferable protection tokens prevent secondary market manipulation
- Warming period + coverage ramp prevent adverse selection
- Timelocked governance parameter changes (48h minimum in production)

## License

MIT
