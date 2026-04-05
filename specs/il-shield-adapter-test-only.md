# IL Shield — Adapter Upgrade Test Spec

Code is implemented. Run these tests, save the outputs, generate the manifest.

---

## 1. Build Verification

```bash
forge build 2>&1 | tee test_results/adapter_build.txt
```

Must compile with zero errors.

---

## 2. New Adapter Tests

### Unit: `test/unit/AdapterIntegration.t.sol`

Write 8 tests using a MockAdapter (no fork needed):

| Test | Assert |
|------|--------|
| `test_register_approvedAdapter_succeeds` | `entrySqrtPriceX96 != 0`, `liquidity != 0`, `tickLower`/`tickUpper` match adapter output. Log all four. |
| `test_register_unapprovedAdapter_reverts` | Reverts `AdapterNotApproved` |
| `test_register_zeroLiquidity_reverts` | Reverts `EmptyPosition` |
| `test_register_revokedAdapter_reverts` | Approve → register → revoke → second register reverts |
| `test_settle_adapterPosition_nonZeroIL` | Register via adapter (entry=1:1), settle at +20%. Assert `payout > 0`. Log payout. |
| `test_settle_twoAdapters_differentPayouts` | Two adapters, different entries, same exit. Assert payouts differ. |
| `test_settle_tierRatios_realData` | Three tiers from same adapter. Assert 50:75:100 ratio within 1%. |
| `test_existing_functions_unchanged` | Register via adapter → `topUpPremium()` succeeds, `processStreaming()` succeeds, `cancelProtection()` succeeds and refunds. |

```bash
forge test --match-contract AdapterIntegration -vvv 2>&1 | tee test_results/adapter_unit.txt
```

---

## 3. Fork Adapter Tests

### Fork: `test/fork/PhaseG_Adapter.t.sol`

Write 5 tests extending ForkBase:

| Test | Assert |
|------|--------|
| `test_G01_adapterReadsPosition` | Deploy adapter on fork. `getPosition()` returns sqrtPriceX96 > 0, liquidity > 0, tickLower < tickUpper. Log all fields. |
| `test_G02_registerStoresRealData` | Register via adapter. Read back position. `entrySqrtPriceX96 != 0`, `liquidity != 0`. Log both. |
| `test_G03_settleNonZeroPayout` | Register, advance past warming, settle at 15% move. `payout > 0`. Log IL and payout. |
| `test_G04_chainlinkAnchor` | Inherited. Log ETH/USD and fork block. |
| `test_G05_vaultPayoutFromJunior` | Register + settle with IL. Junior TVL decreased. Senior TVL unchanged. Log both before/after. |

```bash
forge test --match-contract PhaseG_Adapter --fork-url $SEPOLIA_RPC_URL -vvv 2>&1 | tee test_results/adapter_fork.txt
```

---

## 4. Regression — Full Existing Suite

Update all existing `register()` calls to the new 6-param signature (pass a test adapter as first arg). Then:

```bash
forge test --no-match-path "test/fork/*" 2>&1 | tee test_results/adapter_regression_ci.txt
forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv 2>&1 | tee test_results/adapter_regression_fork.txt
```

CI must have ≥143 passing, fork ≥73 passing. Zero failures in both.

---

## 5. Coverage

```bash
forge coverage 2>&1 | tee test_results/adapter_coverage.txt
grep "ILShieldCore" test_results/adapter_coverage.txt
```

ILShieldCore branches ≥ 90%, lines ≥ 95%.

---

## 6. Manifest

```bash
cat > test_results/PROOF_MANIFEST.md << 'HEADER'
# IL Shield — Adapter Upgrade Manifest
HEADER

echo "" >> test_results/PROOF_MANIFEST.md
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> test_results/PROOF_MANIFEST.md
echo "Commit: $(git rev-parse HEAD 2>/dev/null || echo 'uncommitted')" >> test_results/PROOF_MANIFEST.md

echo -e "\n## Adapter Unit" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
tail -1 test_results/adapter_unit.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo -e "\n## Adapter Fork" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
tail -1 test_results/adapter_fork.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo -e "\n## Regression CI" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
tail -1 test_results/adapter_regression_ci.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo -e "\n## Regression Fork" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
tail -1 test_results/adapter_regression_fork.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo -e "\n## Key Values" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
grep -E "(entrySqrt|payout|liquidity|Junior|Senior|Chainlink)" test_results/adapter_fork.txt test_results/adapter_unit.txt >> test_results/PROOF_MANIFEST.md 2>/dev/null
echo '```' >> test_results/PROOF_MANIFEST.md

echo -e "\n## Coverage" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
grep "ILShieldCore" test_results/adapter_coverage.txt >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md

echo -e "\n## Failures" >> test_results/PROOF_MANIFEST.md
echo '```' >> test_results/PROOF_MANIFEST.md
grep -c "FAIL" test_results/adapter_*.txt test_results/adapter_regression_*.txt 2>/dev/null | grep -v ":0$" || echo "NONE"
echo '```' >> test_results/PROOF_MANIFEST.md

cat test_results/PROOF_MANIFEST.md
git add -A && git commit -m "test: adapter upgrade — 13 new tests + regression suite"
git log --oneline -1
```

Paste the manifest and commit hash.

---

## Pass Criteria

- Zero FAIL across all suites
- G02: `entrySqrtPriceX96 != 0` (the old bug is dead)
- G03: `payout > 0` (non-zero IL without vm.store)
- G05: Junior TVL decreased (real tranche payout)
- Regression counts: ≥143 CI + ≥73 fork
- ILShieldCore branches ≥ 90%
