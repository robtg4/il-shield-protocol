# IL Shield — Dual-Mode Analytics Design Specification

## Concept

One toggle switches between two views of the same position data. The simple view answers "should I protect?" in 10 seconds. The technical view answers "show me the math" for power users, auditors, and protocol researchers. Both views share the same underlying data hooks — the toggle only changes presentation.

The toggle sits in the top-right corner of the analytics section as a small pill: `Simple | Technical`. Default is Simple. The user's preference persists in localStorage.

---

## Toggle Component

A two-segment pill, 160px wide, matching Uniswap's tab pattern.

```
┌──────────────────┐
│ Simple │Technical │
└──────────────────┘
```

Active segment: `background: var(--pink-dim)`, `color: var(--pink)`.
Inactive segment: `background: transparent`, `color: var(--text2)`.
Container: `background: var(--input)`, `border-radius: 12px`, `padding: 2px`.

Implementation: a React state `viewMode: 'simple' | 'technical'` at the page level, passed down as a prop to every analytics component. Each component renders conditionally based on the mode.

---

## Simple View

### Card 1: "Your position" — the hook

```
┌─────────────────────────────────────────┐
│  [ETH/USDC logos]  ETH / USDC           │
│  $48,291 position                        │
│                                          │
│              You're currently losing      │
│                   -$342                   │
│            to impermanent loss            │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ Your fee income still covers it —   │ │
│  │ you're net positive: +$549          │ │
│  └─────────────────────────────────────┘ │
│                                          │
│  ┌─────────────────────────────────────┐ │
│  │ ⚠ But if ETH drops another 10%,    │ │
│  │ your IL jumps to $1,800+ and wipes  │ │
│  │ out your fees. This has happened in │ │
│  │ 67% of months since 2024.           │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

**Content rules:** The center number is the hero — the single largest text element on the page. It shows current IL in dollars. Below it, one of two callout boxes appears. Green if net P&L is positive ("your fee income still covers it"). Amber/red if net P&L is negative ("your fees can't cover this anymore — you're losing money"). The warning box always shows the "what if it gets worse" scenario — the IL at a further 10% move — and the historical probability. Use plain English: "67% of months" not "67th percentile of 30-day realized volatility windows."

**Data:** Current IL from `ILMath.computeIL()` (client-side or contract call). Fee income either from user input or subgraph. Net P&L = fees - IL. Historical probability is hardcoded per pair from backtested data.

### Card 2: "What could happen" — the slider

```
┌─────────────────────────────────────────┐
│  What could happen                       │
│                                          │
│  ETH moves  [●────────────○]  ±20%      │
│                                          │
│  ┌───────────────┐ ┌───────────────┐    │
│  │Without protect│ │With IL Shield │    │
│  │   -$1,052     │ │   +$989       │    │
│  │ you lose 2.2% │ │you get paid   │    │
│  └───────────────┘ └───────────────┘    │
└─────────────────────────────────────────┘
```

**Content rules:** The slider goes from 0% to 50%. Both directions produce the same IL (IL is symmetric for concentrated positions), so we show "±X%". The two cards are side-by-side: red (without) and green (with). The "with" card shows the net result after subtracting the monthly premium — it's the actual profit from having protection, not just the gross payout. At low moves where the premium exceeds the payout, the "with" card shows the premium cost in a softer tone: "-$42 (just the premium)".

**Interaction:** As the slider moves, both cards update in real time. No chart, no axes, no data points — just two numbers and a slider. The simplest possible way to show the value proposition.

### Card 3: "What it costs" — the anchor

```
┌─────────────────────────────────────────┐
│  What it costs                           │
│                                          │
│  $1.41 per day                           │
│  $42/month — less than Netflix for       │
│  a $48K position.                        │
│                                          │
│  [shield] Protection pays for itself     │
│           if ETH moves ±8.2%             │
│           This happens 2 of 3 months     │
│                                          │
│  [check]  $6M in vault reserves          │
│           Your max payout: $50,000       │
└─────────────────────────────────────────┘
```

**Content rules:** Lead with the daily cost in large text. Follow with the monthly cost and a comparison the user already understands (Netflix, a cup of coffee, whatever scales to the premium amount). Then two trust signals as icon-text rows: the break-even and the vault backing. No mention of "Senior tranche" or "Junior tranche" — just "vault reserves."

### Card 4: "How it works" — three steps

```
┌─────────────────────────────────────────┐
│  How it works                            │
│                                          │
│  ① You deposit a small premium           │
│     Like insurance. Streams per-block.   │
│                                          │
│  ② Keep LPing normally on Uniswap       │
│     Nothing changes. Earn fees as usual. │
│                                          │
│  ③ Close your position anytime           │
│     If ETH moved → we pay you back.      │
│     If not → unused premium refunded.    │
│                                          │
│  ✓ Payout is automatic                   │
│    USDC in your wallet. No claims.       │
└─────────────────────────────────────────┘
```

**Content rules:** Three numbered steps + one green checkmark conclusion. Maximum 15 words per step description. No mention of ILPNs, ERC-4626, oracle verification, or warming periods. Those exist but they're implementation details the simple-view user doesn't need.

---

## Technical View

### Card 1: "Position risk" — the data card

```
┌─────────────────────────────────────────┐
│  ETH / USDC  0.30%  #58294  v4  [In ✓] │
│                                          │
│  Liquidity     $48,291  Entry    $2,641  │
│  Current       $2,048   Change   -22.4%  │
│                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │Current IL│ │Fee Income│ │  Net P&L │ │
│  │ -$342.18 │ │ +$891.50 │ │ +$549.32 │ │
│  │  -0.71%  │ │  +1.85%  │ │  +1.14%  │ │
│  └──────────┘ └──────────┘ └──────────┘ │
│                                          │
│  IL risk: 0.71% current, 5.7% at ±50%   │
└─────────────────────────────────────────┘
```

**Content rules:** Show all the data: position ID, pool version, fee tier, exact dollar amounts with cents, percentages to two decimal places. The P&L trifecta shows both dollars and percent of position. The risk summary at the bottom shows current IL% and max IL% at the extreme of the range. All financial values use `JetBrains Mono`.

### Card 2: "IL curve" — the interactive chart

```
┌─────────────────────────────────────────┐
│  IL at different price moves             │
│                                          │
│  [Chart: IL ($) vs Price Change (%)]     │
│  - X axis: -50% to +50%                 │
│  - Y axis: $0 to $6,000                 │
│  - Red filled area under curve           │
│  - Dashed horizontal line at premium     │
│    cost (break-even reference)           │
│                                          │
│  [●────────────○]  Simulate: +0%         │
│  IL: $0    Payout (100%): $0             │
│                                          │
│  ┌─ Scenario table ─────────────────┐   │
│  │ Move   │ IL      │ 50%   │ 75%   │   │
│  │        │         │ tier  │ tier  │   │
│  │ ±5%    │ $68     │ $33   │ $50   │   │
│  │ ±10%   │ $271    │ $133  │ $199  │   │
│  │ ±20%   │ $1,052  │ $515  │ $773  │   │
│  │ ±50%   │ $5,719  │ $2,802│ $4,203│   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Content rules:** The chart shows the full IL curve using Chart.js with a red filled area. A horizontal dashed line at the monthly premium level provides the visual break-even reference. The slider below the chart lets the user simulate any price point. The scenario table below shows IL and payout at standard move sizes, broken out by coverage tier (50/75/100). This table is the technical version of the simple view's two-card comparison — same data, more detail, all three tiers.

