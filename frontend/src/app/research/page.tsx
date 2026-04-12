"use client";

import { BackgroundOrbs } from "@/components/BackgroundOrbs";
import { NavBar } from "@/components/NavBar";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-10">
      <h2 className="text-2xl font-semibold text-text1 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-card-border bg-card p-5 ${className}`}>
      {children}
    </div>
  );
}

function Formula({ label, formula, explanation }: { label: string; formula: string; explanation: string }) {
  return (
    <div className="rounded-xl bg-input p-4 mb-3">
      <div className="text-[12px] text-text3 font-medium mb-2">{label}</div>
      <div className="font-mono text-sm text-pink mb-2">{formula}</div>
      <div className="text-[12px] text-text2">{explanation}</div>
    </div>
  );
}

export default function ResearchPage() {
  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />
      <div className="relative z-10 flex min-h-screen flex-col">
        <NavBar />
        <main className="flex flex-1 flex-col items-center px-4 pt-10 pb-20">
          <div className="w-full max-w-[720px]">

            <h1 className="mb-3 text-4xl font-semibold tracking-tight text-text1 md:text-[48px] md:leading-[1.1]">
              The Model
            </h1>
            <p className="mb-10 text-lg text-text2">
              IL Shield&rsquo;s pricing model, IL computation, and risk framework.
            </p>

            {/* ── IL Math ── */}
            <Section title="Impermanent loss computation">
              <Card>
                <p className="text-sm text-text2 mb-4">
                  IL is computed using the exact Uniswap v3 concentrated liquidity math. This is a 1:1 port
                  of the on-chain <code className="text-pink text-[12px]">ILMath.sol</code> library, fuzz-tested against
                  a Python reference implementation across 10,000 random inputs.
                </p>

                <Formula
                  label="Step 1: Position amounts at entry"
                  formula="(x₀, y₀) = positionAmounts(sqrtPrice_entry, tickLower, tickUpper, L)"
                  explanation="Compute token0 and token1 amounts using the Uniswap getAmount0/getAmount1 formulas. Handles three cases: price below range (100% token0), above range (100% token1), or within range (both tokens)."
                />

                <Formula
                  label="Step 2: LP value at exit"
                  formula="LP_value = positionValue(sqrtPrice_exit, tickLower, tickUpper, L)"
                  explanation="The AMM has auto-rebalanced the position as price moved. Compute new token amounts at exit price, value them in token1 terms."
                />

                <Formula
                  label="Step 3: HODL value at exit"
                  formula="HODL_value = x₀ × P_exit + y₀"
                  explanation="What the initial amounts would be worth if you had simply held them without LPing."
                />

                <Formula
                  label="Step 4: Impermanent loss"
                  formula="IL = max(0, HODL_value − LP_value)"
                  explanation="The difference between holding and LPing. Always non-negative — the AMM auto-rebalancing always costs the LP relative to holding."
                />

                <div className="rounded-xl bg-card p-4 text-[12px] text-text3">
                  <div className="font-medium text-text2 mb-1">Key math operations</div>
                  <div className="space-y-1 font-mono">
                    <div>amount0 = L × 2⁹⁶ × (√P_b − √P) / (√P_b × √P)</div>
                    <div>amount1 = L × (√P − √P_a) / 2⁹⁶</div>
                    <div>token0_value = amount0 × (sqrtPrice)² / 2¹⁹²</div>
                  </div>
                  <div className="mt-2 text-text3">
                    All computed using BigInt Q96 fixed-point arithmetic to match Solidity precision.
                  </div>
                </div>
              </Card>
            </Section>

            {/* ── Premium Model ── */}
            <Section title="Premium pricing model">
              <Card>
                <p className="text-sm text-text2 mb-4">
                  The premium is based on the <span className="text-text1 font-medium">Net IL framework</span>: the expected
                  cost of IL after subtracting the expected fee income. LPs only pay for the residual risk that fees don&rsquo;t cover.
                </p>

                <Formula
                  label="Expected gross IL per block"
                  formula="E[GrossIL] = (σ² / 8) × C(R) / blocks_per_year"
                  explanation="σ = annualized volatility, C(R) = concentration factor from tick range width. Derived from the variance of geometric Brownian motion applied to the concentrated liquidity position."
                />

                <Formula
                  label="Expected fee income per block"
                  formula="E[FeeIncome] = feeRate × expectedVolume / liquidity"
                  explanation="The LP's share of trading fees based on pool volume and their liquidity contribution. Offsets IL risk."
                />

                <Formula
                  label="Net IL premium"
                  formula="NetIL = max(0, GrossIL − FeeIncome)"
                  explanation="If fee income exceeds expected IL, the premium is zero — the LP is already net positive. This is the key insight: LPs in high-volume pools with low volatility may not need protection."
                />

                <Formula
                  label="Final premium rate"
                  formula="Rate = NetIL × RiskLoading × TierMultiplier × UtilizationCurve × C-Level"
                  explanation="The net IL is then scaled by risk loading (1.4x base + volatility slope), coverage tier (50/75/100%), vault utilization (kinked curve), and the C-level repricing coefficient."
                />
              </Card>
            </Section>

            {/* ── Risk Loading ── */}
            <Section title="Risk loading">
              <Card>
                <Formula
                  label="Risk loading formula"
                  formula="RL = 1.40 + max(0, (σ − 0.50) × 0.80)"
                  explanation="Base loading of 1.4x on all premiums. Above 50% volatility, an additional 0.8x per unit of excess vol is added. At 70% vol: RL = 1.40 + (0.20 × 0.80) = 1.56x."
                />
                <div className="text-sm text-text2">
                  The risk loading accounts for model uncertainty, adverse selection risk, and tail events
                  that the base variance formula doesn&rsquo;t capture. It ensures the protocol remains solvent
                  even when realized vol exceeds the model&rsquo;s expectation.
                </div>
              </Card>
            </Section>

            {/* ── Utilization Curve ── */}
            <Section title="Utilization curve">
              <Card>
                <p className="text-sm text-text2 mb-4">
                  Premium pricing responds to vault utilization via a kinked curve, similar to Aave&rsquo;s
                  interest rate model. This ensures premiums rise steeply when vault capacity is constrained.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl bg-input p-3 text-center">
                    <div className="text-lg font-bold text-green">1.0x</div>
                    <div className="text-[12px] text-text3">0–40% utilization</div>
                    <div className="text-[11px] text-text3">Flat — no surcharge</div>
                  </div>
                  <div className="rounded-xl bg-input p-3 text-center">
                    <div className="text-lg font-bold text-amber">1.0–2.0x</div>
                    <div className="text-[12px] text-text3">40–75% utilization</div>
                    <div className="text-[11px] text-text3">Linear increase</div>
                  </div>
                  <div className="rounded-xl bg-input p-3 text-center">
                    <div className="text-lg font-bold text-red">2.0–12.0x</div>
                    <div className="text-[12px] text-text3">75–100% utilization</div>
                    <div className="text-[11px] text-text3">Exponential surge</div>
                  </div>
                </div>
                <Formula
                  label="Exponential region (>75%)"
                  formula="Multiplier = 2.0 + 10 × ((util − 0.75) / 0.25)²"
                  explanation="At 100% utilization, the multiplier reaches 12x, effectively halting new registrations by making premiums prohibitively expensive."
                />
              </Card>
            </Section>

            {/* ── Concentration Factor ── */}
            <Section title="Concentration factor">
              <Card>
                <p className="text-sm text-text2 mb-4">
                  Concentrated liquidity positions experience amplified IL compared to full-range positions.
                  The concentration factor C(R) quantifies this amplification based on the tick range width.
                </p>
                <Formula
                  label="Concentration factor"
                  formula="C(R) = f(tickUpper − tickLower)"
                  explanation="Narrower tick ranges have higher concentration factors, resulting in higher premiums. A ±600 tick range (±6% price range) has ~25x more IL exposure than a full-range position at the same price move."
                />
                <div className="text-sm text-text2">
                  This is why concentrated LPs are the primary audience for IL Shield &mdash; their IL risk
                  is dramatically higher than full-range LPs, and the protection is correspondingly more valuable.
                </div>
              </Card>
            </Section>

            {/* ── Tranche Waterfall ── */}
            <Section title="Tranche waterfall">
              <Card>
                <p className="text-sm text-text2 mb-4">
                  When an LP settles a claim, the payout flows through the tranche waterfall:
                </p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-dim text-[12px] font-bold text-amber">1</span>
                    <div className="text-sm text-text2">
                      <span className="text-text1 font-medium">Junior tranche absorbs first.</span> Up to the full Junior vault balance
                      is drawn to pay claims. Junior depositors bear the first-loss risk.
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-dim text-[12px] font-bold text-green">2</span>
                    <div className="text-sm text-text2">
                      <span className="text-text1 font-medium">Senior tranche is only drawn if Junior is depleted.</span> Senior
                      depositors are protected by the Junior buffer. In normal market conditions, Senior is never touched.
                    </div>
                  </div>
                </div>
                <div className="mt-4 rounded-xl bg-input p-4 text-[12px]">
                  <div className="font-medium text-text2 mb-2">Premium distribution</div>
                  <div className="space-y-1">
                    <div className="flex justify-between"><span className="text-text3">Senior vault</span><span className="font-mono text-text1">70%</span></div>
                    <div className="flex justify-between"><span className="text-text3">Junior vault</span><span className="font-mono text-text1">15%</span></div>
                    <div className="flex justify-between"><span className="text-text3">Treasury</span><span className="font-mono text-text1">10%</span></div>
                    <div className="flex justify-between"><span className="text-text3">Referrer (or treasury)</span><span className="font-mono text-text1">5%</span></div>
                  </div>
                </div>
              </Card>
            </Section>

            {/* ── Anti-Selection ── */}
            <Section title="Anti-adverse selection">
              <Card>
                <p className="text-sm text-text2 mb-4">
                  Four mechanisms prevent LPs from gaming the system by buying protection only when they
                  know IL is about to occur:
                </p>
                <div className="space-y-3 text-sm text-text2">
                  <div>
                    <span className="text-text1 font-medium">Warming period.</span> Coverage doesn&rsquo;t start until 10 blocks
                    after registration (48 hours on mainnet). Same-block register-and-settle is impossible.
                  </div>
                  <div>
                    <span className="text-text1 font-medium">Coverage ramp.</span> Payout scales linearly from 0% to 100%
                    over 50 blocks (7 days on mainnet). Early settlement receives reduced coverage.
                  </div>
                  <div>
                    <span className="text-text1 font-medium">Streaming premium.</span> Premium is deducted per-block, not
                    paid upfront as a lump sum. LPs pay for each block of coverage they consume.
                  </div>
                  <div>
                    <span className="text-text1 font-medium">C-level repricing.</span> The protocol can adjust the C-level
                    coefficient to increase premiums if the combined ratio (claims/premiums) exceeds 100%.
                  </div>
                </div>
              </Card>
            </Section>

            {/* ── Verification ── */}
            <Section title="Verification and testing">
              <Card>
                <div className="space-y-3 text-sm text-text2">
                  <p>
                    The IL computation is fuzz-tested against a Python reference implementation
                    (<code className="text-pink text-[12px]">il_math_reference.py</code>) for 10,000 random inputs spanning
                    the full sqrtPriceX96 domain. All runs match to within 1 wei.
                  </p>
                  <p>
                    The premium formula has 4 property tests verified across 40,000 fuzz runs: monotonicity
                    in volatility, monotonicity in concentration, zero premium when fees exceed IL, and
                    convergence to gross IL when fees are zero.
                  </p>
                  <p>
                    Vault solvency is verified via 1,000 invariant test runs with 50,000 random handler calls
                    across deposits, withdrawals, premium distributions, and claim settlements.
                  </p>
                  <div className="rounded-xl bg-input p-3 font-mono text-[12px]">
                    <div>Total tests: 252 (168 CI + 84 fork)</div>
                    <div>Fuzz runs: 50,000</div>
                    <div>Invariant calls: 50,000</div>
                    <div>Failures: 0</div>
                    <div>ILShieldCore branch coverage: 97.06%</div>
                  </div>
                </div>
              </Card>
            </Section>

          </div>
        </main>
      </div>
    </div>
  );
}
