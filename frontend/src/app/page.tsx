"use client";

import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";

const fadeIn = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

function FloatingShield({ className = "" }: { className?: string }) {
  return (
    <motion.div
      className={`absolute ${className}`}
      animate={{ y: [0, -12, 0], rotate: [0, 3, -3, 0] }}
      transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-pink/10 backdrop-blur-sm border border-pink/20">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      </div>
    </motion.div>
  );
}

function GlowOrb({ className = "", color = "pink" }: { className?: string; color?: string }) {
  const colors: Record<string, string> = {
    pink: "bg-pink/20",
    green: "bg-green/15",
    amber: "bg-amber/10",
  };
  return (
    <motion.div
      className={`absolute rounded-full blur-[100px] ${colors[color]} ${className}`}
      animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
  );
}

export default function LandingPage() {
  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ["start start", "end start"] });
  const heroOpacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);
  const heroScale = useTransform(scrollYProgress, [0, 0.5], [1, 0.95]);

  return (
    <div className="min-h-screen bg-bg text-text1 overflow-hidden">
      <NavBar />

      {/* ── HERO ── */}
      <motion.section
        ref={heroRef}
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="relative flex min-h-[90vh] flex-col items-center justify-center px-5 text-center"
      >
        {/* Ambient glow */}
        <GlowOrb className="w-[500px] h-[500px] -top-20 left-1/2 -translate-x-1/2" color="pink" />
        <GlowOrb className="w-[300px] h-[300px] top-40 -left-20" color="green" />
        <GlowOrb className="w-[250px] h-[250px] top-60 -right-10" color="amber" />

        {/* Floating shields */}
        <FloatingShield className="top-24 left-[15%] hidden md:block" />
        <FloatingShield className="top-40 right-[12%] hidden md:block" />

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-[700px]"
        >
          <motion.div variants={fadeIn} className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-pink/30 bg-pink-dim px-4 py-1.5 text-sm text-pink">
              <span className="h-2 w-2 rounded-full bg-pink animate-pulse" />
              Live on Sepolia
            </span>
          </motion.div>

          <motion.h1 variants={fadeIn} className="text-[clamp(2.5rem,8vw,5rem)] font-bold leading-[1.05] tracking-tight mb-6">
            Stop losing money<br />to impermanent loss
          </motion.h1>

          <motion.p variants={fadeIn} className="text-lg text-text2 mb-10 max-w-[480px] mx-auto">
            Streaming IL protection for concentrated LPs. Pay per block. Claim automatically. Cancel anytime.
          </motion.p>

          <motion.div variants={fadeIn} className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/protect" className="group rounded-[20px] bg-pink-cta px-7 py-3.5 text-base font-semibold text-pink-cta-text hover:brightness-110 transition-all flex items-center gap-2">
              Launch App
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-0.5">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
            <Link href="/research" className="rounded-[20px] border border-card-border px-7 py-3.5 text-base font-semibold text-text2 hover:text-text1 hover:border-text3 transition-all">
              How it works
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5 }}
          className="absolute bottom-8"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-text3 text-[12px]"
          >
            <span>Scroll</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ── STATS RIBBON ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="border-y border-card-border bg-card/50 py-8"
      >
        <div className="mx-auto max-w-[900px] grid grid-cols-3 gap-6 px-5">
          {[
            { value: "$1.5-3B", label: "lost to IL annually" },
            { value: "60%", label: "of LP positions unprofitable" },
            { value: "252", label: "tests passing" },
          ].map((s, i) => (
            <motion.div key={i} variants={fadeIn} className="text-center">
              <div className="font-mono text-2xl md:text-3xl font-bold text-text1">{s.value}</div>
              <div className="text-[12px] text-text3 mt-1">{s.label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* ── HOW IT WORKS ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="py-24 px-5"
      >
        <div className="mx-auto max-w-[900px]">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-bold text-center mb-16">
            Four steps. That&rsquo;s it.
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { n: "01", title: "LP normally", desc: "Provide liquidity on any supported DEX. Nothing changes about your position.", icon: "💧" },
              { n: "02", title: "Activate shield", desc: "Pick your coverage. Deposit premium. One click.", icon: "🛡️" },
              { n: "03", title: "Premium streams", desc: "Tiny USDC deduction per block. Scales with position size. Cancel anytime.", icon: "⏳" },
              { n: "04", title: "Get paid back", desc: "Close your position. If IL happened, payout hits your wallet automatically.", icon: "💰" },
            ].map((s) => (
              <motion.div
                key={s.n}
                variants={fadeIn}
                className="rounded-2xl border border-card-border bg-card p-6 flex gap-4 items-start hover:border-pink/20 transition-colors"
              >
                <div className="text-2xl">{s.icon}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[12px] text-pink">{s.n}</span>
                    <span className="text-base font-semibold text-text1">{s.title}</span>
                  </div>
                  <p className="text-sm text-text2">{s.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── COMPARISON ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="py-24 px-5"
      >
        <div className="mx-auto max-w-[900px]">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-4xl font-bold text-center mb-4">
            Not alchemy. Insurance.
          </motion.h2>
          <motion.p variants={fadeIn} className="text-text3 text-center mb-12 text-sm">
            Why previous IL solutions failed and why this one works.
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div variants={fadeIn} className="rounded-2xl bg-red-dim/50 border border-red/10 p-5">
              <div className="text-red text-[12px] font-bold mb-3">FAILED</div>
              <div className="font-semibold text-text1 mb-2">Bancor v3</div>
              <div className="text-sm text-text2">Minted tokens to pay claims. Collapsed when it mattered most.</div>
            </motion.div>
            <motion.div variants={fadeIn} className="rounded-2xl bg-amber-dim/50 border border-amber/10 p-5">
              <div className="text-amber text-[12px] font-bold mb-3">PARTIAL</div>
              <div className="font-semibold text-text1 mb-2">Active management</div>
              <div className="text-sm text-text2">Reduces IL 30-50% but can&rsquo;t eliminate it. Fails in trending markets.</div>
            </motion.div>
            <motion.div variants={fadeIn} className="rounded-2xl bg-pink-dim/50 border border-pink/20 p-5 ring-1 ring-pink/10">
              <div className="text-pink text-[12px] font-bold mb-3">IL SHIELD</div>
              <div className="font-semibold text-text1 mb-2">Stablecoin-backed insurance</div>
              <div className="text-sm text-text2">USDC vaults. Actuarial pricing. Vault solvency uncorrelated with crashes.</div>
            </motion.div>
          </div>
        </div>
      </motion.section>

      {/* ── TWO SIDES ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="py-24 px-5"
      >
        <div className="mx-auto max-w-[900px] grid grid-cols-1 md:grid-cols-2 gap-4">
          <motion.div variants={fadeIn} className="rounded-3xl border border-card-border bg-card p-8 flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-dim mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">For LPs</h3>
              <p className="text-sm text-text2 mb-6">Protect your positions across Uniswap, PancakeSwap, SushiSwap. Streaming premium. Automatic payout. Cancel anytime.</p>
            </div>
            <Link href="/protect" className="inline-flex items-center gap-1 text-sm font-semibold text-pink hover:underline">
              Protect a position <span>&rarr;</span>
            </Link>
          </motion.div>
          <motion.div variants={fadeIn} className="rounded-3xl border border-card-border bg-card p-8 flex flex-col justify-between">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-dim mb-5">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m8 12 2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-xl font-bold mb-2">For Yield Seekers</h3>
              <p className="text-sm text-text2 mb-6">Deposit USDC. Earn premium income. Senior vault (8-12% APY, last-loss) or Junior vault (20-50% APY, first-loss).</p>
            </div>
            <Link href="/vaults" className="inline-flex items-center gap-1 text-sm font-semibold text-amber hover:underline">
              Deposit to vault <span>&rarr;</span>
            </Link>
          </motion.div>
        </div>
      </motion.section>

      {/* ── TECH GRID ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="py-24 px-5 border-t border-card-border"
      >
        <div className="mx-auto max-w-[900px]">
          <motion.h2 variants={fadeIn} className="text-2xl font-bold text-center mb-10">Under the hood</motion.h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              "Chainlink + TWAP oracles",
              "ERC-4626 tranched vaults",
              "Soulbound ERC-721 NFTs",
              "Multi-DEX adapters",
              "Uniswap v4 hook",
              "252 tests, 97% coverage",
            ].map((f) => (
              <motion.div
                key={f}
                variants={fadeIn}
                className="rounded-xl border border-card-border bg-input px-4 py-3 text-sm text-text2 flex items-center gap-2"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-pink shrink-0" />
                {f}
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── CTA ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={fadeIn}
        className="py-24 px-5 text-center relative"
      >
        <GlowOrb className="w-[400px] h-[400px] top-0 left-1/2 -translate-x-1/2" color="pink" />
        <div className="relative z-10">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to protect your LP?</h2>
          <p className="text-text3 mb-8 text-sm">Live on testnet. No mainnet funds needed.</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/protect" className="rounded-[20px] bg-pink-cta px-7 py-3.5 text-base font-semibold text-pink-cta-text hover:brightness-110 transition-all">
              Launch App
            </Link>
            <Link href="https://github.com/robtg4/il-shield-protocol" target="_blank" className="rounded-[20px] border border-card-border px-7 py-3.5 text-base font-semibold text-text3 hover:text-text1 transition-all">
              GitHub
            </Link>
          </div>
          <p className="text-[12px] text-text3 mt-6">No token. No airdrop. Just protection.</p>
        </div>
      </motion.section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-card-border py-8 px-5">
        <div className="mx-auto max-w-[900px] flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-text3">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            IL Shield Protocol
          </div>
          <div className="flex items-center gap-6">
            <Link href="/about" className="hover:text-text1 transition-colors">About</Link>
            <Link href="/research" className="hover:text-text1 transition-colors">Research</Link>
            <Link href="https://github.com/robtg4/il-shield-protocol" target="_blank" className="hover:text-text1 transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
