# IL Shield Protocol — Definitive Specification

**Tokenized Impermanent Loss Protection for Uniswap v4 Liquidity Providers**

Version 1.0 — April 2026

---

## 1. Problem and Market

### 1.1 The Problem

Impermanent loss is the largest unhedged financial risk in decentralized finance. When a liquidity provider deposits assets into a Uniswap pool, the automated market maker continuously rebalances the position — selling the appreciating asset and buying the depreciating one. The result is that the LP's portfolio systematically underperforms a simple buy-and-hold strategy whenever token prices diverge from their entry levels. This divergence loss is mathematically equivalent to writing a short straddle without collecting adequate premium, and it scales quadratically with volatility.

The scale of the problem is enormous. A study by Topaze Blue analyzing 17 Uniswap v3 pools (representing 43% of platform TVL at the time of analysis) found that LPs collectively earned $199.3 million in trading fees but suffered $260.1 million in impermanent loss — a net deficit of $60.8 million. Broader research from 2025 indicates that only 37.2% of non-stablecoin liquidity positions ended profitably after accounting for IL. The consequence is a massive capital allocation inefficiency: approximately 60% of institutional DeFi allocations now flow exclusively to stablecoin pools specifically to avoid IL exposure, leaving volatile pairs structurally undercapitalized.

Uniswap v3 and v4's concentrated liquidity feature dramatically amplifies the problem. While concentration improves capital efficiency by up to 4,000×, it proportionally amplifies IL exposure. A position with a ±10% price range experiences roughly 5–8× more IL than a full-range position for the same price movement. When the price exits the range entirely, the LP holds 100% of the depreciating asset, earns zero fees, and the loss becomes effectively permanent unless actively managed. The estimated annual IL across Uniswap's pools is $1.5–3 billion.

### 1.2 The Market

