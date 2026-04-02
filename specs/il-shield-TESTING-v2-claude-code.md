# TESTING.md — IL Shield Verification Specification for Claude Code

This specification assumes the IL Shield protocol contracts are already implemented, compiled, and present in the repository. Claude Code's sole responsibility is to write tests, run them, capture results, and commit the evidence. Claude Code must not modify any source files in `src/`. If a test reveals a bug, Claude Code must document the failure with full output and stop — a human will fix the implementation.

---

## Enforcement Rules

Claude Code must execute every section in order. Each section ends with a CHECKPOINT containing exact verification commands. Claude Code must not proceed past any CHECKPOINT until every command in it succeeds and the output is pasted into the conversation.

Every `forge test` invocation must pipe output to a file via `| tee test_results/<name>.txt`. That file must be committed to the repository. Claude Code must paste the final summary lines (pass/fail counts) from the actual terminal output, not from memory or inference. If Claude Code cannot produce the terminal output, the step is not complete.

Every CHECKPOINT requires `git add -A && git commit && git push` with the push confirmation pasted. This creates an immutable, human-reviewable record. A reviewer can clone the repository, run `forge test`, and independently reproduce every result.

If any test fails, Claude Code must paste the full failure output (including the revert reason, expected vs. actual values, and the failing test name), then stop and wait for human instruction. Claude Code must not attempt to fix source code, skip the failing test, or proceed to the next section.

---

## Section 0: Environment Verification

Before writing any tests, Claude Code must verify that the existing codebase compiles and the repository structure is intact.

Run the following commands and paste the complete output of each.

```bash
# Verify source files exist
find src/ -name "*.sol" | sort

# Verify the project compiles
forge build 2>&1 | tail -20

# Verify dependencies are installed
ls lib/

# Verify git state
git status
git log --oneline -5
```

`forge build` must show "Compiler run successful" with zero errors. If it fails, stop and report the error to the human. Do not attempt to fix compilation errors.

Create the test results directory:

```bash
mkdir -p test_results
```

### CHECKPOINT 0

Paste the output of all five commands above. Confirm zero compilation errors. Confirm `test_results/` directory exists.

---

## Section 1: ILMath Verification

### 1.1 — Python Reference Implementation

Create `reference/il_math_reference.py`. This is an independent, clean-room implementation of the impermanent loss formula that serves as the source of truth for verifying the Solidity library. It must accept five command-line arguments (entrySqrtPriceX96, exitSqrtPriceX96, tickLower, tickUpper, liquidity as integers) and print a single integer to stdout representing the IL in token1 units.

Use Python's `decimal` module with 100 digits of precision. The implementation must follow the IL formula directly from the protocol specification: compute the token amounts at entry using the concentrated liquidity position math, compute the HODL value at exit price, compute the LP value at exit price, and return `max(0, HODL - LP)`. Handle the three price regions (within range, below range, above range) explicitly.

After creating the file, verify it runs:

```bash
python3 reference/il_math_reference.py 79228162514264337593543950336 158456325028528675187087900672 -887220 887220 1000000000000000000
```

Paste the output. It must be a single integer with no other text.

### 1.2 — Fuzz Tests Against Reference

Create `test/unit/ILMath.t.sol`. This contract must contain the following tests.

`test_fuzz_computeIL_matchesPythonReference(uint160 entrySqrt, uint160 exitSqrt, int24 tickLower, int24 tickUpper, uint128 liquidity)`: Bound inputs to valid ranges (sqrtPriceX96 between MIN_SQRT_RATIO and MAX_SQRT_RATIO, tickLower < tickUpper both within valid tick bounds, liquidity between 1e12 and 1e22). Call the Solidity `ILMath.computeIL()`, call the Python reference via `vm.ffi()`, and assert the results are equal. If they differ by more than 1 wei, the test must fail with a message showing both values.

`test_computeIL_zeroPriceChange`: Entry and exit sqrtPriceX96 are identical. IL must be exactly 0.

`test_computeIL_priceDoubles`: Set entry at a known sqrtPriceX96 (e.g., corresponding to ETH = $2500), exit at a sqrtPriceX96 corresponding to ETH = $5000, with a ±50% tick range and 1e18 liquidity. Compute the expected IL using the Python reference and hardcode it. Assert the Solidity result matches.