### Card 3: "Premium economics" — the protocol math

```
┌─────────────────────────────────────────┐
│  Premium economics                       │
│                                          │
│  ┌───────────────┐ ┌───────────────┐    │
│  │Monthly premium│ │ Break-even    │    │
│  │    $42.17     │ │    ±8.2%      │    │
│  │ 0.087%/month  │ │ IL > premium  │    │
│  └───────────────┘ └───────────────┘    │
│                                          │
│  Premium rate      0.058 USDC/block      │
│  Streaming rate    $0.058/hr             │
│  Activation delay  10 blocks (~2 min)    │
│  Coverage ramp     50 blocks (~10 min)   │
│  Settlement fee    2%                    │
│  Max payout cap    10× premium deposit   │
│                                          │
│  ┌─ Historical context ─────────────┐   │
│  │ ETH 30-day realized vol: 72%      │   │
│  │ ETH >8.2% moves in 30d: 67%      │   │
│  │ Premium as % of daily fees: ~30%  │   │
│  │ Estimated payback period: 8.4d    │   │
│  └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

**Content rules:** This is the full parameter disclosure. Every protocol parameter that affects the user's economics is visible: streaming rate in both per-block and per-hour, activation delay, coverage ramp, settlement fee, payout cap. The historical context section shows the data behind the "67% of months" claim: realized volatility, move frequency, and the premium-to-fee ratio.

### Card 4: "Vault health" — the tranche detail

```
┌─────────────────────────────────────────┐
│  Vault health                            │
│                                          │
│  Senior tranche       $5,050,000         │
│  [████████████████████] 100%             │
│  8-12% target APY · last-loss            │
│  Share price: 1.0004                     │
│                                          │
│  Junior tranche       $1,010,000         │
│  [████████████████████] 100%             │
│  20-50% target APY · first-loss          │
│  Share price: 1.0021                     │
│                                          │
│  Utilization          12.3%              │
│  Active positions     47                 │
│  Combined ratio       34%                │
│  S/J ratio            5.0:1              │
│  Claim capacity       $6,060,000         │
│  Your max payout      $50,000 (10x cap)  │
│                                          │
│  Oracle: Chainlink ETH/USD               │
│  Feed: 0x694AA...25306 (live, 8 dec)     │
│  Last update: 12 sec ago                 │
│  TWAP: not configured                    │
└─────────────────────────────────────────┘
```

**Content rules:** Full tranche breakdown with share prices, the Senior/Junior ratio, active position count, combined ratio (claims/premiums), and the oracle configuration. This is the information an auditor or sophisticated underwriter needs to evaluate the protocol's solvency. The oracle section shows the exact Chainlink feed address, its decimal precision, and how recently it was updated — the same data the fork tests validate.

---

## Shared Data Layer

Both views consume the same hooks. The toggle changes rendering, not data fetching.

```typescript
// The analytics data model — computed once, rendered two ways