Uniswap v4 launched in January 2025 and has rapidly become the dominant version, holding approximately $6.2 billion in TVL across 2,500+ hook-enabled pools. Uniswap v3 has declined to approximately $1.6 billion and v2 retains roughly $834 million. Over 67% of daily volume now occurs on Layer 2 networks, with Unichain (Uniswap's native L2) handling 50–75% of v4 transaction volume. The largest pools — ETH/USDC, ETH/USDT, WBTC/ETH — remain the dominant trading pairs across all versions.

Demonstrated demand for IL protection is strong despite every prior solution failing. Bancor's IL protection mechanism attracted $2.3 billion in deposits before its catastrophic collapse in June 2022. STON.fi's IL protection feature drove a 100% increase in liquidity providers. OrBit Markets has found traction with institutional OTC IL hedging, backed by Brevan Howard Digital and Matrixport. Institutional funds including Re7 Capital and Maven 11 have publicly stated that IL hedging is a critical unmet need. The capital currently avoiding non-stablecoin pools due to IL risk represents a multi-billion-dollar unlock opportunity.

The addressable market breaks down across three horizons. In the near term (2026–2027), targeting institutional LPs on Uniswap's top pools with a conservative 10–20% penetration rate at 3–5% annual premium yields a $50–100 million annual premium revenue opportunity. In the medium term (2027–2029), expansion to $200–500 million is plausible as structured LP products mature. The broader DEX market ($13 billion TVL) and projected DeFi growth (26.4% CAGR to $770 billion by 2031) provide additional upside.

---

## 2. Competitor Landscape

### 2.1 Bancor — The Cautionary Tale

Bancor v2.1 (2020) and v3 (2022) offered IL protection funded by trading fees and, critically, by minting the native BNT token when fees fell short. This created a reflexive death spiral during the June 2022 crypto crash: IL spiked across all pools, BNT was minted to cover claims, the minting crashed BNT's price, which caused more IL on BNT-paired pools, triggering more minting. Bancor v3 ran a $40 million deficit within one month of launch. The protocol paused IL protection on June 19, 2022 — precisely when LPs needed it most. A class-action lawsuit followed, alleging Bancor operated as an unregistered security (dismissed in September 2024 on jurisdictional grounds without reaching the merits). The lesson is unambiguous: IL protection cannot be funded by native token inflation because the insurance liability correlates perfectly with the insurer's ability to pay.

### 2.2 Panoptic — The Options Engine

Panoptic treats Uniswap LP positions as perpetual options with streaming premia ("Streamia"), enabling LPs to buy protective long options that directly offset IL. V1 launched on Ethereum in December 2024; V2 (launching early 2026) introduces Perpetual Option Vaults (POVs) that automate range selection, rebalancing, and position management. Panoptic's research (with Block Scholes) demonstrated that combining a standard LP position with a short perpetual call reduces losses from -0.49% to -0.02% on a 1% ETH drop while doubling fee income. Panoptic is backed by Uniswap Labs Ventures, Jane Street, and Coinbase Ventures. The strength is theoretical rigor; the weakness is user complexity — LPs must understand options concepts and actively manage positions.

### 2.3 GammaSwap — Inverse IL Exposure

GammaSwap allows "borrowing" LP tokens to create the opposite payoff — impermanent gain. A trader who expects volatility can effectively go long IL by shorting LP positions. This creates a two-sided market for IL risk but requires active trading sophistication on both sides and has struggled with liquidity bootstrapping.

### 2.4 Gamma Strategies, Charm Finance, Arrakis — Active Management

These protocols optimize the fee-to-IL ratio through automated range management and passive rebalancing. Charm's insight of avoiding active swaps (placing limit orders instead) is elegant. Gamma Strategies has become the most commercially successful LP management protocol. These solutions reduce IL by perhaps 30–50% but do not eliminate it, and they fail in strongly trending markets. They are complements to IL protection, not substitutes.

### 2.5 OrBit Markets — Institutional OTC

OrBit Markets offers bespoke OTC IL hedging products for institutional counterparties, pricing them using traditional derivatives frameworks. The product works for large allocators but is inaccessible to the broader LP market and operates through bilateral agreements rather than on-chain infrastructure.

### 2.6 IL Shield — The Insurance Product

IL Shield occupies the whitespace between Panoptic's sophisticated options engine and Gamma Strategies' active management. It is designed as an insurance product: LPs pay a premium, receive protection against IL, and do not need to understand options Greeks or manage positions. The ERC-721 protection token is position-specific but non-tradeable (to avoid securities classification), and the underwriting vault is denominated exclusively in stablecoins to avoid Bancor's correlation trap. The closest traditional analogy is parametric crop insurance — payout triggered by an oracle-verified on-chain event (price divergence), priced actuarially against expected loss, and collateralized by a segregated risk pool.

---

## 3. Solution Description

### 3.1 Core Thesis

Impermanent loss is not a mysterious DeFi phenomenon but a well-characterized short options payoff with established pricing, hedging, and replication techniques. The expected IL for a full-range position under geometric Brownian motion is σ²T/8, and for concentrated positions this scales by a concentration multiplier derived from the tick range. The Fukasawa-Maire-Wunsch theorem (Quantitative Finance, 2023) proves IL can be hedged with a weighted variance swap of order 1/2. Lipton-Lucic-Sepp (Digital Finance, 2025) derived closed-form pricing for the "IL Protection Claim." The academic foundations are mature and the infrastructure — Uniswap v4 hooks, Chainlink oracles, ERC-4626 vaults, ZK coprocessors — now exists to build this on-chain.

### 3.2 Product Description

IL Shield is a peripheral protocol that wraps existing Uniswap v4 (and v3) LP positions with parametric IL protection. LPs provide liquidity to standard Uniswap pools (benefiting from existing depth and fee income), then separately register their position with IL Shield and purchase a protection policy. The protocol tracks IL using a combination of on-chain hook accumulators and ZK-verified historical data, then settles claims parametrically when the LP closes their position.

The protection is denominated in USDC and pays out the measured IL (up to the selected coverage tier) from a tranched underwriting vault. Protection is continuous (streaming premiums per block) with quarterly rate adjustments based on trailing loss experience, eliminating the insurance paradox of premiums spiking during high-volatility periods. A graduated waiting period (48–72 hours plus 7-day linear ramp to full coverage) prevents adverse selection from event-driven protection buying.

The protocol does not issue tradeable protection tokens (avoiding securities classification) and does not use any native governance token as collateral or for premium subsidies (avoiding Bancor's failure mode). Protection claims are non-transferable ERC-721 NFTs that encode exact position parameters and burn on settlement or expiry.

### 3.3 Design Principles

Five principles separate IL Shield from every prior attempt. First, price actuarially: premiums are computed from the net IL framework (gross IL minus expected fee income) with a volatility-derived risk loading, not subsidized by token inflation. Second, collateralize in stablecoins: the underwriting vault holds a diversified basket (60% USDC, 30% USDT, 10% DAI) uncorrelated with crypto market drawdowns. Third, tranche the risk: a senior/junior vault structure isolates conservative yield seekers from the first-loss risk absorbed by return-seeking capital. Fourth, verify trustlessly: ZK coprocessors (Brevis) and optimistic oracle patterns (UMA) eliminate continuous keeper dependency for IL computation. Fifth, structure for regulatory clarity: parametric settlement with proof-of-loss attestation, non-tradeable cover tokens, and Bermuda-domiciled entity using the BMA insurance sandbox.

---

## 4. Architecture

### 4.1 Dual-Mode Integration

IL Shield operates in two modes to accommodate both existing deep-liquidity pools and new pool deployments.

**Primary mode (peripheral wrapping):** The LP provides liquidity to any standard Uniswap v4 pool, then calls `ILShield.register(positionId, coverageTier, duration)` in a separate transaction. The protocol reads position parameters (entry sqrtPriceX96, tick range, liquidity amount) from Uniswap's PositionManager, computes the premium via the Pricing Oracle, begins streaming premium deductions from the LP's deposited USDC balance, and mints a non-transferable ERC-721 protection NFT (ILPN). When the LP closes their Uniswap position, they call `ILShield.settle(ilpnId)` to trigger claim evaluation and payout. This mode preserves the LP's access to the deepest, highest-volume pools and eliminates the liquidity fragmentation problem that would arise from creating separate protected pools.

**Secondary mode (native hook):** For new pool deployments where IL protection is a native feature (protocol-owned liquidity, new token launches, institutional LP pools), the IL Shield Hook implements `afterAddLiquidity` (capture entry state, deduct premium via return delta, mint ILPN), `afterSwap` (lightweight price checkpointing to a tickCumulative accumulator at ~5,000 gas per invocation), and `beforeRemoveLiquidity` / `afterRemoveLiquidity` (compute IL, settle claim, burn ILPN). This mode provides atomic premium collection and settlement within a single transaction.

### 4.2 Contract Architecture

The protocol consists of six on-chain contracts.

**IL Shield Core** is the central registry and settlement engine. It stores position registrations, manages ILPN minting and burning, coordinates premium streaming, and executes claim settlement. It interfaces with the Pricing Oracle for premium computation, the underwriting vaults for premium distribution and claim payouts, and the oracle module for settlement price verification.

**Senior Vault** (ERC-4626, USDC-denominated) accepts deposits from risk-averse stablecoin yield seekers and pays a fixed yield (target 8–12% APY) funded by premium income. Senior depositors bear IL claim risk only after the Junior Vault's assets are fully exhausted. Deposits are subject to a 14-day minimum lock. Withdrawals are throttled by utilization: instant below 60% utilization, 3-day queue at 60–80%, 7-day queue above 80%, with a 5% penalty emergency withdrawal always available.

**Junior Vault** (ERC-4626, USDC-denominated) accepts deposits from return-seeking capital and absorbs all IL claim payouts as first-loss capital. Junior depositors receive residual returns after Senior yield obligations, treasury allocation, and referral fees are deducted — yielding 20–50% APY in normal conditions, with potential for capital loss during high-IL periods. Deposits are subject to a 30-day minimum lock. Withdrawals are additionally constrained by a Senior/Junior ratio floor: Junior cannot withdraw if doing so would push the ratio above 5:1.

**ILPN Registry** (ERC-721, non-transferable) mints protection NFTs that encode position-specific parameters: pool identifier, entry sqrtPriceX96, tick range, liquidity amount, coverage tier, coverage start block, coverage duration, and maximum payout. Non-transferability is enforced at the contract level (overriding ERC-721 transfer functions to revert) to avoid securities classification and eliminate basis risk.

**Pricing Oracle** computes premiums using the net IL framework (Section 5) and provides settlement price verification. It integrates Chainlink Data Feeds as the canonical price source, Pyth Network as a fallback, and the pool's internal TWAP (via hook accumulator or Brevis-verified historical data) as a circuit-breaker cross-check. The volatility feed composites 30-day rolling realized volatility (Yang-Zhang estimator on pool swap data) with an implied volatility floor from Deribit (submitted by a keeper every 4 hours with an 8-hour staleness check).

**IL Shield Hook** (optional, implements IHooks) provides native integration for greenfield pools. Implements `afterInitialize`, `afterAddLiquidity` (with return delta for premium deduction), `afterSwap` (tickCumulative accumulator), `beforeRemoveLiquidity`, and `afterRemoveLiquidity` (with return delta for claim payout). Hook permissions include `afterAddLiquidityReturnDelta` and `afterRemoveLiquidityReturnDelta`.

### 4.3 Data Verification Stack

IL computation at settlement requires trustless verification of historical price data. The protocol layers three mechanisms at different cost-trust tradeoffs.

The v4 hook accumulator (Layer 1) is a self-maintaining tickCumulative register that updates on every swap within the hook's `afterSwap` callback at approximately 5,000–20,000 gas per swap (borne by the swapper, not the protocol). At settlement, the contract reads accumulator values at position entry and current time to compute IL deterministically for approximately 50,000–100,000 gas. This is the primary data source for positions opened after hook deployment.

Brevis zkCoprocessor (Layer 2) provides trustless fallback for positions predating hook deployment or requiring cross-pool data. Brevis proves any historical Ethereum storage slot value with a ZK proof verified on-chain. The coChain mode (an EigenLayer AVS with $15B+ restaked ETH security) costs approximately 150,000–250,000 gas in the optimistic path, falling back to full ZK proof generation if disputed at 350,000–550,000 gas. Brevis has generated 125 million+ ZK proofs in production and processes proofs in 6.9 seconds average latency.

UMA Optimistic Oracle v3 (Layer 3) handles complex computations too expensive for ZK circuits (multi-asset portfolio IL, custom fee-adjusted calculations). An asserter submits the IL amount with a $5,000–$10,000 USDC bond. If unchallenged for 2 hours, settlement proceeds at approximately 200,000–300,000 gas total. Disputes escalate to UMA's DVM where token holders vote over 48 hours. UMA has processed 10,000+ assertions across $19 billion+ in Across Protocol volume with zero security failures.

This layered approach replaces continuous keeper monitoring ($3,600–$7,200/month per position on Ethereum mainnet) with settlement-time verification costing $2–$25 per claim — a reduction of two to three orders of magnitude in operating cost.

### 4.4 Oracle Architecture

Settlement uses Chainlink as the canonical price source with a TWAP circuit-breaker mechanism. If Chainlink and the pool's 30-minute TWAP diverge by more than 3%, settlement delays by 6 hours and re-evaluates. If divergence persists, settlement uses the median of Chainlink, Pyth, and TWAP. This protects both the LP (against vault-favorable price manipulation) and the vault (against LP-favorable manipulation) through a dispute period rather than a unilateral resolution rule.

The volatility oracle composites three sources: 30-day rolling realized volatility computed from pool swap history (Yang-Zhang estimator), 30-day ATM implied volatility from Deribit (submitted by a keeper every 4 hours), and a per-pool governance-set volatility floor (e.g., 35% for ETH/USDC, 15% for USDC/USDT). The premium pricing volatility is the maximum of these three values.

---

## 5. Pricing Engine — Why It Works

### 5.1 Net IL Framework

The critical insight from the v0.1 adversarial review is that pricing protection against gross IL double-charges the LP — fees already partially compensate for IL risk. IL Shield prices against net IL:

```
Premium = max(0, E[NetIL]) × RiskLoading × CoverageTier × UtilizationCurve

E[NetIL]  = E[GrossIL] - E[FeeIncome]
E[GrossIL] = (σ²T / 8) × C(R)
E[FeeIncome] = FeeRate × E[Volume/Liquidity] × T
C(R) = 1 / (1 - 1/√R)  where R = P_upper / P_lower
```

This produces dramatically more viable LP economics than gross IL pricing. At ETH's long-run average volatility of approximately 50%, expected fee income typically exceeds expected IL for reasonably wide positions, pushing the net IL premium toward zero. The protection becomes a tail-risk hedge purchased cheaply during calm periods — exactly the product structure that makes insurance markets work.

### 5.2 Dynamic Pricing Components

**Risk loading** starts at 1.40× expected net IL and increases by 0.80 per percentage point of annualized volatility above 50%. This provides adequate tail coverage for the vault while remaining competitive during normal conditions.

**The C-level coefficient** (adapted from Premia Finance's production pricing engine) applies an exponential multiplier that adjusts after every protection purchase based on pool-specific utilization: C_{t+1} = C_t × e^{-α × ΔS}. Initialized at 5× (intentionally overpriced to protect the vault during bootstrapping), it converges toward equilibrium at 85–95% utilization. When sophisticated LPs rush to buy protection before anticipated volatility, the exponential response reprices within the same block.

**The utilization curve** follows an Aave-style kinked model: flat below 40% utilization, linearly increasing from 1.0× to 2.0× between 40% and 75%, then exponentially increasing above 75% (slope₂ is 10× steeper than slope₁). This naturally throttles protection sales as vault capacity depletes.

### 5.3 Subscription-Based Streaming Premiums

Rather than episodic premium payments (which enable adverse selection through buy-drop-buy timing), IL Shield implements continuous premium streaming. The LP deposits a USDC premium balance, and premiums accrue per-block at the current rate. Rates adjust quarterly based on trailing 12-month loss experience, not in real-time — mirroring how health insurers use prior-year data for annual rate-setting. This decouples the LP's cost from current volatility, solving the insurance paradox where premiums spike precisely when protection is most needed.

A 7-day GWAV (geometric weighted average value, adapted from Lyra Finance) smooths the volatility input to the pricing formula, preventing intraday or intraweek vol spikes from passing through to premium rates during the quarterly adjustment.

### 5.4 Anti-Adverse-Selection Mechanisms

The protocol stacks four mechanisms against sophisticated adverse selectors. A 48–72 hour activation delay with 7-day linear coverage ramp (`effectiveCoverage = min(1, (currentBlock - startBlock) / warmingBlocks)`) prevents event-driven purchasing. A bonus-malus experience rating system adjusts premiums by 0.95× per claim-free epoch and 1.25× per claim, within a 0.5×–3.0× range, creating switching costs that penalize the buy-drop-buy pattern. A Rothschild-Stiglitz menu of coverage tiers (100% coverage with no deductible, 80% with 10% deductible, 50% with 25% deductible) creates a separating equilibrium where different risk types self-select into different contracts. The C-level coefficient provides within-block repricing when purchase volume spikes.

---

## 6. Revenue Model

### 6.1 Revenue Streams

**Protection premiums (80–90% of revenue):** LPs pay streaming premiums for IL coverage. At $100 million in protected positions with an average 12% annualized premium rate, this generates $12 million annually. Premium distribution: 70% to Senior Vault (pays fixed senior yield), 15% to Junior Vault (residual income), 10% to Protocol Treasury (operations, reinsurance, development), 5% to integration partners.

**Settlement fees (5–10% of revenue):** A 2% fee on claim payouts covers on-chain gas cost (reimbursed to the keeper or ZK proof submitter), oracle query costs, and a small protocol margin. On $5 million of annual claims, this generates approximately $100,000.

**Protected LP Vault management fees (Phase 2, 5–15% of revenue):** Managed vaults combining active LP management with automatic IL protection purchasing charge 1% annual management fee plus 10% performance fee. On $100 million AUM, this generates $1 million+ annually.

**Data and analytics (Phase 3, optional):** Proprietary IL frequency, severity, and correlation data sold via premium API to institutional subscribers at $200–500K annually.

### 6.2 Unit Economics

The critical metric is the combined ratio — total claims paid divided by total premiums earned. The target combined ratio is 65–80%. The ratio is inherently self-correcting because premiums are priced off the same volatility that drives claims: when volatility is high, both premiums and claims rise; when low, both fall. The 1.40× risk loading provides the margin of safety. Historical backtesting against 2020–2025 ETH price data should validate that this loading produces a combined ratio in the 60–80% range across market regimes, with the caveat that extreme tail events (March 2020, May 2022) push the ratio above 100% in specific months — absorbed by the Junior tranche.

### 6.3 Revenue Projections

Phase 1 (months 3–6): $20–50 million in protected positions, $340K–$1M annualized protocol revenue. Phase 2 (months 7–12): $100–250 million protected, $50–100M Protected LP Vault AUM, $1.7–4.8M annualized. Phase 3 (months 13–24): $500M–1B protected, $200–500M vault AUM, $9–23M annualized.

---

## 7. Stakeholders

### 7.1 Liquidity Providers (Protection Buyers)

LPs are the demand side. They deposit into standard Uniswap v4 pools, then purchase IL protection from IL Shield. Their value proposition is guaranteed downside limits on IL exposure in exchange for a premium that, under the net IL framework, approaches zero during normal-volatility periods and represents meaningful but manageable cost during elevated-volatility periods. The primary personas are institutional LPs and DAO treasuries managing significant positions who require hard risk limits for portfolio construction, and sophisticated retail LPs seeking to expand into volatile pairs currently avoided due to IL risk.

### 7.2 Senior Vault Depositors (Conservative Underwriters)

Senior Vault depositors provide the bulk of underwriting capital. They are DeFi-native individuals and DAOs holding large stablecoin positions, currently earning 4–8% on Aave or Morpho, seeking yield enhancement without directional crypto exposure. They receive a fixed 8–12% APY with seniority protection — claims only impact Senior after Junior is fully depleted. The Senior tranche functions as a super-senior credit position analogous to a AAA tranche in structured finance. Target capital: $5M–50M per depositor. Target Senior/Junior ratio: 3:1 to 5:1.

### 7.3 Junior Vault Depositors (Risk-Seeking Underwriters)

Junior Vault depositors provide first-loss capital in exchange for leveraged returns. They are sophisticated DeFi yield farmers, volatility traders, and the protocol's own treasury. They receive residual returns after Senior obligations: 20–50% APY during normal conditions, with potential for capital loss during high-IL periods. In Scenario 1 (low volatility, σ ≈ 40%): Junior earns approximately 29% annualized with a 16% combined ratio. In Scenario 2 (moderate volatility, σ ≈ 70%): approximately 44% annualized at 50% combined ratio. In Scenario 3 (crisis, σ ≈ 120%): Junior absorbs a 33% monthly loss, but Senior remains unaffected. In Scenario 4 (catastrophic, σ ≈ 150%+): Junior is wiped out, Senior absorbs less than 4% loss. Target capital: $1M–10M per depositor.

### 7.4 Protocol Treasuries and DAOs

DAOs with significant stablecoin reserves (Uniswap DAO, Aave DAO, MakerDAO) can participate in either tranche. Their value proposition is ecosystem alignment plus yield: a lending protocol's DAO underwriting IL protection on pools feeding their lending markets creates a vertically integrated risk management stack.

### 7.5 Market Makers and Institutional Funds

Firms already managing LP positions and understanding options pricing can simultaneously LP, buy protection on their own positions, and underwrite protection on other positions — effectively running an IL derivatives book. Their value proposition is alpha generation through superior volatility forecasting: underwrite protection when current IV exceeds their RV forecast and profit when realized volatility comes in below priced volatility.

### 7.6 Reinsurance Providers

Sophisticated underwriters (hedge funds, crypto-native desks like OrBit Markets) provide tail-risk reinsurance to the vault, covering losses beyond a threshold (monthly claims exceeding 200% of monthly premiums). They receive a fixed annual premium (1–3% of reinsured notional) and absorb excess losses. Reinsurance contracts can be structured as smart contracts with oracle-triggered payouts or as OTC agreements. This participation channel is accessible to capital too risk-averse for the Junior tranche but more sophisticated than Senior depositors.

---

## 8. Architecture Outline — Specific Component Usage

### 8.1 Smart Contract Layer

| Contract | Standard | Purpose | Key Dependencies |
|---|---|---|---|
| IL Shield Core | Custom (Solidity 0.8.26) | Position registry, premium streaming, claim settlement | Uniswap v4 PositionManager, Pricing Oracle, Vaults |
| Senior Vault | ERC-4626 (OpenZeppelin implementation) | Fixed-yield stablecoin underwriting, seniority-protected | USDC/USDT/DAI, Aave v3 / Morpho Blue for idle yield |
| Junior Vault | ERC-4626 (OpenZeppelin implementation) | First-loss underwriting, residual yield | USDC/USDT/DAI |
| ILPN Registry | ERC-721 (non-transferable, soulbound-style) | Position-specific protection claims | IL Shield Core |
| Pricing Oracle | Custom (Solidity 0.8.26) | Net IL premium computation, vol feed composition | Chainlink, Pyth, Keeper network |
| IL Shield Hook | BaseHook (v4-periphery) | Native integration for greenfield pools | Uniswap v4 PoolManager |

### 8.2 Oracle and Data Layer

| Component | Selection | Specification |
|---|---|---|
| Price oracle (canonical) | Chainlink Data Feeds | ETH/USD, BTC/USD, major pairs; <1% deviation threshold; <60s heartbeat |
| Price oracle (fallback) | Pyth Network (pull-based) | Activated if Chainlink stale >60 minutes; lower latency, higher throughput |
| On-chain TWAP | v4 hook tickCumulative accumulator | ~5,000–20,000 gas per swap; 30-minute minimum window for settlement |
| Historical data verification | Brevis zkCoprocessor (coChain mode) | 150,000–250,000 gas optimistic; 350,000–550,000 gas ZK fallback; EigenLayer AVS security |
| Complex computation oracle | UMA Optimistic Oracle v3 | $5,000–$10,000 USDC bond; 2-hour liveness; DVM dispute resolution |
| Volatility feed (realized) | Custom Yang-Zhang estimator | Computed from pool swap history; 30-day rolling window; sampled every 100 blocks |
| Volatility feed (implied floor) | Deribit ATM IV via keeper | 30-day ATM IV; updated every 4 hours; 8-hour staleness fallback to 1.2× realized |
| Keeper network | Gelato Network + Chainlink Automation | Redundant; triggers vol updates, settlement assistance, circuit breaker monitoring |

### 8.3 Yield and Liquidity Layer

| Component | Selection | Purpose | Constraints |
|---|---|---|---|
| Senior idle yield | Aave v3 (USDC pool) | Base yield on unallocated Senior reserves | Maximum 25% of vault assets deployed |
| Senior idle yield (secondary) | Morpho Blue (USDC vaults) | Diversified yield source | Maximum 15% of vault assets |
| Reinsurance (on-chain) | Derive (formerly Lyra v2) | OTM ETH put options for tail-risk coverage | Quarterly rolling; notional = 10% of vault AUM |
| Reinsurance (OTC) | OrBit Markets | Custom variance swap / IL protection | Bilateral; for losses exceeding 200% of monthly premiums |
| Stablecoin basket | 60% USDC / 30% USDT / 10% DAI | Mitigates single-issuer depeg risk | Rebalanced quarterly |

### 8.4 Regulatory and Legal Layer

| Component | Selection | Rationale |
|---|---|---|
| Domicile | Bermuda (BMA Insurance Regulatory Sandbox) | Combined insurance expertise + Digital Asset Business Act 2018; Embedded Supervision pilot for DeFi; DAO Working Group |
| Entity structure | Bermuda-domiciled limited company operating sandbox-registered insurtech | Avoids U.S. Howey test exposure; BMA actively accommodating DeFi insurance models |
| Cover token classification | Non-transferable, non-tradeable ERC-721 (soulbound) | Eliminates secondary market that could trigger securities classification; burns on claim or expiry |
| Risk capital KYC | Required for vault depositors (Nexus Mutual NXM-style) | Satisfies BMA requirements; limits regulatory exposure |
| Settlement trigger | Parametric (oracle-verified price divergence) with lightweight proof-of-loss attestation | LP attests position held during coverage period; keeps product on "insurance" side of insurance-vs-derivative line |
| Backup jurisdiction | Cayman Islands (Segregated Portfolio Company) | SPC structure mirrors DeFi pool architecture with legally ring-fenced cells; second-largest captive insurance domicile globally |

### 8.5 Infrastructure Layer

| Component | Selection | Purpose |
|---|---|---|
| L1 deployment | Ethereum mainnet | Maximum security, institutional credibility |
| L2 deployments (primary) | Arbitrum, Base, Unichain | Highest v4 adoption, lowest gas costs; enables retail participation |
| Frontend | React + wagmi/viem | LP registration, premium monitoring, claim submission |
| Subgraph | The Graph (hosted + decentralized) | Position indexing, premium tracking, vault analytics |
| Audit pipeline | OpenZeppelin + Trail of Bits + Spearbit (independent); Code4rena (competitive, $500K+ pot) | Minimum 3 independent audits plus competitive audit |
| Formal verification | Certora Prover | Core IL math and settlement logic; deterministic and bounded — ideal for formal methods |
| Monitoring | OpenZeppelin Defender (Sentinel) | Real-time vault health, utilization alerts, circuit breaker triggers |

### 8.6 Settlement Flow (End-to-End)

The complete settlement sequence for a peripheral-mode position proceeds as follows. The LP closes their Uniswap v4 position via the standard PositionManager. The LP calls `ILShield.settle(ilpnId)`. The Core contract verifies ILPN validity, coverage period, and position closure. The Pricing Oracle queries Chainlink for the settlement price and cross-checks against the pool's 30-minute TWAP. If prices diverge by more than 3%, settlement delays 6 hours and re-evaluates using the median of Chainlink, Pyth, and TWAP. IL is computed on-chain using entry sqrtPriceX96, exit price, tick range, and liquidity amount (approximately 50,000–100,000 gas using Uniswap's native TickMath and SqrtPriceMath libraries). For positions requiring historical data not available in the hook accumulator, the LP (or a keeper) submits a Brevis ZK proof of the historical storage slot values. The claim payout is computed as `min(measuredIL × coverageTier, maxCoverage)` minus a 2% settlement fee. The payout is drawn first from the Junior Vault; only if Junior assets are exhausted does the Senior Vault contribute. The ILPN is burned and `ClaimSettled` is emitted.

---

## 9. What Makes This Different

### 9.1 Five Structural Advantages

**It does not repeat Bancor's mistake.** Collateral is stablecoins, not inflationary native tokens. The underwriting vault's ability to pay claims is independent of crypto market conditions. The tranche structure ensures that even catastrophic events (ETH -60% in 30 days) are absorbed by Junior before Senior is impacted, and Senior losses in the worst modeled scenario are capped at single-digit percentages.

**It does not fragment liquidity.** The peripheral wrapping model allows LPs to stay in the deepest, highest-volume Uniswap pools. IL Shield is a financial overlay, not a competing AMM. LPs do not sacrifice fee income or market depth for protection.

**It prices IL as what it mathematically is: a short options position.** The net IL framework charges only for IL that exceeds fee income — the actual economic loss — rather than the gross divergence loss that fees already partially compensate. This produces premiums that are viable for LPs during normal conditions and meaningful-but-affordable during elevated volatility.

**It verifies data trustlessly.** The three-layer data verification stack (hook accumulator + Brevis ZK + UMA optimistic oracle) eliminates continuous keeper dependency, reduces operating cost by two to three orders of magnitude, and provides cryptographic or crypto-economic security guarantees rather than centralized uptime assumptions.

**It is designed for regulatory clarity.** Non-tradeable cover tokens, parametric triggers with proof-of-loss attestation, Bermuda insurance sandbox domicile, and the complete absence of native token collateral or profit-expectation marketing create maximum distance from securities classification. The Bancor lawsuit's jurisdictional dismissal (without reaching the merits of the Howey analysis) reinforces the importance of non-U.S. domicile for the operating entity.

### 9.2 Remaining Risks

Adverse selection cannot be fully eliminated — only mitigated through the stacked mechanisms described in Section 5.4. Smart contract risk is real, as demonstrated by the Bunni v2 hook exploit ($8.3M, 2025); the audit pipeline and formal verification address but cannot eliminate this risk. Regulatory classification remains jurisdiction-dependent and evolving; the current pro-crypto U.S. posture may not persist. The vault bootstrapping chicken-and-egg problem requires seeded Junior capital ($3–5M from protocol treasury or strategic partners) and subsidized premiums during the first 90 days. Gas economics on Ethereum L1 make the product viable only for positions above approximately $10,000; L2 deployment is critical for broader adoption.
