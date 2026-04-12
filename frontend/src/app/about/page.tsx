"use client";

import { BackgroundOrbs } from "@/components/BackgroundOrbs";
import { NavBar } from "@/components/NavBar";
import { SupportedDexRow } from "@/components/SupportedDexRow";

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

export default function AboutPage() {
  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />
      <div className="relative z-10 flex min-h-screen flex-col">
        <NavBar />
        <main className="flex flex-1 flex-col items-center px-4 pt-10 pb-20">
          <div className="w-full max-w-[720px]">

            <h1 className="mb-3 text-4xl font-semibold tracking-tight text-text1 md:text-[48px] md:leading-[1.1]">
              What is IL Shield?
            </h1>
            <p className="mb-10 text-lg text-text2">
              Parametric impermanent loss protection for concentrated liquidity providers.
            </p>

            {/* ── The Problem ── */}
            <Section title="The problem">
              <Card>
                <p className="text-text2 mb-4">
                  When you provide liquidity on Uniswap, PancakeSwap, SushiSwap, or any AMM, price movements
                  cause your position to be worth less than simply holding the tokens. This is called
                  <span className="text-text1 font-medium"> impermanent loss</span> (IL).
                </p>
                <p className="text-text2 mb-4">
                  For concentrated liquidity positions (Uniswap v3/v4), the effect is amplified. A 20% price
                  move on a concentrated range can cause 5-10x more IL than the same move on a full-range position.
                </p>
                <div className="rounded-xl bg-red-dim p-4">
                  <div className="text-sm font-medium text-red mb-1">The reality</div>
                  <div className="text-sm text-text2">
                    Academic research estimates that over 50% of Uniswap v3 LPs have underperformed a simple
                    buy-and-hold strategy. Fee income often does not compensate for IL during volatile periods.
                  </div>
                </div>
              </Card>
            </Section>

            {/* ── The Solution ── */}
            <Section title="How IL Shield works">
              <div className="space-y-3">
                <Card>
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-dim text-sm font-bold text-pink">1</span>
                    <div>
                      <div className="text-base font-medium text-text1 mb-1">Register your position</div>
                      <div className="text-sm text-text2">
                        Connect your wallet, select your LP position from any supported DEX, choose a coverage
                        tier (50%, 75%, or 100%), and deposit a USDC premium. The premium streams per-block,
                        so you only pay for the time you use.
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-dim text-sm font-bold text-pink">2</span>
                    <div>
                      <div className="text-base font-medium text-text1 mb-1">Keep earning fees normally</div>
                      <div className="text-sm text-text2">
                        Nothing changes about your LP position. You continue earning trading fees on the DEX
                        as usual. IL Shield operates as a peripheral overlay &mdash; it doesn&rsquo;t touch your tokens.
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-dim text-sm font-bold text-pink">3</span>
                    <div>
                      <div className="text-base font-medium text-text1 mb-1">Settle when ready</div>
                      <div className="text-sm text-text2">
                        When you close your LP position or want to claim, IL Shield computes your impermanent loss
                        using the entry price (recorded at registration) vs the exit price (from Chainlink oracle).
                        If IL occurred, you receive a USDC payout. If not, your remaining premium is refunded.
                      </div>
                    </div>
                  </div>
                </Card>

                <Card>
                  <div className="flex items-start gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-dim text-sm font-bold text-green">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="m9 12 2 2 4-4" /></svg>
                    </span>
                    <div>
                      <div className="text-base font-medium text-text1 mb-1">Payout is automatic</div>
                      <div className="text-sm text-text2">
                        USDC lands in your wallet. No claims process, no waiting period, no governance vote.
                        The payout is computed on-chain using the exact Uniswap v3 math (same as the AMM itself)
                        and settled in a single transaction.
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            </Section>

            {/* ── Architecture ── */}
            <Section title="Protocol architecture">
              <Card>
                <div className="space-y-4 text-sm text-text2">
                  <div>
                    <div className="text-base font-medium text-text1 mb-1">Tranched underwriting</div>
                    <p>
                      Claim payouts come from two USDC vaults. The <span className="text-amber font-medium">Junior tranche</span> absorbs
                      losses first (first-loss position, higher yield). The <span className="text-green font-medium">Senior tranche</span> is
                      only drawn after Junior is fully depleted (last-loss, lower yield). This gives conservative depositors
                      protection while rewarding risk-takers.
                    </p>
                  </div>
                  <div>
                    <div className="text-base font-medium text-text1 mb-1">Oracle circuit breaker</div>
                    <p>
                      Settlement uses Chainlink ETH/USD as the price oracle. If Chainlink and the pool&rsquo;s TWAP diverge
                      by more than 3%, settlement is automatically delayed to prevent price manipulation attacks.
                    </p>
                  </div>
                  <div>
                    <div className="text-base font-medium text-text1 mb-1">Multi-DEX adapters</div>
                    <p>
                      A single adapter contract reads position data from any Uniswap v3 fork. One contract serves
                      Uniswap v3, PancakeSwap v3, SushiSwap v3, and Aerodrome &mdash; deployed with different constructor
                      arguments per DEX.
                    </p>
                  </div>
                  <div>
                    <div className="text-base font-medium text-text1 mb-1">Soulbound protection NFTs</div>
                    <p>
                      Each protected position is represented by a non-transferable ERC-721 token (ILPN). This prevents
                      secondary market speculation on protection contracts and ensures only the position owner can settle.
                    </p>
                  </div>
                </div>
              </Card>
            </Section>

            {/* ── Coverage Tiers ── */}
            <Section title="Coverage tiers">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { tier: "50%", desc: "Covers half your IL. Lowest premium.", color: "text-text2" },
                  { tier: "75%", desc: "Covers three-quarters. Balanced choice.", color: "text-pink" },
                  { tier: "100%", desc: "Full IL coverage. Maximum protection.", color: "text-green" },
                ].map((t) => (
                  <Card key={t.tier} className="text-center">
                    <div className={`text-2xl font-bold ${t.color} mb-1`}>{t.tier}</div>
                    <div className="text-[12px] text-text3">{t.desc}</div>
                  </Card>
                ))}
              </div>
            </Section>

            {/* ── Supported DEXs ── */}
            <Section title="Supported DEXs">
              <Card className="flex justify-center py-6">
                <SupportedDexRow />
              </Card>
            </Section>

            {/* ── Security ── */}
            <Section title="Security">
              <Card>
                <div className="space-y-3 text-sm text-text2">
                  <p>252 automated tests (168 CI + 84 fork), 0 failures. ILMath fuzz-tested against a Python reference implementation for 10,000 runs.</p>
                  <p>Reentrancy guards on all state-mutating functions. ERC-4626 inflation attack defense via virtual share offset. Flash loan protection through TWAP + Chainlink oracle composition.</p>
                  <p>All governance parameter changes are timelock-protected (48 hours minimum on mainnet). Emergency pause available for immediate response.</p>
                </div>
              </Card>
            </Section>

          </div>
        </main>
      </div>
    </div>
  );
}