`test_computeIL_priceHalves`: Same structure but with exit price at $1250.

`test_computeIL_priceExitsRangeAbove`: Set exit price above the upper tick. The LP holds 100% token1. Verify IL is computed correctly.

`test_computeIL_priceExitsRangeBelow`: Set exit price below the lower tick. The LP holds 100% token0. Verify IL is computed correctly.

### 1.3 — Run and Capture

```bash
forge test --match-contract ILMathTest -vvv 2>&1 | tee test_results/ilmath_fuzz.txt
```

Paste the last 30 lines of the output, including the total number of tests, pass/fail counts, and the number of fuzz runs executed.

### CHECKPOINT 1

```bash
ls reference/il_math_reference.py test/unit/ILMath.t.sol test_results/ilmath_fuzz.txt
forge test --match-contract ILMathTest --summary 2>&1
git add -A && git commit -m "test: ILMath fuzz verification against Python reference" && git push 2>&1 | tail -5
git log --oneline -3
```

Paste all output. Zero test failures required. If fuzz tests fail, paste the full counterexample (the seed and input values) and stop.

---

## Section 2: PremiumMath Property Verification

### 2.1 — Property Tests

Create `test/unit/PremiumMath.t.sol` containing four fuzz-based property tests.

`test_fuzz_premium_monotonic_in_volatility(uint256 sigma1, uint256 sigma2, ...)`: Generate two volatility values where sigma1 < sigma2 (both bounded between 0.10e18 and 2.0e18). Hold all other inputs constant at reasonable defaults (feeRate = 3000, volumePerLiq = 1e14, concFactor = 5e18, coverageTier = 2, utilizationBps = 5000). Assert `premiumRate(sigma1) <= premiumRate(sigma2)`.

`test_fuzz_premium_monotonic_in_concentration(uint256 conc1, uint256 conc2, ...)`: Generate two concentration factors where conc1 < conc2 (both bounded between 1e18 and 50e18). Hold all other inputs constant at sigma = 0.7e18 and the same defaults above. Assert `premiumRate(conc1) <= premiumRate(conc2)`.

`test_fuzz_premium_zero_when_fees_cover_il(uint256 sigma, uint256 volumePerLiq, ...)`: Generate inputs where the expected fee income demonstrably exceeds the expected gross IL (e.g., low sigma, high volumePerLiq). Assert the premium rate is exactly zero.

`test_fuzz_premium_equals_gross_when_no_fees(uint256 sigma, uint256 concFactor, ...)`: Set volumePerLiq to zero. Compute the expected premium as `(sigma^2 / 8) * concFactor / blocksPerYear * riskLoading * coverageTierMultiplier * utilizationMultiplier`. Assert the Solidity result matches within 0.01% relative tolerance.

### 2.2 — Run and Capture

```bash
forge test --match-contract PremiumMathTest -vvv 2>&1 | tee test_results/premium_properties.txt
```

Paste the last 30 lines.

### CHECKPOINT 2

```bash
ls test/unit/PremiumMath.t.sol test_results/premium_properties.txt
forge test --match-contract PremiumMathTest --summary 2>&1
git add -A && git commit -m "test: PremiumMath four-invariant property verification" && git push 2>&1 | tail -5
git log --oneline -3
```

Paste all output. Zero failures required.

---

## Section 3: Vault Mechanics Verification

### 3.1 — SeniorVault Tests

Create `test/unit/SeniorVault.t.sol` testing the following behaviors. Each behavior must be a separate test function.

ERC-4626 standard compliance: deposit X USDC and receive shares proportional to the exchange rate; redeem shares and receive USDC proportional to total assets; previewDeposit and previewRedeem return accurate estimates.

Lock period enforcement: deposit, then immediately call withdraw — must revert with a message indicating the lock is active. Deposit, advance past the lock period, then withdraw — must succeed.

Utilization throttling: set up conditions where vault utilization exceeds 80% (mock outstanding coverage relative to vault assets), then attempt to withdraw — verify the withdrawal enters a queue or reverts depending on the implementation's throttling mechanism.

