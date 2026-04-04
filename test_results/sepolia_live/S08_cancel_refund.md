# S08: Cancel Protection and Verify Refund

**Timestamp:** 2026-04-04T02:58:13Z
**Cancel Tx:** 0x3eb4b940e3b2fa196c3d33a59ac57262654a424ddac75e9aa83b2a441c196cc6 — https://sepolia.etherscan.io/tx/0x3eb4b940e3b2fa196c3d33a59ac57262654a424ddac75e9aa83b2a441c196cc6

## Refund
- USDC before cancel: 5909000000000 [5.909e12]
- USDC after cancel: 5910000000000 [5.91e12]
- Refund amount: should be ~1,000e6 (full premium, premiumRate=0)

## Post-Cancel Settle Attempt
Error: Failed to estimate gas: server returned an error response: error code 3: execution reverted, data: "0x3ec12a85": PositionAlreadySettled
Expected: revert (position already settled/cancelled)

## Verdict: PASS