interface PositionAnalytics {
  // Position data
  pair: string;                    // "ETH/USDC"
  positionId: string;              // "#58294"
  feeRate: string;                 // "0.30%"
  liquidity: number;               // 48291 (USD)
  entryPrice: number;              // 2641.18
  currentPrice: number;            // 2048.32
  priceChangePct: number;          // -22.4
  inRange: boolean;
  
  // P&L
  currentIL: number;               // 342.18
  currentILPct: number;            // 0.71
  feeIncome: number;               // 891.50
  feeIncomePct: number;            // 1.85
  netPnL: number;                  // 549.32
  netPnLPct: number;               // 1.14
  isNetPositive: boolean;
  
  // Risk projection
  ilAt10PctMove: number;           // 1800 (approx)
  ilAt50PctMove: number;           // 5719
  maxILInRange: number;            // max IL within tick range
  historicalMoveProb: number;      // 0.67 (67% of 30-day windows)
  
  // Premium economics
  monthlyPremium: number;          // 42.17
  dailyCost: number;               // 1.41
  premiumPerBlock: number;         // 0.058
  breakEvenMove: number;           // 8.2 (percent)
  premiumAsFeePercent: number;     // 30 (premium is 30% of daily fees)
  
  // Vault health
  seniorTVL: number;               // 5050000
  juniorTVL: number;               // 1010000
  utilization: number;             // 12.3 (percent)
  combinedRatio: number;           // 34 (percent)
  sjRatio: number;                 // 5.0
  maxPayout: number;               // 50000
  activePositions: number;         // 47
  
