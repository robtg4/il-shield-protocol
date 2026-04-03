# ROUND 4 — Hardening Before Mainnet

You have 176 passing tests, a live Chainlink anchor, and the core math verified. That is sufficient for testnet deployment. This round targets what would fail under adversarial mainnet conditions: untested branches in the settlement engine, the integration with real v4 pools, and economic edge cases that only surface under stress.

Complete each section in order. Paste full terminal output for every forge command. Do not modify `src/` unless explicitly instructed. If a test cannot be written because the contract interface does not support it, document the exact limitation and stop that item — do not skip silently.

---

## Section 1: ILShieldCore Branch Coverage (currently 46% → target 75%+)

ILShieldCore is the settlement engine. It has 28 branches and only 13 are covered. The uncovered 15 branches are where mainnet exploits hide. Write `test/unit/ILShieldCore.t.sol` (or extend the existing integration tests) to hit the following paths. Each test must be a separate function with a descriptive name.

1.1 — **Warming period ramp.** Register a position with a non-zero warming period (set `warmingPeriodBlocks` to 100 via governance). Settle at block 0 (payout must be 0%), at block 50 (payout must be ~50% of full coverage), and at block 100+ (payout must be 100%). Assert exact ramp values, not just > 0. Three separate test functions.

1.2 — **Full coverage ramp.** Same concept but for `fullCoverageRampBlocks`. Register, advance to 25%, 50%, 75%, 100% of the ramp, and settle each. Assert the coverage percentage scales linearly.

1.3 — **Settlement with non-zero streaming debt.** Register, advance 500 blocks without calling `processStreaming()`, then settle. The settlement must first deduct accrued streaming, then compute the payout on the remaining balance. Assert the refund equals `initialDeposit - accruedStreaming - settlementFee`, not `initialDeposit - settlementFee`.

1.4 — **Premium balance exactly zero at settlement.** Register with a premium that will be exactly exhausted by streaming at the settlement block (compute the exact number of blocks). Call `processStreaming()` to drain the balance to zero. Then settle. The payout must be zero (no active coverage when premium is exhausted). Assert `payout == 0`.

1.5 — **Settlement fee edge cases.** Settle with IL that produces a payout of 1 wei. The 2% fee on 1 wei rounds to 0. Assert the LP receives 1 wei, not 0 (fee does not consume the entire micro-payout). Then settle with IL that produces a payout of 50 wei. Assert the fee is 1 wei (2% of 50, rounded down) and the LP receives 49 wei.

1.6 — **Register with all three coverage tiers.** Register three positions at tier 0 (50%), tier 1 (75%), and tier 2 (100%). Inject the same entry/exit prices for all three. Settle each and assert the payouts are in exact 50:75:100 ratio.

1.7 — **Governance parameter changes mid-lifecycle.** Register a position. Then change `settlementFeeRate` via governance. Settle. Assert the settlement uses the fee rate that was active at registration time, NOT the current fee rate (if the protocol is designed this way). If the protocol uses the current fee rate, assert that instead and document the design decision.

After completing 1.1–1.7, run:
```bash
forge coverage --match-path "src/core/ILShieldCore.sol" 2>&1 | grep "ILShieldCore"
```
Paste the line. Branch coverage must be above 65%. If it is not, identify the remaining uncovered branches with `forge coverage --report lcov` and list them.

---

## Section 2: Real Uniswap v4 Pool Interaction

C11 proved the PoolModifyLiquidityTest helper exists on the fork but `entrySqrtPriceX96` was stored as 0. This section creates a real pool on the forked PoolManager, executes real swaps, and reads real pool state — proving the protocol can operate against live v4 infrastructure.

2.1 — **Initialize a pool on the forked PoolManager.** Deploy two mock ERC-20 tokens (or use the existing mockWETH/mockUSDC). Sort them by address. Call `PoolManager.initialize()` at `0xE03A1074c86CFeDd5C142C4F04F1a1536e203543` with a PoolKey (currency0, currency1, fee=3000, tickSpacing=60, hooks=address(0)) and an initial sqrtPriceX96 corresponding to 1:1. Log the resulting tick. Assert the pool was created by reading its slot0 from StateView at `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c`.

2.2 — **Add liquidity to the pool.** Using PoolModifyLiquidityTest at `0x0c478023803a644c94c4ce1c1e7b9a087e411b0a`, add concentrated liquidity at tickLower=-600, tickUpper=600 with 1e18 liquidity units. Approve the tokens first. Assert the transaction succeeds and the position exists.

2.3 — **Execute a swap and read the new price.** Using PoolSwapTest at `0x9b6b46e2c869aa39918db7f52f5557fe577b6eee`, swap 0.1 token0 for token1 (zeroForOne=true). Read the new sqrtPriceX96 from StateView. Assert the price moved (new sqrtPriceX96 != initial sqrtPriceX96). Log both values.

