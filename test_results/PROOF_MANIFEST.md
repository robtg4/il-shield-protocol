# IL Shield Test Proof Manifest

Generated: 2026-04-05T16:03:46Z
Commit: f7aee32f28d996dc8e597926b0234bb819f21ec2
Branch: feature/multi-dex-adapters

## Fork Suite
```
Ran 7 test suites in 4.57s (6.82s CPU time): 73 tests passed, 0 failed, 0 skipped (73 total tests)
```

## CI Suite
```
Ran 17 test suites in 213.41s (222.23s CPU time): 154 tests passed, 0 failed, 0 skipped (154 total tests)
```

## Chainlink Anchor
```
  Chainlink ETH/USD: 206556551000
  Fork (block): 10596422
```

## Adapter Adversarial Tests
```
[PASS] test_zeroAddressFeed_reverts() (gas: 11512)
[PASS] test_approve_thenTransferFrom_reverts() (gas: 92719)
[PASS] test_approveAdapter_thenRevoke() (gas: 62337)
[PASS] test_crossDex_independentPositions() (gas: 790019)
[PASS] test_emptyPosition_reverts() (gas: 83895)
[PASS] test_goodAdapter_registerAndSettle() (gas: 376034)
[PASS] test_inflatedLiquidity_cappedByMaxPayout() (gas: 418348)
[PASS] test_legacyRegister_stillWorks() (gas: 365032)
[PASS] test_manipulatedEntryPrice_limitedByMaxPayout() (gas: 415372)
[PASS] test_nonGovernance_cannotApproveAdapter() (gas: 16164)
[PASS] test_revertingAdapter_bubblesUp() (gas: 82702)
[PASS] test_unapprovedAdapter_reverts() (gas: 53182)
[PASS] test_zeroAddressAdapter_reverts() (gas: 51137)
```

## Key Logged Values
```
  F01 Pool initialized at tick: 0
  F01 Initial sqrtPriceX96: 79228162514264337593543950336
  F01 Liquidity added: tickLower=-600, tickUpper=600, delta=1e18
  F01 Swap executed: zeroForOne=true, amountSpecified=-0.001e18
  F01 Post-swap sqrtPriceX96: 79149250711305166342700278159
  F01 IL amount: 992029906280
```

## Failures
```
NONE
```