  // Oracle
  chainlinkAddress: string;
  chainlinkPrice: number;
  chainlinkLastUpdate: number;     // seconds ago
  chainlinkDecimals: number;
  twapConfigured: boolean;
}
```

### Hook: `usePositionAnalytics(positionId: bigint)`

Returns the full `PositionAnalytics` object. Internally:

1. Reads Chainlink price via `useReadContract` on the feed address.
2. Reads position data from ILShieldCore (if registered) or accepts manual entry price.
3. Computes IL, net P&L, and all scenario values client-side using `lib/ilmath.ts`.
4. Reads vault TVLs from both vaults via existing `useVaultTotalAssets` hooks.
5. Computes premium economics from `PricingOracle.computePremiumRate` or client-side estimate.
6. Returns memoized analytics object that updates on price change (refetch on 15-second interval).

### Simple View Rendering

```typescript
function SimpleAnalytics({ data }: { data: PositionAnalytics }) {
  return (
    <>
      <PositionHookCard il={data.currentIL} netPnL={data.netPnL} 
        isPositive={data.isNetPositive} ilAt10Pct={data.ilAt10PctMove}
        historicalProb={data.historicalMoveProb} />
      <WhatCouldHappenSlider positionValue={data.liquidity} 
        monthlyPremium={data.monthlyPremium} />
      <WhatItCostsCard dailyCost={data.dailyCost} monthly={data.monthlyPremium}
        breakEven={data.breakEvenMove} vaultTVL={data.seniorTVL + data.juniorTVL}
        maxPayout={data.maxPayout} />
      <HowItWorksSteps />
    </>
  );
}
```

### Technical View Rendering

```typescript
function TechnicalAnalytics({ data }: { data: PositionAnalytics }) {
  return (
    <>
      <PositionRiskCard data={data} />
      <ILCurveChart positionValue={data.liquidity} entryPrice={data.entryPrice}
        tickLower={data.tickLower} tickUpper={data.tickUpper} 
        monthlyPremium={data.monthlyPremium} />
      <PremiumEconomicsCard data={data} />
      <VaultHealthCard data={data} />
    </>
  );
}
```

---

## Toggle Behavior

The toggle is a controlled component that saves to localStorage for persistence.

```typescript
function ViewToggle({ mode, onChange }: { mode: 'simple' | 'technical', onChange: (m: 'simple' | 'technical') => void }) {
  return (
    <div className="flex bg-input rounded-xl p-0.5 text-sm">
      <button onClick={() => onChange('simple')}
        className={`px-4 py-1.5 rounded-[10px] font-medium transition-all ${
          mode === 'simple' ? 'bg-pink-dim text-pink' : 'text-text2'
        }`}>Simple</button>
      <button onClick={() => onChange('technical')}
        className={`px-4 py-1.5 rounded-[10px] font-medium transition-all ${
          mode === 'technical' ? 'bg-pink-dim text-pink' : 'text-text2'
        }`}>Technical</button>
    </div>
  );
}
```

Placement: top-right of the analytics section, inline with the section title. On mobile, it floats right-aligned above the first card.

Default: `simple`. On first load, check `localStorage.getItem('ilshield-view-mode')`. If absent, default to `simple`. Save on every toggle: `localStorage.setItem('ilshield-view-mode', mode)`.

---

## Where It Lives in the Page

The analytics section appears between the position input and the coverage configuration. The protect screen flows:

1. Hero headline: "Protect anytime, anywhere."
2. Card: Position input (existing)
3. Shield divider (existing)
4. **Analytics section** (new — toggle + cards based on mode)
5. Coverage tier + duration selectors (existing)
6. Premium input (existing)
7. Summary rows (existing)
8. CTA button (existing)

The analytics section renders when either of these conditions are met: the user has entered a position ID (even before connecting a wallet — show estimates with default params), or the user has connected a wallet and has an active position.

When no position data is available, the analytics section shows a placeholder state with the simple view using example data and a subtle label: "Example position — connect wallet for real data."

---

## Responsive

Both views are single-column at all breakpoints. The P&L trifecta in the technical view switches from 3-column to stacked at 380px width. The scenario table in the technical view switches from 4-column (move/IL/50%/75%/100%) to 3-column (move/IL/100%) at 380px. The slider works on touch with no modification needed (native range input).

---

## Animation

The toggle transition between views uses a 200ms cross-fade. Components that exist in both views (like the P&L values) morph rather than fade — the number stays in place but the surrounding chrome changes. Components unique to one view (like the chart or the "how it works" steps) fade in/out.

Implement with a wrapping div that applies `opacity` and `transform: translateY` transitions:

```css
.analytics-enter { opacity: 0; transform: translateY(8px); }
.analytics-active { opacity: 1; transform: translateY(0); transition: all 200ms ease; }
```

---

## File Structure

```
src/
  components/
    analytics/
      ViewToggle.tsx
      SimpleAnalytics.tsx
      TechnicalAnalytics.tsx
      PositionHookCard.tsx        (simple: hero IL number + callouts)
      WhatCouldHappenSlider.tsx   (simple: side-by-side comparison)
      WhatItCostsCard.tsx         (simple: daily cost + trust signals)
      HowItWorksSteps.tsx         (simple: 3-step explainer)
      PositionRiskCard.tsx        (technical: full position data)
      ILCurveChart.tsx            (technical: Chart.js IL curve + slider)
      PremiumEconomicsCard.tsx    (technical: all protocol parameters)
      VaultHealthCard.tsx         (technical: tranche detail + oracle)
      ScenarioTable.tsx           (technical: multi-tier payout table)
      PLTrifecta.tsx              (shared: IL / fees / net cards)
  hooks/
    usePositionAnalytics.ts       (shared data layer)
    useChainlinkPrice.ts          (live price from Chainlink)
    useILScenarios.ts             (scenario computation)
  lib/
    ilmath.ts                     (client-side IL formula)
    scenarios.ts                  (break-even, historical data)
```
