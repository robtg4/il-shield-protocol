# Idle Yield Integration — Specification

## Current State
Senior and Junior vaults hold USDC idle. No yield on undeployed capital.

## Proposed
Deploy up to 75% of idle USDC to Aave v3 USDC lending pool via a `YieldManager` contract.

### Architecture
```
SeniorVault → YieldManager → Aave v3 aUSDC
JuniorVault → YieldManager → Aave v3 aUSDC
```

- `YieldManager.deploy(amount)` — deposits USDC to Aave, receives aUSDC
- `YieldManager.recall(amount)` — withdraws from Aave for claim payouts
- `YieldManager.harvest()` — claims Aave rewards, compounds

### Parameters
- **Max deployment:** 75% of vault TVL (25% reserve for instant claims)
- **Recall trigger:** when claim + pending > 25% reserve, auto-recall
- **Expected yield:** 3-5% APY on deployed capital
- **Impact on depositor returns:** Senior 8-12% → 11-17%, Junior 20-50% → 23-55%

### Risk Controls
- Aave health factor monitoring (revert if <1.5)
- Instant recall for claim payouts (Aave USDC has deep liquidity)
- Max 75% deployed — always 25% liquid for immediate claims
- Governance timelock on deployment ratio changes

### Security
- Aave v3 is battle-tested ($10B+ TVL)
- aUSDC is 1:1 redeemable for USDC
- No leverage, no borrowing — pure lending yield
- Additional smart contract risk from Aave dependency

### Comparison to BELTA
BELTA claims ~5%/yr from Aave stacking on idle pool capital. Our implementation would match or exceed this since both Senior and Junior vaults earn yield independently.

### Implementation Estimate
- New contract: `YieldManager.sol` (~150 lines)
- Vault modifications: add `deployToYield()` and `recallFromYield()` hooks
- Tests: Aave fork tests on mainnet fork
- Timeline: ~1 week

---

## Idle Yield is Not Yet Implemented
This is a specification for a planned feature. The current vaults hold USDC idle. This spec is included for grant applications and roadmap completeness.
