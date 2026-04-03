# FIX THESE FIVE ISSUES — Do them in order. Do not skip any. Paste full terminal output for each step.

## 1. Chainlink Anchor — Add to ForkBase.t.sol

Add `test_00_chainlinkAnchor()` as the first test in `ForkBase.t.sol`. It must read the live Chainlink ETH/USD price, assert it is between $500 and $20,000 (i.e., `answer > 500e8 && answer < 20_000e8`), assert `updatedAt` is within 2 hours of `block.timestamp`, and emit `log_named_int("Chainlink ETH/USD", answer)` and `log_named_uint("Fork block", block.number)`. Every fork test file that inherits ForkBase will now inherit this anchor. Run the fork suite and paste the output showing the anchor passes with a real price.

## 2. Non-Zero IL Settlement Test — Add to PhaseC_Lifecycle.t.sol

The current lifecycle tests all settle with sqrtPriceX96 = 79228162514264337593543950336 (1:1, zero IL). The core IL computation has never been tested with a real payout in the fork environment. Add `test_C09_settle_withNonZeroIL()` that registers a position, then settles with a sqrtPriceX96 that represents a 20% price increase (compute this value: if entry is 1:1 at 2^96, a 20% increase means sqrt(1.2) * 2^96 ≈ 86687299046364038601618741436). Assert the payout is greater than zero. Compute the expected IL using `ILMath.computeIL()` directly and assert the actual payout matches `expectedIL * coverageTier * (1 - settlementFee)` within 0.1% tolerance. Log both `Actual payout` and `Expected payout`. Run and paste output.

## 3. Vault Inflation Defense — Fix D11

The current D11 test documents the ERC-4626 inflation attack but does not assert protection. This is not acceptable. Either override `_decimalsOffset()` to return 6 in both SeniorVault and JuniorVault (the standard OpenZeppelin mitigation), OR change D11 to assert that on a pre-seeded vault (the production configuration), the attack fails (victim gets >0 shares). If you modify `src/`, that is acceptable ONLY for this specific `_decimalsOffset` fix — show the exact diff. Run D11 and paste output showing the assertion passes.

**IMPORTANT: If you add `_decimalsOffset`, you must re-run the ENTIRE unit test suite (Sections 1–5) to confirm nothing regressed. Paste the full suite summary.**

## 4. Branch Coverage for PricingOracle — Add targeted tests

PricingOracle has 0% branch coverage. Add `test/unit/PricingOracle.t.sol` with tests that hit every branch: stale price reverts, unconfigured pool reverts, zero-address feed reverts, volatility update by keeper succeeds, volatility update by non-keeper reverts, TWAP update by keeper succeeds, TWAP update by non-keeper reverts. Run and paste output. Then run `forge coverage --match-path "src/core/PricingOracle.sol"` and paste the updated coverage for that file.

## 5. Gas Reconciliation

The gas numbers are inconsistent: `settle()` shows 375K in GasBenchmark.t.sol but 60K in the fork tests. This is because the fork tests settle with IL=0. After completing item 2 above (non-zero IL test), add `test_E07_gas_settle_withIL()` to PhaseE_GasProfile.t.sol that measures settle gas when there IS a payout. Log the gas. Then update `test_results/gas_analysis.md` with both values: "settle (zero IL): X gas" and "settle (with IL payout): Y gas". Run and paste output.

---

After all five items are complete, run the proof sequence:

```bash
git diff main -- src/ | head -50
forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv 2>&1 | tee test_results/fork_proof_$(date +%s).txt
tail -20 test_results/fork_proof_*.txt | tail -20
grep -i "FAIL" test_results/fork_proof_*.txt
grep -E "(Chainlink ETH|Fork \(block)" test_results/fork_proof_*.txt
forge test 2>&1 | tee test_results/ci_full_suite_v2.txt
tail -5 test_results/ci_full_suite_v2.txt
git add -A && git commit -m "fix: address 5 review findings — anchor, nonzero IL, inflation defense, oracle coverage, gas reconciliation" && git push origin test/sepolia-campaign 2>&1 | tail -5
git log --oneline -1
```

Paste every output. The `src/` diff must show ONLY the `_decimalsOffset` change (if applied). The fork suite must show zero FAIL lines. The CI suite must show zero failures. The Chainlink price must be current and plausible.
