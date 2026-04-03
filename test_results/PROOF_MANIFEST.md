# IL Shield Test Proof Manifest

Generated: 2026-04-03T13:08:18Z
Commit: will be updated post-commit
Branch: round3/close-gaps

## Test Results — CI Suite (Unit + Integration + Adversarial + Invariant)
```
Suite result: ok. 6 passed; 0 failed; 0 skipped; finished in 218.93s (219.02s CPU time)

Ran 15 test suites in 218.94s (242.48s CPU time): 111 tests passed, 0 failed, 0 skipped (111 total tests)
```

## Test Results — Fork Suite (Live Sepolia)
```
Suite result: ok. 8 passed; 0 failed; 0 skipped; finished in 1.04s (1.55s CPU time)

Ran 6 test suites in 1.77s (6.12s CPU time): 65 tests passed, 0 failed, 0 skipped (65 total tests)
```

## Chainlink Anchor
```
  Chainlink ETH/USD: 206356080817
  Fork (block): 10581590
```

## Key Test Results
```
  C10 Expected IL: 9103014023
  C10 Expected payout (uncapped): 8920953742
  C10 Actual payout: 8920953743
  C11 PoolModifyLiquidityTest codesize: 6050
  C11 Stored entrySqrtPriceX96: 0
  C12 premiumRatePerBlock: 8323820
  C12 Premium balance before: 5000000000000
  C12 Premium balance after: 4991676180000
  C12 Expected deduction: 8323820000
  C12 Actual deduction: 8323820000
```

## Coverage (src/ files)
```
| src/core/ILPNRegistry.sol                  | 57.69% (15/26)    | 48.15% (13/27)    | 100.00% (1/1)   | 75.00% (6/8)     |
| src/core/ILShieldCore.sol                  | 79.22% (122/154)  | 76.44% (146/191)  | 46.43% (13/28)  | 84.21% (16/19)   |
| src/core/JuniorVault.sol                   | 76.92% (40/52)    | 81.82% (45/55)    | 83.33% (5/6)    | 66.67% (10/15)   |
| src/core/PricingOracle.sol                 | 100.00% (64/64)   | 97.22% (70/72)    | 75.00% (6/8)    | 100.00% (15/15)  |
| src/core/SeniorVault.sol                   | 68.85% (42/61)    | 68.75% (44/64)    | 33.33% (2/6)    | 70.59% (12/17)   |
| src/hook/ILShieldHook.sol                  | 0.00% (0/44)      | 0.00% (0/40)      | 0.00% (0/3)     | 0.00% (0/13)     |
| src/hook/TickAccumulator.sol               | 0.00% (0/31)      | 0.00% (0/31)      | 0.00% (0/8)     | 0.00% (0/6)      |
| src/libraries/ConcentrationFactor.sol      | 100.00% (8/8)     | 76.92% (10/13)    | 0.00% (0/2)     | 100.00% (1/1)    |
| src/libraries/ILMath.sol                   | 93.75% (30/32)    | 94.87% (37/39)    | 71.43% (5/7)    | 100.00% (6/6)    |
| src/libraries/PremiumMath.sol              | 83.33% (30/36)    | 68.97% (40/58)    | 30.00% (3/10)   | 100.00% (5/5)    |
| src/libraries/VolatilityLib.sol            | 0.00% (0/79)      | 0.00% (0/115)     | 0.00% (0/14)    | 0.00% (0/7)      |
| src/periphery/BrevisCallback.sol           | 0.00% (0/37)      | 0.00% (0/38)      | 0.00% (0/7)     | 0.00% (0/8)      |
| src/periphery/ILShieldRouter.sol           | 0.00% (0/23)      | 0.00% (0/19)      | 0.00% (0/1)     | 0.00% (0/5)      |
| src/periphery/KeeperModule.sol             | 0.00% (0/60)      | 0.00% (0/65)      | 0.00% (0/7)     | 0.00% (0/11)     |
```

## FAIL Lines
```
NONE
```

## src/ Diff
```

```

## Reproduction
  forge test --no-match-path "test/fork/*"
  SEPOLIA_RPC_URL=<rpc> forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv
