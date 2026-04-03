# Gas Analysis — IL Shield Protocol

## Measured Gas (Live Sepolia Fork — 2026-04-03)

| Operation | Gas (fork) | Target | Status |
|-----------|-----------|--------|--------|
| `register()` | 365,357 | < 500K | **PASS** |
| `settle()` (zero IL) | 60,451 | < 500K | **PASS** |
| `settle()` (with IL payout) | 90,744 | < 500K | **PASS** |
| `processStreaming()` single | 4,176 | < 200K | **PASS** |
| `processStreaming()` batch 10 | 28,936 (2,893/pos) | < 200K | **PASS** |
| `SeniorVault.deposit()` | 79,643 | < 200K | **PASS** |
| `JuniorVault.deposit()` | 79,539 | < 200K | **PASS** |

## Gas Breakdown: settle()

The 30K difference between zero-IL and with-IL settle is due to:
- IL computation (ILMath.computeIL): ~8K gas
- Coverage tier + warming ramp calculation: ~2K gas
- Junior vault withdrawForClaim: ~15K gas (USDC transfer)
- USDC transfer to LP: ~5K gas

## Notes

- All measurements taken on live Sepolia fork with real Chainlink oracle calls.
- `register()` includes PricingOracle.computePremiumRate + ILPNRegistry.mint.
- `processStreaming()` single is very cheap because premiumRate=0 in test config.
- With-IL settle is the more accurate benchmark for production gas estimation.
- All operations comfortably within 500K block gas budget.