2.4 — **Compute IL from real pool state.** Using the initial and post-swap sqrtPriceX96 values from 2.1 and 2.3, call `ILMath.computeIL()` with the real tick range and liquidity. Assert the result is greater than zero (a swap that moved the price produces non-zero IL). Log the IL amount.

If any step fails because the test contract cannot call the PoolManager's unlock pattern (the flash accounting requires implementing `IUnlockCallback`), document the exact error and implement a minimal callback contract within the test file. This is expected — v4's architecture requires callers to implement the callback.

---

## Section 3: Economic Stress Tests

These tests verify the protocol remains solvent and economically rational under extreme conditions.

3.1 — **Maximum utilization.** Deposit 100K into Senior, 25K into Junior. Register positions until vault utilization reaches 95%+. Verify the C-level exponential pricing makes the last registrations dramatically more expensive than the first. Log the premium rate for position #1, #10, #20, and the last position. Assert the last position's rate is at least 3× the first position's rate.

3.2 — **Mass liquidation scenario.** Register 20 positions at 100% coverage. Inject a 40% price drop. Settle all 20 sequentially. Track the Junior vault balance after each settlement. Assert Junior is fully drained before any claim overflows to Senior. Assert the total payout across all 20 claims equals `min(totalIL, juniorAssets + seniorAssets)`. Assert no claim receives more than its entitled payout even when the vault is depleted.

3.3 — **Premium income vs. claim payout ratio.** Register 50 positions with varying tiers and durations. Advance 10,000 blocks. Process streaming for all 50. Compute the total premium income received by the vaults. Then settle 10 of the 50 positions with moderate IL (~5% price move). Compute the total claims paid. Log the combined ratio (claims / premiums). This is a sanity check — it should be well below 100% for a 5% move with diversified positions.

3.4 — **Referral fee accuracy.** Register 10 positions, each with a different referral address. Assert each referral address received exactly 5% of each position's premium deposit. Assert the total referral payout equals exactly 5% of total premium collected.

---

## Section 4: Edge Cases and Regression Guards

4.1 — **Register with maximum uint128 liquidity.** The IL formula operates on `uint128 liquidity`. Register with `type(uint128).max` as the liquidity value. Settle. Assert no overflow occurred (if the computation overflows, it's a critical bug).

4.2 — **Register with minimum viable parameters.** Register with 1 wei of premium, tier 0 (50%), duration of 1 block. Settle immediately. Assert the protocol handles degenerate inputs gracefully (either reverts with a meaningful error or processes correctly with tiny amounts).

4.3 — **Concurrent register and settle in the same transaction.** Write a contract that calls `register()` then immediately calls `settle()` in a single transaction. With warming period > 0, the payout must be 0. With warming period = 0, the payout should reflect the coverage at registration block. Document which behavior occurs.

4.4 — **Position ID collision.** Register two positions from the same user. Assert the ILPN IDs are unique (sequential or hash-based, but never colliding). Settle the first. Assert the second is unaffected.

---

## Proof Sequence

After completing all sections, run:

```bash
# Full fork suite
forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv 2>&1 | tee test_results/fork_proof_round4_$(date +%s).txt

# Full unit/integration suite
forge test --no-match-path "test/fork/*" 2>&1 | tee test_results/ci_round4_$(date +%s).txt

# Coverage
forge coverage 2>&1 | tee test_results/coverage_round4.txt

# Proof checks
echo "=== FAIL CHECK ===" && grep -c "FAIL" test_results/fork_proof_round4_*.txt test_results/ci_round4_*.txt
echo "=== CHAINLINK ANCHOR ===" && grep "Chainlink ETH" test_results/fork_proof_round4_*.txt | head -1
echo "=== SUITE TOTALS ===" && tail -1 test_results/fork_proof_round4_*.txt && tail -1 test_results/ci_round4_*.txt
echo "=== ILSHIELDCORE COVERAGE ===" && grep "ILShieldCore" test_results/coverage_round4.txt
echo "=== PRICING ORACLE COVERAGE ===" && grep "PricingOracle" test_results/coverage_round4.txt

# Commit
git add -A
git commit -m "test: round 4 hardening — core branches, real v4 pool, economic stress, edge cases"
git push origin test/sepolia-campaign 2>&1 | tail -5
git log --oneline -1
```

Paste all output from the proof sequence.

**Acceptance criteria:**
- Zero FAIL lines across both suites.
- ILShieldCore branch coverage ≥ 65%.
- Chainlink anchor shows a plausible current ETH/USD price.
- Section 2 logs show real sqrtPriceX96 values (not zero, not hardcoded 2^96).
- Section 3 logs show the C-level pricing curve with >3× rate escalation at high utilization.
- Every test that cannot be completed is documented with the exact error, not skipped.

**What I will reject:**
- Tests that assert `assertTrue(true)` or `assertGt(x, 0)` without verifying the computed value.
- Modifications to `src/` (zero tolerance this round — the contracts must pass as-is).
- Skipped sections without documentation of why.
- A manifest with stale timestamps or commit hashes.
