# IL Shield Test Proof Manifest

Generated: 2026-04-02T12:27:52Z
Commit: beb03d6104c651f743327b4057fc2e8e4f3aa74c
Branch: main

## Test Results
```
Ran 1 test for test/integration/TrancheWaterfall.t.sol:TrancheWaterfallTest
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 1.75ms (379.51µs CPU time)
Ran 7 tests for test/unit/ILPNRegistry.t.sol:ILPNRegistryTest
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 1.24ms (492.71µs CPU time)
Ran 1 test for test/integration/FullLifecycle.t.sol:FullLifecycleTest
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 5.39ms (449.90µs CPU time)
Ran 7 tests for test/unit/JuniorVault.t.sol:JuniorVaultTest
Suite result: ok. 7 passed; 0 failed; 0 skipped; finished in 5.58ms (4.14ms CPU time)
Ran 1 test for test/invariant/VaultSolvency.t.sol:VaultSolvencyTest
Suite result: ok. 1 passed; 0 failed; 0 skipped; finished in 79.47s (79.47s CPU time)
Ran 8 tests for test/unit/SeniorVault.t.sol:SeniorVaultTest
Suite result: ok. 8 passed; 0 failed; 0 skipped; finished in 945.79s (4.08ms CPU time)
Ran 6 tests for test/unit/ILMath.t.sol:ILMathTest
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 945.79s (945.88s CPU time)
Ran 9 tests for test/GasBenchmark.t.sol:GasBenchmarkTest
Suite result: ok. 9 passed; 0 failed; 0 skipped; finished in 946.32s (3.02ms CPU time)
Ran 5 tests for test/integration/Adversarial.t.sol:AdversarialTest
Suite result: ok. 5 passed; 0 failed; 0 skipped; finished in 946.32s (1.19ms CPU time)
Ran 4 tests for test/unit/PremiumMath.t.sol:PremiumMathTest
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 946.32s (950.67s CPU time)
Ran 10 test suites in 946.32s (4810.04s CPU time): 49 tests passed, 0 failed, 0 skipped (49 total tests)
```

