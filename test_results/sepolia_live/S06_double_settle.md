# S06: Double Settle (must revert)

**Timestamp:** 2026-04-04T02:56:34Z
**Block:** 10585720

## Input
Attempted to settle ILPN 0 which was already settled in S05.

## Expected
Transaction reverts with PositionAlreadySettled.

## Actual
Error: Failed to estimate gas: server returned an error response: error code 3: execution reverted, data: "0x3ec12a85": PositionAlreadySettled

## Verdict: PASS — correctly reverted