Emergency withdrawal: deposit, then call emergency withdraw before the lock expires — must succeed but deduct the 5% penalty. Verify the caller receives 95% of the expected assets and the 5% remains in the vault.

Access control: call `withdrawForClaim()` from an address without CORE_ROLE — must revert. Call `receivePremium()` from an address without CORE_ROLE — must revert.

### 3.2 — JuniorVault Tests

Create `test/unit/JuniorVault.t.sol` testing the same behaviors as SeniorVault plus two additional tests.

Senior/Junior ratio enforcement: set up a state where the Senior vault holds 50K and Junior holds 10K (ratio = 5:1). Attempt to withdraw 1 USDC from Junior — must revert because it would push the ratio above 5:1. Deposit enough into Junior to bring the ratio to 3:1, then withdraw a small amount — must succeed.

Partial claim fulfillment: set Junior assets to 10K. Call `withdrawForClaim(15000)`. Verify that only 10K is transferred (the available balance), not 15K, and that the function does not revert.

### 3.3 — Tranche Waterfall Integration Test

Create `test/integration/TrancheWaterfall.t.sol`. Deploy both vaults with a mock USDC token. Seed Senior with 100,000e6 USDC and Junior with 25,000e6 USDC. Grant CORE_ROLE to the test contract. Execute four sequential claims and verify balances after each.

Claim 1 — 10,000e6: Junior decreases to 15,000e6. Senior unchanged at 100,000e6.
Claim 2 — 15,000e6: Junior decreases to 0. Senior unchanged.
Claim 3 — 5,000e6: Junior is at 0, so Senior decreases to 95,000e6.
Claim 4 — 200,000e6: Senior has only 95,000e6. Verify the actual transfer is 95,000e6 (not 200,000e6), and both vaults are at 0.

Assert exact balances after each claim within 1 wei tolerance.

### 3.4 — Solvency Invariant Test

