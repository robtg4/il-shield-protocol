# Coverage Gaps Documentation

## Files Below 80% Line Coverage

### src/libraries/VolatilityLib.sol — 0% coverage
- **Reason:** Yang-Zhang volatility estimator and GWAV are not directly tested because no test exercises the volatility computation pipeline. These functions are called by PricingOracle indirectly but the oracle tests use mock volatility values rather than computing from OHLC data.
- **Risk:** Low — pure math library, would be validated by dedicated vol computation tests in Phase 3.

### src/periphery/BrevisCallback.sol — 0% coverage
- **Reason:** Brevis ZK coprocessor integration requires mock Brevis verifier infrastructure not yet built. No test exercises the handleProofResult or fulfillProofRequest callbacks.
- **Risk:** Medium — requires dedicated integration test with mock Brevis contracts.

### src/periphery/ILShieldRouter.sol — 0% coverage
- **Reason:** Router is a convenience wrapper (multicall + permit). Not exercised because lifecycle tests call ILShieldCore directly.
- **Risk:** Low — thin wrapper over tested core functions.

### src/periphery/KeeperModule.sol — 0% coverage
- **Reason:** Keeper module requires Gelato/Chainlink Automation interface mocking. Tests use direct processStreaming calls on ILShieldCore rather than going through the keeper.
- **Risk:** Low — access control wrapper over tested core functions.

### src/hook/ILShieldHook.sol — 0% coverage
- **Reason:** v4 hook testing requires full Uniswap v4 PoolManager deployment and pool creation which is deferred to Phase 2 hook integration tests.
- **Risk:** Medium — hook callbacks need dedicated integration tests with v4 test utilities.

### src/hook/TickAccumulator.sol — 0% coverage
- **Reason:** Same as ILShieldHook — requires hook deployment context.
- **Risk:** Low — simple accumulator math, testable independently.

### src/core/PricingOracle.sol — ~52% line coverage
- **Reason:** Volatility update paths, TWAP update, and some admin functions not exercised. Tests use the oracle through ILShieldCore.register() which only hits computePremiumRate and getChainlinkSqrtPriceX96.
- **Risk:** Medium — staleness checks and fallback logic need dedicated tests.

### src/libraries/PremiumMath.sol — 83% line coverage  
- **Reason:** Some branches in the utilization curve exponential region (>75%) not hit because tests use 50% utilization. The `_coverageTierMultiplier` tier=0 and tier=1 paths partially uncovered.
- **Risk:** Low — property tests validate monotonicity across the full range.

## Summary

Core protocol logic (ILShieldCore, Vaults, ILPNRegistry, ILMath) has strong coverage.
Peripheral contracts (Router, Keeper, Brevis, Hook) have 0% coverage — these are Phase 2/3 testing targets.
No coverage gaps represent security-critical untested paths in the core settlement flow.