## Coverage
```
| Contract     | Selector               | Calls | Reverts | Discards |
| VaultHandler | depositJunior          | 6247  | 0       | 0        |
|--------------+------------------------+-------+---------+----------|
| VaultHandler | depositSenior          | 6266  | 0       | 0        |
|--------------+------------------------+-------+---------+----------|
| VaultHandler | receivePremiumJunior   | 6177  | 0       | 0        |
|--------------+------------------------+-------+---------+----------|
| VaultHandler | receivePremiumSenior   | 6247  | 0       | 0        |
|--------------+------------------------+-------+---------+----------|
| VaultHandler | withdrawForClaimJunior | 6303  | 0       | 0        |
|--------------+------------------------+-------+---------+----------|
| VaultHandler | withdrawForClaimSenior | 6185  | 0       | 0        |
|--------------+------------------------+-------+---------+----------|
| VaultHandler | withdrawJunior         | 6316  | 0       | 0        |
|--------------+------------------------+-------+---------+----------|
| VaultHandler | withdrawSenior         | 6259  | 0       | 0        |
| File                                    | % Lines          | % Statements      | % Branches      | % Funcs         |
| script/Deploy.s.sol                     | 0.00% (0/38)     | 0.00% (0/49)      | 0.00% (0/1)     | 0.00% (0/1)     |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| script/DeployHook.s.sol                 | 0.00% (0/31)     | 0.00% (0/39)      | 0.00% (0/3)     | 0.00% (0/4)     |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| script/Seed.s.sol                       | 0.00% (0/32)     | 0.00% (0/44)      | 0.00% (0/1)     | 0.00% (0/1)     |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/core/ILPNRegistry.sol               | 57.69% (15/26)   | 48.15% (13/27)    | 100.00% (1/1)   | 75.00% (6/8)    |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/core/ILShieldCore.sol               | 70.78% (109/154) | 70.16% (134/191)  | 35.71% (10/28)  | 52.63% (10/19)  |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/core/JuniorVault.sol                | 70.00% (35/50)   | 79.63% (43/54)    | 83.33% (5/6)    | 50.00% (7/14)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/core/PricingOracle.sol              | 68.75% (44/64)   | 68.06% (49/72)    | 0.00% (0/8)     | 60.00% (9/15)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/core/SeniorVault.sol                | 62.71% (37/59)   | 66.67% (42/63)    | 33.33% (2/6)    | 56.25% (9/16)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/hook/ILShieldHook.sol               | 0.00% (0/44)     | 0.00% (0/40)      | 0.00% (0/3)     | 0.00% (0/13)    |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/hook/TickAccumulator.sol            | 0.00% (0/31)     | 0.00% (0/31)      | 0.00% (0/8)     | 0.00% (0/6)     |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/libraries/ConcentrationFactor.sol   | 100.00% (8/8)    | 76.92% (10/13)    | 0.00% (0/2)     | 100.00% (1/1)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/libraries/ILMath.sol                | 93.75% (30/32)   | 94.87% (37/39)    | 71.43% (5/7)    | 100.00% (6/6)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/libraries/PremiumMath.sol           | 83.33% (30/36)   | 68.97% (40/58)    | 30.00% (3/10)   | 100.00% (5/5)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/libraries/VolatilityLib.sol         | 0.00% (0/79)     | 0.00% (0/115)     | 0.00% (0/14)    | 0.00% (0/7)     |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/periphery/BrevisCallback.sol        | 0.00% (0/37)     | 0.00% (0/38)      | 0.00% (0/7)     | 0.00% (0/8)     |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/periphery/ILShieldRouter.sol        | 0.00% (0/23)     | 0.00% (0/19)      | 0.00% (0/1)     | 0.00% (0/5)     |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| src/periphery/KeeperModule.sol          | 0.00% (0/60)     | 0.00% (0/65)      | 0.00% (0/7)     | 0.00% (0/11)    |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| test/GasBenchmark.t.sol                 | 100.00% (12/12)  | 100.00% (6/6)     | 100.00% (0/0)   | 100.00% (6/6)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| test/integration/Adversarial.t.sol      | 100.00% (12/12)  | 100.00% (6/6)     | 100.00% (0/0)   | 100.00% (6/6)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| test/integration/FullLifecycle.t.sol    | 100.00% (12/12)  | 100.00% (6/6)     | 100.00% (0/0)   | 100.00% (6/6)   |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| test/integration/TrancheWaterfall.t.sol | 66.67% (4/6)     | 66.67% (2/3)      | 100.00% (0/0)   | 66.67% (2/3)    |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| test/invariant/VaultSolvency.t.sol      | 100.00% (73/73)  | 100.00% (73/73)   | 100.00% (5/5)   | 100.00% (12/12) |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| test/unit/JuniorVault.t.sol             | 66.67% (4/6)     | 66.67% (2/3)      | 100.00% (0/0)   | 66.67% (2/3)    |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| test/unit/SeniorVault.t.sol             | 66.67% (4/6)     | 66.67% (2/3)      | 100.00% (0/0)   | 66.67% (2/3)    |
|-----------------------------------------+------------------+-------------------+-----------------+-----------------|
| Total                                   | 46.08% (429/931) | 43.99% (465/1057) | 26.27% (31/118) | 49.72% (89/179) |
```

## Gas Targets
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

## Test Result Files
-rw-r--r-- 1 root root   565 Apr  2 11:46 test_results/adversarial.txt
-rw-r--r-- 1 root root  5881 Apr  2 12:04 test_results/ci_full_suite.txt
-rw-r--r-- 1 root root  2841 Apr  2 14:27 test_results/coverage_gaps.md
-rw-r--r-- 1 root root 12628 Apr  2 14:26 test_results/coverage.txt
-rw-r--r-- 1 root root   340 Apr  2 05:06 test_results/full_lifecycle.txt
-rw-r--r-- 1 root root  1852 Apr  2 11:47 test_results/gas_analysis.md
-rw-r--r-- 1 root root 13754 Apr  2 11:46 test_results/gas_benchmark.txt
-rw-r--r-- 1 root root   719 Apr  2 03:21 test_results/ilmath_fuzz.txt
-rw-r--r-- 1 root root   665 Apr  2 05:05 test_results/ilpn_registry.txt
-rw-r--r-- 1 root root   667 Apr  2 04:04 test_results/junior_vault.txt
-rw-r--r-- 1 root root   742 Apr  2 03:22 test_results/premium_properties.txt
-rw-r--r-- 1 root root 10760 Apr  2 14:27 test_results/PROOF_MANIFEST.md
-rw-r--r-- 1 root root   726 Apr  2 04:04 test_results/senior_vault.txt
-rw-r--r-- 1 root root  1714 Apr  2 04:05 test_results/solvency_invariant.txt
-rw-r--r-- 1 root root   354 Apr  2 04:05 test_results/waterfall.txt

## Reproduction
Clone this repo, run 'forge install', then 'FOUNDRY_PROFILE=ci forge test'.
All results in this manifest should be independently reproducible.
