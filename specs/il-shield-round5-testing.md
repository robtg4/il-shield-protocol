# ROUND 5 — Final Gaps + Fresh Proof

194 tests passing, zero failures. Core math verified, warming ramps tested, mass liquidation survived. Four gaps remain before this is audit-ready. Close them, then regenerate everything.

Do each in order. Paste full terminal output. Do not modify `src/`.

---

## 1. Execute a Real Swap on the Forked PoolManager

This is the last significant integration gap. Every settlement test injects position data via `vm.store`. No test has ever executed a swap through the live v4 PoolSwapTest on the fork.

Add `test_F01_realV4Swap()` to `PhaseF_Round4.t.sol`. It must:

a) Deploy two mock ERC-20 tokens. Sort by address. Approve both to PoolSwapTest (`0x9b6b46e2c869aa39918db7f52f5557fe577b6eee`) and PoolModifyLiquidityTest (`0x0c478023803a644c94c4ce1c1e7b9a087e411b0a`) for `type(uint256).max`.

b) Call `PoolManager.initialize()` with the sorted pair, fee=3000, tickSpacing=60, hooks=address(0), sqrtPriceX96=79228162514264337593543950336. If it reverts because v4 requires the `unlock` callback pattern, implement a minimal contract that calls `PoolManager.unlock()` and performs the initialize inside the callback. This is expected v4 architecture — do not skip it.

c) Add liquidity via PoolModifyLiquidityTest: tickLower=-600, tickUpper=600, liquidityDelta=1e18.

d) Execute a swap via PoolSwapTest: zeroForOne=true, amountSpecified=-0.001e18 (exact output), sqrtPriceLimitX96=MIN_SQRT_RATIO+1.

e) Read the new sqrtPriceX96 from StateView at `0xe1dd9c3fa50edb962e442f60dfbc432e24537e4c`. Assert it differs from the initial value. Log both:
```
emit log_named_uint("F01 Initial sqrtPriceX96", initialSqrt);
emit log_named_uint("F01 Post-swap sqrtPriceX96", newSqrt);
```

f) Compute IL using `ILMath.computeIL(initialSqrt, newSqrt, -600, 600, 1e18)`. Assert IL > 0. Log the IL value.

If any step fails, paste the full revert trace and document which v4 interface is incompatible. Do NOT replace this test with a mock or a code-existence check — those already exist in Round 4.

---

## 2. SeniorVault Branch Coverage (currently 33% → target 60%+)

The withdrawal throttling and queue logic are largely untested. Add tests to `test/unit/SeniorVault.t.sol`:

a) **Utilization-based throttling:** Deposit 100K. Have ILShieldCore (via CORE_ROLE) call `withdrawForClaim` enough times to push utilization above 80%. Then attempt a standard `withdraw()` from a depositor. Assert it either enters a queue, reverts with a throttling message, or applies a delay. Log the exact behavior and assert it.

b) **Withdrawal queue processing:** If the vault implements a queue, add a test that enters the queue, advances past the delay period, and successfully processes the withdrawal. Assert the correct amount is received.

c) **Share price after large claim:** Deposit 100K as Alice and 100K as Bob. Process a large claim (50K) via `withdrawForClaim`. Then have Alice redeem all her shares. Assert she receives less than 100K (her share of the loss from the claim). Compute the exact expected amount and assert within 1 wei.

Run `forge coverage --match-path "src/core/SeniorVault.sol"` and paste the SeniorVault line. Target: branch coverage ≥ 50%.

---

## 3. ILShieldCore Remaining Branches (57% → target 70%+)

You're at 16/28 branches. The 12 uncovered branches are where audit findings come from. Run:

```bash
forge coverage --report lcov
```

Open `lcov.info`, find `SF:src/core/ILShieldCore.sol`, and identify the uncovered branch line numbers (lines with `BRDA:...` where the hit count is 0). List the top 5 uncovered branches by line number and what conditional they represent. Then write a test for each.

Likely candidates:
- Premium distribution when referral is `address(0)` (5% goes to treasury instead)
- Settlement when IL exceeds vault capacity (partial payout path)
- `processStreaming` when premium balance is insufficient (cap deduction at balance)
- `cancelProtection` refund calculation with partially streamed premium
- Coverage period expiration check in `settle()`

