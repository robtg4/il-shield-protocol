# IL Shield Test Proof Manifest

Generated: 2026-04-03T12:21:37Z
Commit: 3104b7323a682391fc1518a955160060eb71c9cc
Branch: test/sepolia-campaign

## Test Results — CI Suite (Unit + Integration + Adversarial + Invariant)
```
Suite result: ok. 4 passed; 0 failed; 0 skipped; finished in 214.66s (215.46s CPU time)

Ran 15 test suites in 214.67s (1294.97s CPU time): 105 tests passed, 0 failed, 0 skipped (105 total tests)
```

## Test Results — Fork Suite (Live Sepolia)
```
Suite result: ok. 15 passed; 0 failed; 0 skipped; finished in 898.14ms (277.63ms CPU time)

Ran 6 test suites in 1.56s (5.16s CPU time): 62 tests passed, 0 failed, 0 skipped (62 total tests)
```

## Chainlink Anchor
```
  Chainlink ETH/USD: 205132302400
  Fork (block): 10579405
```

## Coverage (src/ files)
```
| src/core/ILPNRegistry.sol                  | 57.69% (15/26)    | 48.15% (13/27)    | 100.00% (1/1)   | 75.00% (6/8)     |
| src/core/ILShieldCore.sol                  | 79.22% (122/154)  | 76.44% (146/191)  | 46.43% (13/28)  | 84.21% (16/19)   |
| src/core/JuniorVault.sol                   | 76.92% (40/52)    | 81.82% (45/55)    | 83.33% (5/6)    | 66.67% (10/15)   |
| src/core/PricingOracle.sol                 | 96.88% (62/64)    | 95.83% (69/72)    | 75.00% (6/8)    | 93.33% (14/15)   |
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

## Gas Analysis
# Gas Analysis — IL Shield Protocol

## Measured Gas (Live Sepolia Fork — 2026-04-03)

| Operation | Gas (fork) | Target | Status |
|-----------|-----------|--------|--------|
| `register()` | 365,357 | < 500K | **PASS** |
| `settle()` (zero IL) | 60,451 | < 500K | **PASS** |
| `settle()` (with IL payout) | 90,744 | < 500K | **PASS** |
| `processStreaming()` single | 4,176 | < 200K | **PASS** |
| `processStreaming()` batch 10 | 28,936 (2,893/pos) | < 200K | **PASS** |
| `SeniorVault.deposit()` | 79,643 | < 200K | **PASS** |
| `JuniorVault.deposit()` | 79,539 | < 200K | **PASS** |

## Gas Breakdown: settle()

The 30K difference between zero-IL and with-IL settle is due to:
- IL computation (ILMath.computeIL): ~8K gas
- Coverage tier + warming ramp calculation: ~2K gas
- Junior vault withdrawForClaim: ~15K gas (USDC transfer)
- USDC transfer to LP: ~5K gas

## Notes

- All measurements taken on live Sepolia fork with real Chainlink oracle calls.
- `register()` includes PricingOracle.computePremiumRate + ILPNRegistry.mint.
- `processStreaming()` single is very cheap because premiumRate=0 in test config.
- With-IL settle is the more accurate benchmark for production gas estimation.
- All operations comfortably within 500K block gas budget.

## FAIL Lines (must be empty)
```
NONE
NONE
```

## src/ Diff (must show ONLY _decimalsOffset)
```
diff --git a/src/core/JuniorVault.sol b/src/core/JuniorVault.sol
index b162e23..8f824ed 100644
--- a/src/core/JuniorVault.sol
+++ b/src/core/JuniorVault.sol
@@ -39,6 +39,11 @@ contract JuniorVault is ERC4626, AccessControl, ReentrancyGuard, Pausable {
     event PremiumReceived(uint256 amount);
     event ClaimPaid(uint256 amount, address indexed to);
 
+    /// @notice ERC-4626 inflation attack defense: virtual share offset of 10^6
+    function _decimalsOffset() internal pure override returns (uint8) {
+        return 6;
+    }
+
     constructor(IERC20 _usdc, address _seniorVault, address admin)
         ERC4626(_usdc)
         ERC20("IL Shield Junior Vault", "ilsJUNIOR")
diff --git a/src/core/SeniorVault.sol b/src/core/SeniorVault.sol
index 27e4a82..b4d4ffa 100644
--- a/src/core/SeniorVault.sol
+++ b/src/core/SeniorVault.sol
@@ -51,6 +51,11 @@ contract SeniorVault is ERC4626, AccessControl, ReentrancyGuard, Pausable {
     event ClaimPaid(uint256 amount, address indexed to);
     event WithdrawalQueued(address indexed owner, uint256 availableBlock);
 
+    /// @notice ERC-4626 inflation attack defense: virtual share offset of 10^6
+    function _decimalsOffset() internal pure override returns (uint8) {
+        return 6;
+    }
+
     constructor(IERC20 _usdc, address admin)
         ERC4626(_usdc)
         ERC20("IL Shield Senior Vault", "ilsSENIOR")
```

## Test Result Files
```
-rw-r--r-- 1 root root   565 Apr  2 14:56 test_results/adversarial.txt
-rw-r--r-- 1 root root  9824 Apr  3 07:13 test_results/ci_full_suite.txt
-rw-r--r-- 1 root root  2841 Apr  2 14:56 test_results/coverage_gaps.md
-rw-r--r-- 1 root root 19445 Apr  3 07:18 test_results/coverage.txt
-rw-r--r-- 1 root root  5849 Apr  3 07:13 test_results/fork_suite.txt
-rw-r--r-- 1 root root   340 Apr  2 14:56 test_results/full_lifecycle.txt
-rw-r--r-- 1 root root  1260 Apr  3 06:29 test_results/gas_analysis.md
-rw-r--r-- 1 root root 13754 Apr  2 14:56 test_results/gas_benchmark.txt
-rw-r--r-- 1 root root   719 Apr  2 14:56 test_results/ilmath_fuzz.txt
-rw-r--r-- 1 root root   665 Apr  2 14:56 test_results/ilpn_registry.txt
-rw-r--r-- 1 root root   667 Apr  2 14:56 test_results/junior_vault.txt
-rw-r--r-- 1 root root   742 Apr  2 14:56 test_results/premium_properties.txt
-rw-r--r-- 1 root root     0 Apr  3 14:21 test_results/PROOF_MANIFEST.md
-rw-r--r-- 1 root root   726 Apr  2 14:56 test_results/senior_vault.txt
-rw-r--r-- 1 root root  1714 Apr  2 14:56 test_results/solvency_invariant.txt
-rw-r--r-- 1 root root   354 Apr  2 14:56 test_results/waterfall.txt
```

## Reproduction
Clone this repo at commit 3104b7323a682391fc1518a955160060eb71c9cc, run:
  forge test --no-match-path "test/fork/*"
  SEPOLIA_RPC_URL=<your_rpc> forge test --match-path "test/fork/*" --fork-url $SEPOLIA_RPC_URL -vvv
All results in this manifest should be independently reproducible.
