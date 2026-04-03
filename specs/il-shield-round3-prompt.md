# ROUND 3 — Close the five gaps you disclosed. Do them in order. Paste full terminal output for every step.

Your honesty about the gaps was good. Now close them.

## 1. Uncapped IL payout test

C09 hits the maxPayout cap, so it tests the cap — not the IL math end-to-end. Add `test_C10_settle_uncappedIL()` that either temporarily sets maxPayout to type(uint256).max via `vm.store` or uses a premium large enough that the cap is not reached. The test must produce a payout where `payout == ILMath.computeIL(entry, exit, tickLower, tickUpper, liquidity) * coverageTier * (100 - settlementFeeBps) / 100` within 0.1% tolerance. Log both `Expected IL`, `Expected payout`, and `Actual payout`. If the math doesn't agree, that's a real bug — stop and report it.

## 2. Real PositionManager read

You admitted positions are injected via `vm.store`, not read from a real v4 LP position. Add `test_C11_registerFromRealV4Position()` that creates a real LP position on the forked PoolManager using the PoolModifyLiquidityTest helper at `0x0c478023803a644c94c4ce1c1e7b9a087e411b0a`. Read the position data back from StateView at `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c`. Pass the real position parameters to `register()`. This proves the protocol can read from v4 infrastructure, not just from injected storage. If `register()` doesn't accept real v4 position parameters, that's a design gap — document it and stop.

## 3. Non-zero premium streaming

All streaming tests stream zero because fees > IL at the test config. Add `test_C12_nonZeroPremiumStreaming()` that configures the oracle with parameters that produce a non-zero premium rate: high volatility (sigma = 1.5e18), low fee volume (volumePerLiq = 0), high concentration factor. Register a position, advance 1000 blocks, call `processStreaming()`, and assert the position's premium balance decreased by exactly `premiumRatePerBlock * 1000`. Log the premium rate and the balance before/after.

## 4. PricingOracle branch coverage

You got to 75%. The two missing branches are the TWAP divergence median resolution path and an edge case in `_getChainlinkSqrtPriceX96`. Write the two tests that hit these exact branches. Name them `test_twapDivergenceMedianResolution()` and `test_chainlinkSqrtPriceEdgeCase()`. If you can't hit them because the code path requires infrastructure you can't mock (e.g., a third oracle source for the median), document exactly which lines are uncoverable and why.

## 5. Regenerate PROOF_MANIFEST

The current manifest is stale — it still shows the old commit hash and timestamp. After completing items 1–4, regenerate it:

```bash
# Run the full fork suite with the new tests
forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv \
  2>&1 | tee test_results/fork_proof_$(date +%s).txt

# Run the full unit + integration suite
forge test --no-match-path "test/fork/*" 2>&1 | tee test_results/ci_full_suite_v3.txt

# Regenerate coverage
forge coverage 2>&1 | tee test_results/coverage_v3.txt

# Regenerate manifest
bash scripts/generate_manifest.sh

# Show me the proof
grep -c "FAIL" test_results/fork_proof_*.txt
grep "Chainlink ETH" test_results/fork_proof_*.txt
tail -3 test_results/ci_full_suite_v3.txt
cat test_results/PROOF_MANIFEST.md | head -20

git add -A
git commit -m "fix: close 5 disclosed gaps — uncapped IL, real v4 position, nonzero streaming, oracle branches, manifest regen"
git push origin test/sepolia-campaign 2>&1 | tail -5
git log --oneline -1
```

Paste all output.

**What I will NOT accept:**
- Skipping any of items 1–4 because "it's hard to set up." If it's hard, document why and stop — don't skip.
- A test that passes by asserting nothing meaningful (assertTrue(true), assertGt(payout, 0) without checking the computed value).
- Modifying `src/` to make a test pass (the `_decimalsOffset` exception from last round is closed).
- A PROOF_MANIFEST with the old timestamp or commit hash.

**What IS acceptable:**
- Documenting that a specific test cannot be written because the contract interface doesn't support it (e.g., if `register()` doesn't accept raw v4 position params). That's a design finding, not a failure.
- Using `vm.store` to set up state that would otherwise require complex multi-contract interactions, AS LONG AS you clearly label what's real and what's injected.
