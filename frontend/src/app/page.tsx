"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";
import { BackgroundOrbs } from "@/components/BackgroundOrbs";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};

function Section({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={fadeUp}
      className={`w-full max-w-[1100px] mx-auto px-5 ${className}`}
    >
      {children}
    </motion.section>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-2xl border border-card-border bg-card p-6 text-center">
      <div className="font-mono text-3xl font-bold text-text1 mb-1">{value}</div>
      <div className="text-sm text-text3">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen bg-bg text-text1">
      <BackgroundOrbs />
      <div className="relative z-10">
        <NavBar />

        {/* Hero */}
        <Section className="pt-20 pb-20 text-center">
          <motion.div variants={fadeUp}>
            <div className="inline-flex items-center gap-2 rounded-full border border-pink/30 bg-pink-dim px-4 py-1.5 text-sm text-pink mb-6">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Live on Ethereum Sepolia
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
              Insurance for<br />
              <span className="text-pink">Uniswap LPs</span>
            </h1>
            <p className="text-lg md:text-xl text-text2 max-w-[600px] mx-auto mb-10">
              Pay a streaming premium. Get paid when impermanent loss exceeds your fee income. No tokens. No alchemy. Just math.
            </p>
            <div className="flex items-center justify-center gap-4 mb-12">
              <Link href="/protect" className="rounded-[20px] bg-pink-cta px-6 py-3 text-base font-semibold text-pink-cta-text hover:brightness-110 transition-all">
                Try on Testnet
              </Link>
              <Link href="/research" className="rounded-[20px] border border-card-border px-6 py-3 text-base font-semibold text-text2 hover:text-text1 hover:border-text3 transition-all">
                Read the Docs
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-4 max-w-[500px] mx-auto">
              <div className="text-center">
                <div className="font-mono text-2xl font-bold text-text1">$1.5-3B</div>
                <div className="text-[12px] text-text3">Annual IL losses</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-2xl font-bold text-text1">252</div>
                <div className="text-[12px] text-text3">Tests passing</div>
              </div>
              <div className="text-center">
                <div className="font-mono text-2xl font-bold text-text1">5</div>
                <div className="text-[12px] text-text3">DEXs supported</div>
              </div>
            </div>
          </motion.div>
        </Section>

        {/* The Problem */}
        <Section className="py-20">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-3">The IL Tax</h2>
            <p className="text-text2 max-w-[500px] mx-auto">LPs are losing billions. Concentrated liquidity makes it worse.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard value="$1.5-3B" label="Annual IL losses on Uniswap" />
            <StatCard value="60%" label="of non-stablecoin LP positions end unprofitable" />
            <StatCard value="5-8x" label="IL amplification from concentrated liquidity" />
          </div>
          <p className="text-sm text-text3 text-center max-w-[650px] mx-auto">
            Impermanent loss is the largest unsolved risk in DeFi. Previous solutions either collapsed under their own tokenomics (Bancor) or require options expertise most LPs don&rsquo;t have (Panoptic). LPs deserve something simpler.
          </p>
        </Section>

        {/* How It Works */}
        <Section className="py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">How It Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[
              { step: "01", title: "Provide Liquidity", desc: "LP on any Uniswap v3/v4 pool as normal. Nothing changes about your position." },
              { step: "02", title: "Activate Protection", desc: "Register your position with IL Shield. Select coverage tier. One transaction." },
              { step: "03", title: "Stream Premium", desc: "Small USDC premium deducted per block. Scales with position size. Cancel anytime." },
              { step: "04", title: "Get Protected", desc: "If IL exceeds fee income when you close, you get paid automatically from underwriting vaults." },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-card-border bg-card p-6">
                <div className="text-pink font-mono text-sm font-bold mb-3">{s.step}</div>
                <div className="text-base font-semibold text-text1 mb-2">{s.title}</div>
                <div className="text-sm text-text2">{s.desc}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Why It Works */}
        <Section className="py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Insurance, Not Alchemy</h2>
          <p className="text-text2 text-center mb-12 max-w-[500px] mx-auto">Why previous approaches failed and how IL Shield is different.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-red/20 bg-red-dim p-6">
              <div className="text-red text-sm font-bold mb-2">Bancor v3 &#x2717;</div>
              <div className="text-base font-semibold text-text1 mb-2">Token-backed claims</div>
              <div className="text-sm text-text2">Minted BNT tokens to pay claims. Token crashed when the market crashed. Couldn&rsquo;t pay when it mattered most.</div>
            </div>
            <div className="rounded-2xl border border-amber/20 bg-amber-dim p-6">
              <div className="text-amber text-sm font-bold mb-2">Active Management &#x26A0;</div>
              <div className="text-base font-semibold text-text1 mb-2">Reduce but can&rsquo;t eliminate</div>
              <div className="text-sm text-text2">Gamma, Arrakis, Charm reduce IL 30-50% by rebalancing. Fails in trending markets. Doesn&rsquo;t protect the remaining 50-70%.</div>
            </div>
            <div className="rounded-2xl border border-pink/30 bg-pink-dim p-6">
              <div className="text-pink text-sm font-bold mb-2">IL Shield &#x2713;</div>
              <div className="text-base font-semibold text-text1 mb-2">Stablecoin collateral</div>
              <div className="text-sm text-text2">USDC vault solvency is uncorrelated with the market crashes that trigger claims. Actuarial pricing. Tranched risk. Boring works.</div>
            </div>
          </div>
        </Section>

        {/* Two Audiences */}
        <Section className="py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl border border-card-border bg-card p-8">
              <div className="text-pink text-sm font-bold mb-4">For LPs</div>
              <h3 className="text-2xl font-bold text-text1 mb-4">Protect your positions</h3>
              <ul className="space-y-3 text-sm text-text2 mb-6">
                <li className="flex items-start gap-2"><span className="text-pink mt-0.5">&#x2713;</span> Streaming USDC premiums &mdash; pay per block</li>
                <li className="flex items-start gap-2"><span className="text-pink mt-0.5">&#x2713;</span> Automatic settlement &mdash; USDC in your wallet</li>
                <li className="flex items-start gap-2"><span className="text-pink mt-0.5">&#x2713;</span> Works with Uniswap v3, v4, PancakeSwap, SushiSwap</li>
                <li className="flex items-start gap-2"><span className="text-pink mt-0.5">&#x2713;</span> Cancel anytime &mdash; unused premium refunded</li>
              </ul>
              <Link href="/protect" className="inline-block rounded-[20px] bg-pink-cta px-5 py-2.5 text-sm font-semibold text-pink-cta-text hover:brightness-110 transition-all">
                Protect a Position &rarr;
              </Link>
            </div>
            <div className="rounded-2xl border border-card-border bg-card p-8">
              <div className="text-amber text-sm font-bold mb-4">For Yield Seekers</div>
              <h3 className="text-2xl font-bold text-text1 mb-4">Earn yield by underwriting LP risk</h3>
              <ul className="space-y-3 text-sm text-text2 mb-6">
                <li className="flex items-start gap-2"><span className="text-amber mt-0.5">&#x2713;</span> Senior Vault: 8-12% APY (last-loss, ultra-safe)</li>
                <li className="flex items-start gap-2"><span className="text-amber mt-0.5">&#x2713;</span> Junior Vault: 20-50% APY (first-loss, higher reward)</li>
                <li className="flex items-start gap-2"><span className="text-amber mt-0.5">&#x2713;</span> Stablecoin deposits &mdash; no directional exposure</li>
                <li className="flex items-start gap-2"><span className="text-amber mt-0.5">&#x2713;</span> Premium income streams to you per block</li>
              </ul>
              <Link href="/vaults" className="inline-block rounded-[20px] border border-amber/30 px-5 py-2.5 text-sm font-semibold text-amber hover:bg-amber-dim transition-all">
                Deposit to Vault &rarr;
              </Link>
            </div>
          </div>
        </Section>

        {/* Architecture */}
        <Section className="py-20">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Architecture</h2>
          <div className="rounded-2xl border border-card-border bg-card p-8 font-mono text-sm text-text3 text-center mb-8 overflow-x-auto">
            <pre className="inline-block text-left">{`┌─────────────────────────────────────────────────────────┐
│                    ILShieldCore                          │
│         Registration · Streaming · Settlement            │
├──────────┬──────────┬──────────────┬───────────────┬─────┤
│ Senior   │ Junior   │ ILPN         │ Pricing       │Hook │
│ Vault    │ Vault    │ Registry     │ Oracle        │(v4) │
│ ERC-4626 │ ERC-4626 │ ERC-721      │ Chainlink+    │     │
│ Last-loss│ 1st-loss │ Soulbound    │ TWAP+Vol      │     │
└──────────┴──────────┴──────────────┴───────────────┴─────┘`}</pre>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {[
              { label: "252 tests passing", sub: "Unit, integration, adversarial, invariant, fork" },
              { label: "Chainlink + TWAP oracles", sub: "3% divergence circuit breaker" },
              { label: "ERC-4626 vaults", sub: "Standard yield-bearing vault interface" },
              { label: "Soulbound ERC-721", sub: "Non-transferable protection NFTs" },
              { label: "Uniswap v4 hook", sub: "Optional atomic in-pool protection" },
              { label: "Multi-DEX adapters", sub: "Uni v3, PancakeSwap, SushiSwap, Aerodrome" },
            ].map((f) => (
              <div key={f.label} className="flex items-start gap-3 rounded-xl border border-card-border bg-input p-4">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-dim">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m9 12 2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm font-medium text-text1">{f.label}</div>
                  <div className="text-[12px] text-text3">{f.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </Section>

        {/* CTA */}
        <Section className="py-24 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Protect your first position</h2>
          <p className="text-text2 mb-8">Live on Ethereum Sepolia. No mainnet funds required.</p>
          <div className="flex items-center justify-center gap-4 mb-6">
            <Link href="/protect" className="rounded-[20px] bg-pink-cta px-6 py-3 text-base font-semibold text-pink-cta-text hover:brightness-110 transition-all">
              Launch App
            </Link>
            <Link href="https://github.com/robtg4/il-shield-protocol" target="_blank" className="rounded-[20px] border border-card-border px-6 py-3 text-base font-semibold text-text2 hover:text-text1 transition-all">
              GitHub
            </Link>
          </div>
          <p className="text-[12px] text-text3">No token. No airdrop. Just protection.</p>
        </Section>

        {/* Footer */}
        <footer className="border-t border-card-border py-8">
          <div className="mx-auto max-w-[1100px] px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-sm text-text3">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              IL Shield Protocol
            </div>
            <div className="flex items-center gap-6 text-sm text-text3">
              <Link href="/about" className="hover:text-text1 transition-colors">About</Link>
              <Link href="/research" className="hover:text-text1 transition-colors">Research</Link>
              <Link href="https://github.com/robtg4/il-shield-protocol" target="_blank" className="hover:text-text1 transition-colors">GitHub</Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
