# IL Shield Test Proof Manifest

Generated: 2026-04-03T18:15:07Z
Commit: 95e8b7e77888fefcb2b7b0af9a5312ee43f597d0
Branch: main

## Fork Suite
```
Ran 7 test suites in 4.91s (7.44s CPU time): 73 tests passed, 0 failed, 0 skipped (73 total tests)
```

## CI Suite
```
Ran 16 test suites in 186.80s (382.07s CPU time): 143 tests passed, 0 failed, 0 skipped (143 total tests)
```

## Chainlink Anchor
```
  Chainlink ETH/USD: 204832230682
  Fork (block): 10583110
```

## Key Logged Values
```
  3.2 Total payout across 20 claims: 725751258520
  3.2 Junior after: 99299248741480
  3.2 Senior after: 100000000000
  4.1 IL with max liquidity: 3097595157313504429582223639544870861
  4.1 Payout (capped at vault): 12250000000
  F01 Pool initialized at tick: 0
  F01 Initial sqrtPriceX96: 79228162514264337593543950336
  F01 Liquidity added: tickLower=-600, tickUpper=600, delta=1e18
  F01 Swap executed: zeroForOne=true, amountSpecified=-0.001e18
  F01 Post-swap sqrtPriceX96: 79149250711305166342700278159
  F01 IL amount: 992029906280
```

## Coverage (core contracts)
```
| src/core/ILPNRegistry.sol                  | 57.69% (15/26)    | 48.15% (13/27)    | 100.00% (1/1)   | 75.00% (6/8)     |
| src/core/ILShieldCore.sol                  | 97.40% (150/154)  | 96.86% (185/191)  | 92.86% (26/28)  | 94.74% (18/19)   |
| src/core/JuniorVault.sol                   | 76.92% (40/52)    | 81.82% (45/55)    | 83.33% (5/6)    | 66.67% (10/15)   |
| src/core/PricingOracle.sol                 | 100.00% (64/64)   | 97.22% (70/72)    | 75.00% (6/8)    | 100.00% (15/15)  |
| src/core/SeniorVault.sol                   | 80.33% (49/61)    | 82.81% (53/64)    | 66.67% (4/6)    | 76.47% (13/17)   |
```

## Failures
```
NONE
```