Paste the `forge coverage` output showing the new ILShieldCore branch number after adding the tests.

---

## 4. Regenerate PROOF_MANIFEST

The manifest is stale from Round 3. After completing items 1–3, regenerate everything from scratch:

```bash
# Fresh fork proof
forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv \
  2>&1 | tee test_results/fork_proof_round5_$(date +%s).txt

# Fresh CI suite  
forge test --no-match-path "test/fork/*" \
  2>&1 | tee test_results/ci_round5_$(date +%s).txt

# Fresh coverage
forge coverage 2>&1 | tee test_results/coverage_round5.txt

# Build manifest from REAL output — do not write any line by hand
cat > test_results/PROOF_MANIFEST.md << 'HEADER'
# IL Shield Test Proof Manifest
HEADER

echo "" >> test_results/PROOF_MANIFEST.md
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> test_results/PROOF_MANIFEST.md
echo "Commit: $(git rev-parse HEAD 2>/dev/null || echo 'uncommitted')" >> test_results/PROOF_MANIFEST.md
echo "Branch: $(git branch --show-current 2>/dev/null || echo 'unknown')" >> test_results/PROOF_MANIFEST.md

echo "" >> test_results/PROOF_MANIFEST.md
echo "## Fork Suite" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
tail -1 test_results/fork_proof_round5_*.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo "" >> test_results/PROOF_MANIFEST.md
echo "## CI Suite" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
tail -1 test_results/ci_round5_*.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo "" >> test_results/PROOF_MANIFEST.md
echo "## Chainlink Anchor" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
grep "Chainlink ETH" test_results/fork_proof_round5_*.txt | head -1 >> test_results/PROOF_MANIFEST.md
grep "Fork (block)" test_results/fork_proof_round5_*.txt | head -1 >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo "" >> test_results/PROOF_MANIFEST.md
echo "## Key Logged Values" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
grep -E "(F01 |1\.1c |1\.6 |3\.2 |4\.1 )" test_results/fork_proof_round5_*.txt >> test_results/PROOF_MANIFEST.md 2>/dev/null
grep -E "(F01 |1\.1c |1\.6 |3\.2 |4\.1 )" test_results/ci_round5_*.txt >> test_results/PROOF_MANIFEST.md 2>/dev/null
echo '```' >> test_results/PROOF_MANIFEST.md

echo "" >> test_results/PROOF_MANIFEST.md
echo "## Coverage (core contracts)" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
grep -E "^\\| src/core/" test_results/coverage_round5.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo "" >> test_results/PROOF_MANIFEST.md
echo "## Failures" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
FAILS=$(grep -c "FAIL" test_results/fork_proof_round5_*.txt test_results/ci_round5_*.txt 2>/dev/null | grep -v ":0$" || echo "NONE")
echo "$FAILS" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
```

Then:

```bash
# Verify
cat test_results/PROOF_MANIFEST.md

# Commit
git add -A
git commit -m "test: round 5 — real v4 swap, vault throttling, core branches, fresh manifest"
git push origin test/sepolia-campaign 2>&1 | tail -5
git log --oneline -1
```

Paste the full PROOF_MANIFEST.md content and the push confirmation.

---

**Acceptance criteria:**
- Zero FAIL lines in both suites.
- F01 logs show two DIFFERENT sqrtPriceX96 values (proving a real swap moved the price on the forked PoolManager).
- ILShieldCore branch coverage ≥ 70% (up from 57%).
- SeniorVault branch coverage ≥ 50% (up from 33%).
- PROOF_MANIFEST shows today's date, a fresh commit hash, and a current Chainlink price.
- Every value in the manifest is machine-extracted from test output files (grep/tail), not hand-written.

**What I will reject:**
- F01 replaced with another code-existence check or pure-math test. It must execute a swap on the forked PoolManager.
- Branch coverage "improvements" achieved by adding `assertTrue(true)` tests that don't hit new code paths.
- A manifest with Round 3 or Round 4 timestamps.
- Any modification to `src/`.
