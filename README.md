# IL Shield Protocol

Tokenized impermanent loss protection for Uniswap v4 liquidity providers.

## Overview

IL Shield is a peripheral protocol that wraps existing Uniswap v4 LP positions with parametric IL protection. LPs pay streaming premiums in USDC and receive payouts from a tranched underwriting vault when measured IL exceeds fee income.

## Architecture

- **ILShieldCore** — Position registry, premium streaming, claim settlement
- **SeniorVault / JuniorVault** — ERC-4626 tranched underwriting (first-loss + senior)
- **ILPNRegistry** — Non-transferable ERC-721 protection NFTs
- **PricingOracle** — Net IL premium computation with Chainlink + TWAP + volatility feeds
- **ILShieldHook** — Optional Uniswap v4 hook for native integration
- **TickAccumulator** — Per-block tick cumulative storage for IL computation

## Build

```shell
forge build
```

## Test

```shell
forge test
```

## Deploy

```shell
forge script script/Deploy.s.sol --rpc-url <rpc_url> --broadcast
```

See [DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md) for the full roadmap and [CLAUDE.md](CLAUDE.md) for the engineering specification.
