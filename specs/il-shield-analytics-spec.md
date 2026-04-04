# IL Shield — Position Analytics & Risk Dashboard

## What the LP Needs to See

Right now the UI shows: coverage tier selector, duration, premium input, vault TVLs, and a static "In range" badge. That's the transaction interface. What's missing is the decision interface — the data that answers "should I protect this position, and how much should I pay?"

The analytics layer surfaces three things for every LP position:

1. **How much IL am I currently exposed to?** Real-time, computed from the entry price and current price.
2. **What would protection cost me relative to my fee income?** The net economics of protection — not just the premium, but the premium as a percentage of expected fee income.
3. **What's the worst case if I don't protect?** Historical volatility of this pair, maximum drawdown, and the IL at various price scenarios.

---

## New Components

### 1. Position Risk Card

Appears above the coverage selector when the user connects a wallet and enters a position ID. Reads on-chain data from the Uniswap v4 StateView contract and the Chainlink feed.

**Data to display:**

```
┌─────────────────────────────────────────┐
│  ETH / USDC  0.30%  #58294  v4         │
│  ■ In range                              │
│                                          │
│  Liquidity          $48,291.00           │
│  Entry Price        $2,641.18            │
│  Current Price      $2,048.32            │
│  Price Change       -22.4%               │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Current IL│ │Fee Income│ │  Net P&L │ │
│  │ -$342.18 │ │ +$891.50 │ │ +$549.32 │ │
│  │  -0.71%  │ │  +1.85%  │ │  +1.14%  │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                          │
│  ┌─ IL Risk Meter ──────────────────┐   │
│  │  ▓▓▓▓▓▓▓▓░░░░░░░░░░░░  Low      │   │
│  │  Current IL: 0.71% of position    │   │
│  │  Max IL at ±50%: ~5.7%            │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Data sources:**
- Entry price: read from IL Shield position storage (once `setPositionParams` is implemented) or entered manually by user
- Current price: Chainlink ETH/USD feed at `0x694AA1769357215DE4FAC081bf1f309aDC325306`
- IL computation: call `ILMath.computeIL()` via `useReadContract` with current on-chain values
- Fee income: either read from Uniswap v4 position data or entered as user estimate

**Implementation — new hook:**

```typescript
// hooks/usePositionAnalytics.ts

export function usePositionAnalytics(positionId: bigint) {
  const addrs = useChainAddresses();
  
  // Read Chainlink price
  const { data: chainlinkData } = useReadContract({
    address: addrs.Chainlink as Address,
    abi: CHAINLINK_ABI,
    functionName: 'latestRoundData',
  });
  
  // Read position data from ILShieldCore (if registered)
  const { data: positionData } = useReadContract({
    address: addrs.ILShieldCore,
    abi: IL_SHIELD_CORE_ABI,
    functionName: 'positions',
    args: [positionId],
  });
  
  // Compute IL on-chain via ILMath (or off-chain in JS)
  // For now, compute client-side using the IL formula
  const currentPrice = chainlinkData ? Number(chainlinkData[1]) / 1e8 : 0;
  
  return {
    currentPrice,
    entryPrice: positionData?.entrySqrtPriceX96 ? sqrtPriceToPrice(positionData.entrySqrtPriceX96) : null,
    priceChange: entryPrice ? ((currentPrice - entryPrice) / entryPrice) * 100 : 0,
    currentIL: computeILClientSide(entryPrice, currentPrice, tickLower, tickUpper, liquidity),
    ilPercent: currentIL / positionValue * 100,
    maxILAt50Pct: computeILClientSide(entryPrice, entryPrice * 1.5, tickLower, tickUpper, liquidity),
  };
}
```

### 2. Protection Economics Card

Shows below the Position Risk Card. Answers "is protection worth it?"

```
┌─────────────────────────────────────────┐
│  Protection Economics                    │
│                                          │
│  Monthly Premium     $42.17              │
│  Daily Cost          $1.41               │
│  as % of Position    0.035%/day          │
│                                          │
│  Daily Fee Income    ~$4.70 (estimated)  │
│  Protection Cost     ~30% of fees        │
│                                          │
│  ┌─ Break-Even Analysis ────────────┐   │
│  │  Protection pays for itself if    │   │
│  │  ETH moves >8.2% in either       │   │
│  │  direction during coverage.       │   │
│  │                                    │   │
│  │  Historical: ETH moved >8.2% in   │   │
│  │  67% of 30-day windows (2024-25)  │   │
│  └───────────────────────────────────┘   │
│                                          │
│  ┌─ Scenario Table ─────────────────┐   │
│  │  Price Move │ IL      │ Payout   │   │
│  │  ±5%        │ $68     │ $66      │   │
│  │  ±10%       │ $271    │ $265     │   │
│  │  ±20%       │ $1,052  │ $1,031   │   │
│  │  ±50%       │ $5,719  │ $5,604   │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Data sources:**
- Monthly premium: read from `PricingOracle.computePremiumRate()` via `useReadContract`
- Fee income estimate: user input or derived from pool volume data (Uniswap subgraph)
- Break-even: computed client-side from premium rate vs IL curve
- Scenario table: computed client-side using `ILMath` formula at various price points
- Historical probability: hardcoded from backtested data or fetched from an API

### 3. Vault Health Panel

Shows on the Protect screen as a collapsible section. Gives the LP confidence that the vault can actually pay claims.

