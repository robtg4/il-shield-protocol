"use client";

import { motion } from "framer-motion";
import Link from "next/link";

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
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-6 text-center">
      <div className="font-mono text-3xl font-bold text-white mb-1">{value}</div>
      <div className="text-sm text-[#8b8fa3]">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-white/5 bg-[#0a0e1a]/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#3b82f6]">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
            </div>
            <span className="text-[17px] font-semibold">IL Shield</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#8b8fa3]">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/research" className="hover:text-white transition-colors">Research</Link>
            <Link href="/protect" className="rounded-full bg-[#3b82f6] px-4 py-2 text-white font-medium hover:bg-[#2563eb] transition-colors">
              Launch App
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <Section className="pt-24 pb-20 text-center">
        <motion.div variants={fadeUp}>
          <div className="inline-flex items-center gap-2 rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 px-4 py-1.5 text-sm text-[#3b82f6] mb-6">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Live on Ethereum Sepolia
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 leading-[1.1]">
            Insurance for<br />
            <span className="text-[#3b82f6]">Uniswap LPs</span>
          </h1>
          <p className="text-lg md:text-xl text-[#8b8fa3] max-w-[600px] mx-auto mb-10">
            Pay a streaming premium. Get paid when impermanent loss exceeds your fee income. No tokens. No alchemy. Just math.
          </p>
          <div className="flex items-center justify-center gap-4 mb-12">
            <Link href="/protect" className="rounded-full bg-[#3b82f6] px-6 py-3 text-base font-semibold text-white hover:bg-[#2563eb] transition-colors">
              Try on Testnet
            </Link>
            <Link href="/research" className="rounded-full border border-white/10 px-6 py-3 text-base font-semibold text-[#8b8fa3] hover:text-white hover:border-white/20 transition-colors">
              Read the Docs
            </Link>
          </div>
          <div className="grid grid-cols-3 gap-4 max-w-[500px] mx-auto">
            <div className="text-center">
              <div className="font-mono text-2xl font-bold text-white">$1.5-3B</div>
              <div className="text-[12px] text-[#8b8fa3]">Annual IL losses</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-2xl font-bold text-white">252</div>
              <div className="text-[12px] text-[#8b8fa3]">Tests passing</div>
            </div>
            <div className="text-center">
              <div className="font-mono text-2xl font-bold text-white">5</div>
              <div className="text-[12px] text-[#8b8fa3]">DEXs supported</div>
            </div>
          </div>
        </motion.div>
      </Section>

      {/* The Problem */}
      <Section className="py-20">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-3">The IL Tax</h2>
          <p className="text-[#8b8fa3] max-w-[500px] mx-auto">LPs are losing billions. Concentrated liquidity makes it worse.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard value="$1.5-3B" label="Annual IL losses on Uniswap" />
          <StatCard value="60%" label="of non-stablecoin LP positions end unprofitable" />
          <StatCard value="5-8x" label="IL amplification from concentrated liquidity" />
        </div>
        <p className="text-sm text-[#8b8fa3] text-center max-w-[650px] mx-auto">
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
            <div key={s.step} className="rounded-2xl border border-white/5 bg-white/[0.02] p-6">
              <div className="text-[#3b82f6] font-mono text-sm font-bold mb-3">{s.step}</div>
              <div className="text-base font-semibold mb-2">{s.title}</div>
              <div className="text-sm text-[#8b8fa3]">{s.desc}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* Why It Works */}
      <Section className="py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">Insurance, Not Alchemy</h2>
        <p className="text-[#8b8fa3] text-center mb-12 max-w-[500px] mx-auto">Why previous approaches failed and how IL Shield is different.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
            <div className="text-red-400 text-sm font-bold mb-2">Bancor v3 &#x2717;</div>
            <div className="text-base font-semibold mb-2">Token-backed claims</div>
            <div className="text-sm text-[#8b8fa3]">Minted BNT tokens to pay claims. Token crashed when the market crashed. Couldn&rsquo;t pay when it mattered most. Protocol lost $200M+.</div>
          </div>
          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6">
            <div className="text-amber-400 text-sm font-bold mb-2">Active Management &#x26A0;</div>
            <div className="text-base font-semibold mb-2">Reduce but can&rsquo;t eliminate</div>
            <div className="text-sm text-[#8b8fa3]">Gamma, Arrakis, Charm reduce IL 30-50% by rebalancing. Fails in trending markets. Doesn&rsquo;t protect the remaining 50-70%.</div>
          </div>
          <div className="rounded-2xl border border-[#3b82f6]/30 bg-[#3b82f6]/5 p-6">
            <div className="text-[#3b82f6] text-sm font-bold mb-2">IL Shield &#x2713;</div>
            <div className="text-base font-semibold mb-2">Stablecoin collateral</div>
            <div className="text-sm text-[#8b8fa3]">USDC vault solvency is uncorrelated with the market crashes that trigger claims. Actuarial pricing. Tranched risk. Boring works.</div>
          </div>
        </div>
      </Section>

      {/* Two Audiences */}
      <Section className="py-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8">
            <div className="text-[#3b82f6] text-sm font-bold mb-4">For LPs</div>
            <h3 className="text-2xl font-bold mb-4">Protect your positions</h3>
            <ul className="space-y-3 text-sm text-[#8b8fa3] mb-6">
              <li className="flex items-start gap-2"><span className="text-[#3b82f6] mt-0.5">&#x2713;</span> Streaming USDC premiums — pay per block</li>
              <li className="flex items-start gap-2"><span className="text-[#3b82f6] mt-0.5">&#x2713;</span> Automatic settlement — USDC in your wallet</li>
              <li className="flex items-start gap-2"><span className="text-[#3b82f6] mt-0.5">&#x2713;</span> Works with Uniswap v3, v4, PancakeSwap, SushiSwap</li>
              <li className="flex items-start gap-2"><span className="text-[#3b82f6] mt-0.5">&#x2713;</span> Cancel anytime — unused premium refunded</li>
            </ul>
            <Link href="/protect" className="inline-block rounded-full bg-[#3b82f6] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#2563eb] transition-colors">
              Protect a Position &rarr;
            </Link>
          </div>
          <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8">
            <div className="text-[#f59e0b] text-sm font-bold mb-4">For Yield Seekers</div>
            <h3 className="text-2xl font-bold mb-4">Earn yield by underwriting LP risk</h3>
            <ul className="space-y-3 text-sm text-[#8b8fa3] mb-6">
              <li className="flex items-start gap-2"><span className="text-[#f59e0b] mt-0.5">&#x2713;</span> Senior Vault: 8-12% APY (last-loss, ultra-safe)</li>
              <li className="flex items-start gap-2"><span className="text-[#f59e0b] mt-0.5">&#x2713;</span> Junior Vault: 20-50% APY (first-loss, higher reward)</li>
              <li className="flex items-start gap-2"><span className="text-[#f59e0b] mt-0.5">&#x2713;</span> Stablecoin deposits — no directional exposure</li>
              <li className="flex items-start gap-2"><span className="text-[#f59e0b] mt-0.5">&#x2713;</span> Premium income streams to you per block</li>
            </ul>
            <Link href="/vaults" className="inline-block rounded-full border border-[#f59e0b]/30 px-5 py-2.5 text-sm font-semibold text-[#f59e0b] hover:bg-[#f59e0b]/10 transition-colors">
              Deposit to Vault &rarr;
            </Link>
          </div>
        </div>
      </Section>

      {/* Architecture */}
      <Section className="py-20">
        <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">Architecture</h2>
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-8 font-mono text-sm text-[#8b8fa3] text-center mb-8 overflow-x-auto">
          <pre className="inline-block text-left">{`┌─────────────────────────────────────────────────────────┐
│                    ILShieldCore                          │
│         Registration · Streaming · Settlement            │
├──────────┬──────────┬──────────────┬───────────────┬─────┤
│ Senior   │ Junior   │ ILPN         │ Pricing       │Hook │
│ Vault    │ Vault    │ Registry     │ Oracle        │(v4) │
│ ERC-4626 │ ERC-4626 │ ERC-721      │ Chainlink+    │     │
│ Last-loss│ 1st-loss │ Soulbound    │ TWAP+Vol      │     │
└──────────┴──────────┴──────────────┴───────────────┴─────┘
           ↑                         ↑
    Vault depositors            Chainlink feeds
    earn premium yield          anchor settlement`}</pre>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { icon: "🧪", label: "252 tests passing", sub: "Unit, integration, adversarial, invariant, fork" },
            { icon: "🔗", label: "Chainlink + TWAP oracles", sub: "3% divergence circuit breaker" },
            { icon: "🏦", label: "ERC-4626 vaults", sub: "Standard yield-bearing vault interface" },
            { icon: "🎫", label: "Soulbound ERC-721", sub: "Non-transferable protection NFTs" },
            { icon: "⚡", label: "Uniswap v4 hook", sub: "Optional atomic in-pool protection" },
            { icon: "🔌", label: "Multi-DEX adapters", sub: "Uni v3, PancakeSwap, SushiSwap, Aerodrome" },
          ].map((f) => (
            <div key={f.label} className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.01] p-4">
              <span className="text-lg">{f.icon}</span>
              <div>
                <div className="text-sm font-medium text-white">{f.label}</div>
                <div className="text-[12px] text-[#8b8fa3]">{f.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* Backed By */}
      <Section className="py-20">
        <h2 className="text-2xl font-bold text-center mb-8">Built With</h2>
        <div className="flex items-center justify-center gap-10 flex-wrap text-[#8b8fa3]">
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">&#x26D3;</div>
            <span className="text-[12px]">Chainlink Oracles</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">&#x1F984;</div>
            <span className="text-[12px]">Uniswap v3/v4</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">&#x1F3D7;</div>
            <span className="text-[12px]">OpenZeppelin</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/5 text-xl">&#x1F525;</div>
            <span className="text-[12px]">Foundry</span>
          </div>
        </div>
      </Section>

      {/* CTA */}
      <Section className="py-24 text-center">
        <h2 className="text-3xl md:text-4xl font-bold mb-4">Protect your first position</h2>
        <p className="text-[#8b8fa3] mb-8">Live on Ethereum Sepolia. No mainnet funds required.</p>
        <div className="flex items-center justify-center gap-4 mb-6">
          <Link href="/protect" className="rounded-full bg-[#3b82f6] px-6 py-3 text-base font-semibold text-white hover:bg-[#2563eb] transition-colors">
            Launch App
          </Link>
          <Link href="https://github.com/robtg4/il-shield-protocol" target="_blank" className="rounded-full border border-white/10 px-6 py-3 text-base font-semibold text-[#8b8fa3] hover:text-white transition-colors">
            GitHub
          </Link>
        </div>
        <p className="text-[12px] text-[#8b8fa3]">No token. No airdrop. Just protection.</p>
      </Section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-8">
        <div className="mx-auto max-w-[1100px] px-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-[#8b8fa3]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            IL Shield Protocol
          </div>
          <div className="flex items-center gap-6 text-sm text-[#8b8fa3]">
            <Link href="/about" className="hover:text-white transition-colors">About</Link>
            <Link href="/research" className="hover:text-white transition-colors">Research</Link>
            <Link href="https://github.com/robtg4/il-shield-protocol" target="_blank" className="hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
