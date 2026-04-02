# Gas Analysis — IL Shield Protocol

## Measured Gas (from forge gas report)

| Operation | Measured Gas | Target (mainnet) | Status |
|-----------|-------------|-------------------|--------|
| `register()` | 352,596 – 403,896 | < 300,000 | **OVER** by ~17-35% |
| `settle()` (no ZK) | 94,056 | < 420,000 | **PASS** |
| `processStreaming()` single | 156,793 | < 100,000 | **OVER** by ~57% |
| `processStreaming()` batch (per pos) | ~76,193* | < 100,000 | **PASS** |
| `SeniorVault.deposit()` | 132,019 | < 150,000 | **PASS** |
| `SeniorVault.withdraw()` | 66,407 | < 180,000 | **PASS** |
| `JuniorVault.deposit()` | 132,019 | < 150,000 | **PASS** |
| `JuniorVault.withdrawForClaim()` | 44,896 | < 100,000 | **PASS** |

*Batch amortized: (761,932 total for 10 positions) / 10 = ~76,193 per position

## Notes

- `register()` exceeds target primarily due to:
  1. PricingOracle.computePremiumRate external call with ConcentrationFactor computation (~50K gas)
  2. ILPNRegistry.mint with safeMint callback check (~30K gas)
  3. ILPNRegistry.setMetadata additional storage write (~20K gas)
  - With `via_ir=true` enabled for stack-depth handling, there is additional overhead vs non-IR compilation

- `processStreaming()` single position is over target because first call includes cold storage access. Batch amortization brings per-position cost within target.

- `settle()` is well under target at 94K gas — no ZK proof verification needed in the base case.

- All vault operations are well within targets.

## Recommendation

The `register()` gas can be reduced by:
1. Combining ILPNRegistry mint + setMetadata into a single call
2. Caching oracle values to avoid redundant external calls
3. Potentially disabling via_ir once stack depth issues are resolved

These are optimization tasks for Phase 3, not blockers for testing or devnet deployment.
