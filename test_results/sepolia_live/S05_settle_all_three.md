# S05: Settle All Three Positions

**Timestamp:** 2026-04-04T02:31:00Z
**Block:** 10585591

## Settlements
| Position | Tier | Tx Hash | USDC After |
|----------|------|---------|------------|
| A (0) | 50% | [0x37cd7667dff820f4019d24f0c3e914758a99f0a5d1fe92fc986d620d25c54476](https://sepolia.etherscan.io/tx/0x37cd7667dff820f4019d24f0c3e914758a99f0a5d1fe92fc986d620d25c54476) | 5910000000000 |
| B (1) | 75% | [0x5652502b9d33f6eacb822c110055cc1305ddfbdc0341f47f2f12295833d5edb5](https://sepolia.etherscan.io/tx/0x5652502b9d33f6eacb822c110055cc1305ddfbdc0341f47f2f12295833d5edb5) | 5910000000000 |
| C (2) | 100% | [0x2d5c88a382462337cbd4a17487cb2ef20e1d443acfdf7aa1e2413f4e4bc64380](https://sepolia.etherscan.io/tx/0x2d5c88a382462337cbd4a17487cb2ef20e1d443acfdf7aa1e2413f4e4bc64380) | 5910000000000 |

## Balance Changes
- Before settlement: 5910000000000
- After A settled: 5910000000000 (IL=0, no payout)
- After B settled: 5910000000000 (IL=0, no payout)
- After C settled: 5910000000000 (IL=0, no payout)

## ILPN Status (all burned — ownerOf reverts with ERC721NonexistentToken)
- ILPN 0: BURNED ✓
- ILPN 1: BURNED ✓
- ILPN 2: BURNED ✓

## Note
IL=0 because entrySqrtPriceX96 and liquidity are unset (Phase 1 limitation).
Settlement validates: oracle check, ILPN burn, position marking, premium deduction flow.

## Verdict: PASS