```
┌─────────────────────────────────────────┐
│  Vault Health                     [v]    │
│                                          │
│  Senior Tranche     $5,050,000           │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  100%           │
│  8-12% target APY · Last-loss            │
│                                          │
│  Junior Tranche     $1,010,000           │
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  100%           │
│  20-50% target APY · First-loss          │
│                                          │
│  Combined TVL       $6,060,000           │
│  Utilization        12.3%                │
│  Max single payout  $50,000 (10x cap)   │
│  Combined ratio     34% (claims/prems)   │
│                                          │
│  Your position at 100% coverage:         │
│  Max payout = $50,000 (cap: 10x premium) │
│  Vault capacity: sufficient ✓            │
└─────────────────────────────────────────┘
```

**Data sources:**
- Vault TVLs: already implemented via `useVaultTotalAssets`
- Utilization: total outstanding coverage / total vault assets (requires reading active position count and summing maxPayouts, or a view function on the contract)
- Combined ratio: cumulative claims paid / cumulative premiums collected (requires events indexing or a contract view)

### 4. IL Scenario Visualizer

An interactive chart showing IL as a function of price movement for the user's specific position parameters (tick range, liquidity). The user can drag a slider to see IL at any price point.

```
  IL ($)
  │
  │                                    ╱
  │                                 ╱
  │                              ╱
  │                           ╱
  │                        ╱
  │─ ─ ─ coverage ─ ─ ─╱─ ─ ─ ─ ─ ─
  │                  ╱
  │               ╱
  │            ╱
  │         ╱
  │      ╱
  │   ╱
  │╱
  └────────────────────────────────── Price
       -50%  -30%  -10%  0  +10%  +30%  +50%

  [●─────────────────────○] Price slider
         Current: +0%
```

Implement as a React component using recharts (already available in the artifact runtime). The chart computes IL at 100 price points between -50% and +50% using the IL formula client-side.

---

## New Hooks Needed

```typescript
// hooks/useChainlinkPrice.ts
// Reads live ETH/USD price from Chainlink on Sepolia

// hooks/usePositionAnalytics.ts  
// Computes IL, fee estimates, break-even, and scenario table

// hooks/useVaultHealth.ts
// Reads both vault TVLs, computes utilization and capacity

// hooks/useILScenarios.ts
// Generates IL curve data for the visualizer chart
```

---

## New Utility: Client-Side IL Math

The IL formula must also be implemented in TypeScript for real-time client-side computation without RPC calls on every price change.

```typescript
// lib/ilmath.ts

export function computeIL(
  entrySqrtPriceX96: bigint,
  exitSqrtPriceX96: bigint,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint
): bigint {
  // Same formula as ILMath.sol but in BigInt arithmetic
  // HODL value at exit - LP value at exit
}

export function sqrtPriceToPrice(sqrtPriceX96: bigint): number {
  // Convert sqrtPriceX96 to human-readable price
  const price = Number(sqrtPriceX96 * sqrtPriceX96) / Number(2n ** 192n);
  return price;
}

export function priceToSqrtPriceX96(price: number): bigint {
  return BigInt(Math.floor(Math.sqrt(price) * Number(2n ** 96n)));
}

export function computeILAtPriceChange(
  entryPrice: number,
  priceChangePct: number,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  positionValueUSD: number
): { ilUSD: number; ilPercent: number; payoutUSD: number } {
  const exitPrice = entryPrice * (1 + priceChangePct / 100);
  const entrySqrt = priceToSqrtPriceX96(entryPrice);
  const exitSqrt = priceToSqrtPriceX96(exitPrice);
  const ilRaw = computeIL(entrySqrt, exitSqrt, tickLower, tickUpper, liquidity);
  const ilUSD = Number(ilRaw) / 1e6; // assuming USDC 6 decimals
  const ilPercent = (ilUSD / positionValueUSD) * 100;
  const payoutUSD = ilUSD * 0.98; // 2% settlement fee
  return { ilUSD, ilPercent, payoutUSD };
}
```

---

## Updated Page Layout

The protect screen should flow:

1. **Position Risk Card** (new) — shows current IL, fees, net P&L, risk meter
2. **Shield Divider** (existing)
3. **Protection Economics Card** (new) — premium cost analysis, break-even, scenarios
4. **Coverage tier + duration selectors** (existing)
5. **Premium input** (existing)
6. **Vault Health Panel** (new, collapsible)
7. **Summary rows** (existing)
8. **CTA button** (existing)
9. **IL Scenario Visualizer** (new, below card)

The active screen should show:
1. **Live P&L Cards** (existing, but with real computed values instead of $0.00)
2. **Premium streaming** (existing)
3. **IL Scenario Visualizer** (new, showing where current price sits on the curve)

---

## Implementation Priority

**Phase 1 (immediate value, no contract changes):**
- Chainlink price hook → display live ETH/USD price
- Client-side IL math library
- Vault Health Panel (TVLs already available)
- Scenario table (pure client-side computation)

**Phase 2 (requires position data):**
- Position Risk Card with real IL computation
- Protection Economics with break-even analysis
- IL Scenario Visualizer with position-specific curve

**Phase 3 (requires subgraph or indexer):**
- Fee income estimates from pool volume data
- Combined ratio from historical claims/premiums
- Historical volatility analysis for break-even probability
