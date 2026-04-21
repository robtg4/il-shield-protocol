# Dynamic Fee Hook — Specification

## Current State
`ILShieldHook.sol` exists with `afterSwap` callback for tick accumulation. No dynamic fee adjustment.

## Proposed
Add EWMA volatility tracking and dynamic fee scaling via the `beforeSwap` callback.

### EWMA Volatility
```
σ_new = λ × |log(price_new/price_old)| + (1-λ) × σ_old
```
- λ = 0.06 (standard EWMA decay, ~16 observation half-life)
- Updated on every swap via `afterSwap`
- Stored in `TickAccumulator` alongside tick cumulatives

### Dynamic Fee Scaling
```
fee_multiplier = 1 + k × max(0, σ_ewma - σ_threshold)
```
- k = 2.0 (scaling coefficient)
- σ_threshold = 0.40 (40% annualized — below this, fees stay at base)
- Cap: 4× base fee (matches BELTA's claimed max)

### Impact
- **Low vol (<40%):** fees unchanged → competitive with normal pools
- **High vol (80%):** fees ~1.8x → more premium income when IL risk peaks
- **Extreme vol (120%):** fees ~2.6x → significant additional income during crises
- **Estimated benefit:** 15-30% increase in premium income during volatile periods

### Implementation
```solidity
// In ILShieldHook.sol
function beforeSwap(...) internal override returns (bytes4, BeforeSwapDelta, uint24) {
    uint256 ewmaVol = tickAccumulator.getEWMAVol(poolId);
    uint24 dynamicFee = _computeDynamicFee(key.fee, ewmaVol);
    return (BaseHook.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, dynamicFee);
}
```

### Gas Cost
- EWMA update: ~5K gas per swap (one SSTORE for vol)
- Fee computation: ~2K gas (pure math)
- Total overhead: ~7K gas per swap (within 20K target)

### Comparison to BELTA
BELTA claims up to 4x fee multiplier via `beforeSwap`. Our implementation would match this capability. Key difference: BELTA's dynamic fee is mandatory (all pools use the hook), while ours is opt-in (only hook-enabled pools).

### Testing
- Fuzz: fee scaling monotonicity (higher vol → higher fee, never inverted)
- Boundary: fee never exceeds 4x cap
- Gas: afterSwap + EWMA update < 20K
- Integration: full swap lifecycle with dynamic fee applied

### Implementation Estimate
- Modify: `ILShieldHook.sol` (~50 lines), `TickAccumulator.sol` (~30 lines)
- New tests: 5-8 tests
- Timeline: ~3 days

---

## Dynamic Fees Are Not Yet Implemented
This is a specification for a planned feature. The current hook only accumulates ticks. This spec is included for grant applications and roadmap completeness.