Create `test/invariant/VaultSolvency.t.sol`. Define a handler contract that performs random deposits (1–10,000 USDC), withdrawals (bounded by the caller's shares), premium distributions (1–1,000 USDC), and claims (1–5,000 USDC) against both vaults. The handler must use `deal()` to fund callers as needed.

The invariant assertion after every operation: the sum of both vaults' `totalAssets()` must equal `totalDeposited - totalWithdrawn - totalClaimsPaid + totalPremiumsReceived`, tracked by the handler's own accounting. Additionally, neither vault's `totalAssets()` may be negative (underflow).

### 3.5 — Run and Capture

```bash
forge test --match-contract SeniorVaultTest -vvv 2>&1 | tee test_results/senior_vault.txt
forge test --match-contract JuniorVaultTest -vvv 2>&1 | tee test_results/junior_vault.txt
forge test --match-contract TrancheWaterfallTest -vvv 2>&1 | tee test_results/waterfall.txt
forge test --match-contract VaultSolvencyTest -vvv 2>&1 | tee test_results/solvency_invariant.txt
```

Paste the last 20 lines of each output file.

### CHECKPOINT 3

```bash
ls test/unit/SeniorVault.t.sol test/unit/JuniorVault.t.sol test/integration/TrancheWaterfall.t.sol test/invariant/VaultSolvency.t.sol
ls test_results/senior_vault.txt test_results/junior_vault.txt test_results/waterfall.txt test_results/solvency_invariant.txt
forge test --match-path "test/unit/SeniorVault*" --summary 2>&1
forge test --match-path "test/unit/JuniorVault*" --summary 2>&1
forge test --match-path "test/integration/TrancheWaterfall*" --summary 2>&1
forge test --match-path "test/invariant/VaultSolvency*" --summary 2>&1
git add -A && git commit -m "test: vault mechanics, waterfall integration, and solvency invariant" && git push 2>&1 | tail -5
git log --oneline -5
```

Paste all output. Zero failures across all four test contracts.

---

## Section 4: ILPN Registry Verification

### 4.1 — Soulbound Enforcement Tests

Create `test/unit/ILPNRegistry.t.sol` with the following tests.

`test_mint_byCoreRole_succeeds`: Grant CORE_ROLE to the test contract, mint token ID 1 to Alice, verify Alice owns token ID 1.

`test_mint_byNonCoreRole_reverts`: Attempt to mint from an address without CORE_ROLE. Must revert with an access control error.

`test_transferFrom_reverts`: Mint token to Alice, then call `transferFrom(alice, bob, tokenId)` as Alice. Must revert.

`test_safeTransferFrom_reverts`: Same as above but using `safeTransferFrom`.

`test_approve_reverts`: Mint token to Alice, then call `approve(bob, tokenId)` as Alice. Must revert.

`test_burn_byCoreRole_succeeds`: Mint token to Alice, then burn it via CORE_ROLE. Verify Alice's balance is 0 and `ownerOf(tokenId)` reverts.

`test_burn_byNonCoreRole_reverts`: Attempt to burn from an address without CORE_ROLE. Must revert.

### 4.2 — Run and Capture

```bash
forge test --match-contract ILPNRegistryTest -vvv 2>&1 | tee test_results/ilpn_registry.txt
```

Paste the last 20 lines.

### CHECKPOINT 4

```bash
ls test/unit/ILPNRegistry.t.sol test_results/ilpn_registry.txt
forge test --match-contract ILPNRegistryTest --summary 2>&1
git add -A && git commit -m "test: ILPN soulbound enforcement verification" && git push 2>&1 | tail -5
git log --oneline -5
```

---

## Section 5: Full Lifecycle and Adversarial Verification

### 5.1 — Full Lifecycle Integration Test

Create `test/integration/FullLifecycle.t.sol`. This test deploys the complete system (deploy a mock ERC-20 for USDC, deploy both vaults, deploy the ILPN registry, deploy ILShieldCore, wire all contracts together with correct roles, seed vaults with USDC). Then execute the complete protection lifecycle in a single test function.

Step 1 — Register: Call `register()` with known position parameters (a hardcoded entrySqrtPriceX96, tickLower, tickUpper, liquidity, 100% coverage tier, 30-day duration, and 100 USDC premium deposit). After the call, verify: an ILPN was minted to the caller, the caller's USDC balance decreased by 100, the Senior vault received 70 USDC, the Junior vault received 15 USDC, the treasury received 10 USDC, and the referral address received 5 USDC. Assert exact amounts.

Step 2 — Stream premiums: Advance the block number by 1000. Call `processStreaming()` for the position. Verify the position's premium balance decreased by exactly `premiumRatePerBlock * 1000`. Verify the streaming amount was distributed to the vaults in the correct ratio.

Step 3 — Settle: Call `settle()` with an exit sqrtPriceX96 that produces a known IL amount (pre-compute this using the Python reference). Verify: the payout equals `IL * coverageTier * (1 - settlementFeeRate)`, the payout was drawn from Junior first, the ILPN was burned (ownerOf reverts), and the remaining premium balance was refunded to the caller.

### 5.2 — Adversarial Scenario Tests

Create `test/integration/Adversarial.t.sol` with five tests, each in its own function.

`test_doubleClaim_reverts`: Complete the full lifecycle (register, settle). Then call `settle()` again with the same ILPN ID. Must revert because the ILPN was burned.

`test_settleExpiredProtection_reverts`: Register a position with a 100-block duration. Advance by 200 blocks. Call `settle()`. Must revert because the coverage period has expired.

`test_premiumExhaustion_stopsCoverage`: Register a position with a minimal premium deposit (just enough for 10 blocks of streaming). Advance by 100 blocks. Call `processStreaming()`. The premium balance should be zero. Call `settle()` with an exit price that produces IL. Verify the payout is zero or reflects the proportionally reduced coverage (depending on implementation). The key assertion: the LP does not receive a full payout when their premium has been exhausted.

`test_nonOwnerSettle_reverts`: Register a position as Alice. Prank as Bob and call `settle()`. Must revert because Bob does not own the ILPN.

`test_cancelThenSettle_reverts`: Register a position. Call `cancelProtection()` to burn the ILPN and refund premium. Then call `settle()`. Must revert because the ILPN no longer exists.

### 5.3 — Run and Capture

```bash
forge test --match-contract FullLifecycleTest -vvv 2>&1 | tee test_results/full_lifecycle.txt
forge test --match-contract AdversarialTest -vvv 2>&1 | tee test_results/adversarial.txt
```

Paste the last 30 lines of each.

### CHECKPOINT 5

```bash
ls test/integration/FullLifecycle.t.sol test/integration/Adversarial.t.sol
ls test_results/full_lifecycle.txt test_results/adversarial.txt
forge test --match-contract FullLifecycleTest --summary 2>&1
forge test --match-contract AdversarialTest --summary 2>&1
git add -A && git commit -m "test: full lifecycle integration and adversarial scenario verification" && git push 2>&1 | tail -5
git log --oneline -5
```

---

## Section 6: Gas Profiling

### 6.1 — Gas Benchmark Tests

Create `test/GasBenchmark.t.sol`. This contract sets up the full system (same as Section 5) and then executes each core operation in isolation, capturing gas via Foundry's built-in gas reporting. Each operation must be a separate test function named with the `test_gas_` prefix.

`test_gas_register`: Measure gas for a standard `register()` call.
`test_gas_settle_withPayout`: Measure gas for `settle()` when IL > 0 and a payout is made.
`test_gas_settle_noPayout`: Measure gas for `settle()` when IL = 0 (price unchanged).
`test_gas_processStreaming_single`: Measure gas for `processStreaming()` with 1 position.
`test_gas_processStreaming_batch10`: Measure gas for `processStreaming()` with 10 positions.
`test_gas_seniorDeposit`: Measure gas for `SeniorVault.deposit()`.
`test_gas_seniorWithdraw`: Measure gas for `SeniorVault.withdraw()` after lock period.
`test_gas_juniorDeposit`: Measure gas for `JuniorVault.deposit()`.
`test_gas_juniorWithdrawForClaim`: Measure gas for `JuniorVault.withdrawForClaim()`.

### 6.2 — Run Gas Report

```bash
forge test --match-contract GasBenchmarkTest --gas-report 2>&1 | tee test_results/gas_benchmark.txt
```

Paste the complete gas report table. Then create `test_results/gas_analysis.md` containing: the measured gas for each operation, whether it falls within the target (register < 300K, settle < 420K, processStreaming < 100K per position, vault deposit < 150K, vault withdraw < 180K), and for any operation exceeding its target by more than 20%, the top three most expensive internal calls (identified from the trace output of `forge test --match-test <name> -vvvvv`).

### CHECKPOINT 6

```bash
ls test/GasBenchmark.t.sol test_results/gas_benchmark.txt test_results/gas_analysis.md
forge test --match-contract GasBenchmarkTest --summary 2>&1
git add -A && git commit -m "test: gas benchmarks with target analysis" && git push 2>&1 | tail -5
git log --oneline -5
```

---

## Section 7: Full Suite Run and Proof Bundle

### 7.1 — Complete Test Suite

Run every test in the repository with the CI profile for higher fuzz coverage:

```bash
FOUNDRY_PROFILE=ci forge test 2>&1 | tee test_results/ci_full_suite.txt
```

This runs fuzz tests at the CI-configured run count and invariant tests at the CI-configured depth. Do not interrupt. When complete, paste the final summary showing total tests, passed, failed, and skipped counts.

### 7.2 — Coverage Report

```bash
forge coverage 2>&1 | tee test_results/coverage.txt
```

Paste the coverage table. For any source file below 80% line coverage, note the uncovered lines and document them in `test_results/coverage_gaps.md` with a brief explanation of why they are uncovered (e.g., "requires oracle integration not yet tested," "error path only reachable via reentrancy"). Do not write additional tests to close coverage gaps — document them for human review.

### 7.3 — Proof Manifest

Create `test_results/PROOF_MANIFEST.md` with the following structure. Every value must be extracted from actual command output, not estimated.

```bash
echo "# IL Shield Test Proof Manifest" > test_results/PROOF_MANIFEST.md
echo "" >> test_results/PROOF_MANIFEST.md
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> test_results/PROOF_MANIFEST.md
echo "Commit: $(git rev-parse HEAD)" >> test_results/PROOF_MANIFEST.md
echo "Branch: $(git branch --show-current)" >> test_results/PROOF_MANIFEST.md
echo "" >> test_results/PROOF_MANIFEST.md
echo "## Test Results" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
grep -E "^(Suite result|Total|Passed|Failed)" test_results/ci_full_suite.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
echo "" >> test_results/PROOF_MANIFEST.md
echo "## Coverage" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
grep -E "^\|" test_results/coverage.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
echo "" >> test_results/PROOF_MANIFEST.md
echo "## Gas Targets" >> test_results/PROOF_MANIFEST.md
cat test_results/gas_analysis.md >> test_results/PROOF_MANIFEST.md
echo "" >> test_results/PROOF_MANIFEST.md
echo "## Test Result Files" >> test_results/PROOF_MANIFEST.md
ls -la test_results/*.txt test_results/*.md >> test_results/PROOF_MANIFEST.md
echo "" >> test_results/PROOF_MANIFEST.md
echo "## Reproduction" >> test_results/PROOF_MANIFEST.md
echo "Clone this repo, run 'forge install', then 'FOUNDRY_PROFILE=ci forge test'." >> test_results/PROOF_MANIFEST.md
echo "All results in this manifest should be independently reproducible." >> test_results/PROOF_MANIFEST.md
```

After generating the manifest, `cat test_results/PROOF_MANIFEST.md` and paste the full content.

### 7.4 — Final Commit

```bash
git add -A
git commit -m "test: complete verification suite with proof manifest

Sections verified:
- ILMath fuzz tested against Python reference
- PremiumMath four-invariant property tests
- SeniorVault and JuniorVault mechanics
- Tranche waterfall integration (4 scenarios)
- Vault solvency invariant
- ILPN soulbound enforcement
- Full lifecycle integration (register → stream → settle)
- 5 adversarial attack scenarios
- Gas benchmarks with target analysis
- Coverage report with gap documentation

See test_results/PROOF_MANIFEST.md for verification."

git push 2>&1
```

Paste the full push output. Then:

```bash
git log --oneline -10
git status
```

Paste both. `git status` must show "nothing to commit, working tree clean."

### CHECKPOINT 7 (FINAL)

```bash
# Every test result file must exist
find test_results/ -type f | sort

# Every test file must exist
find test/ -name "*.sol" | sort

# The reference implementation must exist
ls reference/il_math_reference.py

# The repo must be clean and pushed
git status
git log origin/main..HEAD --oneline
```

The final `git log` comparing local to remote must show zero unpushed commits. Every file listed in the `find` output must correspond to a section in this specification. No orphaned or unexplained files.

---

## Artifact Summary

At completion, the following test files must exist in the repository (Claude Code must not have created or modified any `src/` files):

Test files: `test/unit/ILMath.t.sol`, `test/unit/PremiumMath.t.sol`, `test/unit/SeniorVault.t.sol`, `test/unit/JuniorVault.t.sol`, `test/unit/ILPNRegistry.t.sol`, `test/integration/FullLifecycle.t.sol`, `test/integration/TrancheWaterfall.t.sol`, `test/integration/Adversarial.t.sol`, `test/invariant/VaultSolvency.t.sol`, `test/GasBenchmark.t.sol`.

Reference files: `reference/il_math_reference.py`.

Result files: `test_results/ilmath_fuzz.txt`, `test_results/premium_properties.txt`, `test_results/senior_vault.txt`, `test_results/junior_vault.txt`, `test_results/ilpn_registry.txt`, `test_results/waterfall.txt`, `test_results/solvency_invariant.txt`, `test_results/full_lifecycle.txt`, `test_results/adversarial.txt`, `test_results/gas_benchmark.txt`, `test_results/gas_analysis.md`, `test_results/ci_full_suite.txt`, `test_results/coverage.txt`, `test_results/coverage_gaps.md`, `test_results/PROOF_MANIFEST.md`.

All result files contain actual terminal output from `forge test` invocations. The PROOF_MANIFEST.md contains machine-extracted values from those output files. A human reviewer can verify every claim by cloning the repository and running `FOUNDRY_PROFILE=ci forge test`.
