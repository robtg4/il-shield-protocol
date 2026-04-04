# S07: Instant Settle Attempt (must revert — warming period)

**Timestamp:** 2026-04-04T02:57:14Z
**Register Tx:** 0x6d83438441c4ab648ac6fc7d700e4897e47574989bf90da484b2125c9fa8da55 — https://sepolia.etherscan.io/tx/0x6d83438441c4ab648ac6fc7d700e4897e47574989bf90da484b2125c9fa8da55
**ILPN ID:** 3

## Expected
Settle reverts with CoverageNotStarted (warming period = 10 blocks not elapsed).

## Actual
Error: Failed to estimate gas: server returned an error response: error code 3: execution reverted, data: "0x93884acc": CoverageNotStarted

## Verdict: PASS — correctly reverted
