"use client";

import { motion, useScroll, useTransform, useInView } from "framer-motion";
import { useRef, useEffect, useState } from "react";
import Link from "next/link";
import { NavBar } from "@/components/NavBar";

const fadeIn = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.7, ease: "easeOut" as const } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.12 } },
};

// ── Count-up animation ──
function CountUp({ target, prefix = "", suffix = "", duration = 2000 }: { target: number; prefix?: string; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [isInView, target, duration]);

  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>;
}

// ── Floating icons ──
function FloatingIcon({ className, children, delay = 0, speed = 6 }: { className: string; children: React.ReactNode; delay?: number; speed?: number }) {
  return (
    <motion.div
      className={`absolute hidden md:flex items-center justify-center rounded-2xl border border-white/5 bg-card/80 backdrop-blur-sm ${className}`}
      animate={{ y: [0, -14, 0], rotate: [0, 4, -4, 0] }}
      transition={{ duration: speed, repeat: Infinity, ease: "easeInOut", delay }}
    >
      {children}
    </motion.div>
  );
}

function GlowOrb({ className = "", color = "pink" }: { className?: string; color?: string }) {
  const colors: Record<string, string> = { pink: "bg-pink/20", green: "bg-green/15", amber: "bg-amber/10" };
  return (
    <motion.div
      className={`absolute rounded-full blur-[120px] ${colors[color]} ${className}`}
      animate={{ scale: [1, 1.3, 1], opacity: [0.3, 0.5, 0.3] }}
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
        className="relative flex min-h-[92vh] flex-col items-center justify-center px-5 text-center"
      >
        {/* Ambient glow */}
        <GlowOrb className="w-[600px] h-[600px] -top-32 left-1/2 -translate-x-1/2" color="pink" />
        <GlowOrb className="w-[400px] h-[400px] top-32 -left-32" color="green" />
        <GlowOrb className="w-[350px] h-[350px] top-48 -right-20" color="amber" />

        {/* Floating themed icons */}
        <FloatingIcon className="h-14 w-14 top-[18%] left-[8%]" delay={0} speed={7}>
          <span className="text-2xl">🛡️</span>
        </FloatingIcon>
        <FloatingIcon className="h-14 w-14 top-[22%] right-[10%]" delay={0.5} speed={6}>
          <span className="text-2xl">💧</span>
        </FloatingIcon>
        <FloatingIcon className="h-14 w-14 top-[55%] left-[6%]" delay={1} speed={8}>
          <span className="text-2xl">📉</span>
        </FloatingIcon>
        <FloatingIcon className="h-14 w-14 top-[50%] right-[7%]" delay={1.5} speed={5.5}>
          <span className="text-2xl">🦄</span>
        </FloatingIcon>
        <FloatingIcon className="h-12 w-12 top-[35%] left-[18%]" delay={2} speed={7.5}>
          <span className="text-xl">💸</span>
        </FloatingIcon>
        <FloatingIcon className="h-12 w-12 top-[38%] right-[16%]" delay={0.8} speed={6.5}>
          <span className="text-xl">🔒</span>
        </FloatingIcon>
        <FloatingIcon className="h-11 w-11 top-[65%] left-[14%]" delay={1.2} speed={9}>
          <span className="text-lg">⚡</span>
        </FloatingIcon>
        <FloatingIcon className="h-11 w-11 top-[62%] right-[13%]" delay={0.3} speed={7}>
          <span className="text-lg">🥞</span>
        </FloatingIcon>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={stagger}
          className="relative z-10 max-w-[720px]"
        >
          <motion.div variants={fadeIn} className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-pink/30 bg-pink-dim px-4 py-1.5 text-sm text-pink font-medium">
              <span className="h-2 w-2 rounded-full bg-pink animate-pulse" />
              Live on Sepolia
            </span>
          </motion.div>

          <motion.h1 variants={fadeIn} className="text-[clamp(2.8rem,9vw,5.5rem)] font-bold leading-[1.05] tracking-tight mb-6">
            Stop losing money<br />to impermanent loss
          </motion.h1>

          <motion.p variants={fadeIn} className="text-xl md:text-2xl text-text2 mb-12 max-w-[520px] mx-auto leading-relaxed">
            Streaming IL protection for concentrated LPs. Pay per block. Claim automatically. Cancel anytime.
          </motion.p>

          <motion.div variants={fadeIn} className="flex items-center justify-center gap-3 flex-wrap">
            <Link href="/protect" className="group rounded-[20px] bg-pink-cta px-8 py-4 text-lg font-semibold text-pink-cta-text hover:brightness-110 transition-all flex items-center gap-2">
              Launch App
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="transition-transform group-hover:translate-x-1">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </Link>
            <Link href="/research" className="rounded-[20px] border border-card-border px-8 py-4 text-lg font-semibold text-text2 hover:text-text1 hover:border-text3 transition-all">
              How it works
            </Link>
          </motion.div>
        </motion.div>

        {/* Scroll indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className="absolute bottom-10"
        >
          <motion.div
            animate={{ y: [0, 10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="flex flex-col items-center gap-2 text-text3 text-[13px]"
          >
            <span>Scroll</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ── STATS RIBBON — big counting numbers ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        variants={stagger}
        className="border-y border-card-border bg-card/60 py-14"
      >
        <div className="mx-auto max-w-[1000px] grid grid-cols-3 gap-8 px-5">
          <motion.div variants={fadeIn} className="text-center">
            <div className="font-mono text-5xl md:text-6xl font-bold text-text1 mb-2">
              $<CountUp target={3} suffix="B" duration={2500} />
            </div>
            <div className="text-sm md:text-base text-text2">Lost to IL annually</div>
          </motion.div>
          <motion.div variants={fadeIn} className="text-center">
            <div className="font-mono text-5xl md:text-6xl font-bold text-text1 mb-2">
              <CountUp target={60} suffix="%" duration={2000} />
            </div>
            <div className="text-sm md:text-base text-text2">of LP positions unprofitable</div>
          </motion.div>
          <motion.div variants={fadeIn} className="text-center">
            <div className="font-mono text-5xl md:text-6xl font-bold text-text1 mb-2">
              <CountUp target={252} duration={2500} />
            </div>
            <div className="text-sm md:text-base text-text2">Tests passing</div>
          </motion.div>
        </div>
      </motion.section>

      {/* ── HOW IT WORKS ── */}
      <motion.section
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: "-100px" }}
        variants={stagger}
        className="py-28 px-5"
      >
        <div className="mx-auto max-w-[900px]">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-5xl font-bold text-center mb-16">
            Four steps. That&rsquo;s it.
          </motion.h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[
              { n: "01", title: "LP normally", desc: "Provide liquidity on any supported DEX. Nothing changes.", icon: "💧" },
              { n: "02", title: "Activate shield", desc: "Pick coverage. Deposit premium. One click.", icon: "🛡️" },
              { n: "03", title: "Premium streams", desc: "Tiny USDC per block. Scales with size. Cancel anytime.", icon: "⏳" },
              { n: "04", title: "Get paid back", desc: "IL happened? Payout hits your wallet automatically.", icon: "💰" },
            ].map((s) => (
              <motion.div
                key={s.n}
                variants={fadeIn}
                className="rounded-2xl border border-card-border bg-card p-6 flex gap-4 items-start hover:border-pink/20 transition-colors"
              >
                <div className="text-3xl">{s.icon}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-mono text-[12px] text-pink font-bold">{s.n}</span>
                    <span className="text-lg font-semibold text-text1">{s.title}</span>
                  </div>
                  <p className="text-base text-text2">{s.desc}</p>
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
        className="py-28 px-5"
      >
        <div className="mx-auto max-w-[900px]">
          <motion.h2 variants={fadeIn} className="text-3xl md:text-5xl font-bold text-center mb-5">
            Not alchemy. Insurance.
          </motion.h2>
          <motion.p variants={fadeIn} className="text-text2 text-center mb-14 text-base max-w-[450px] mx-auto">
            Why previous IL solutions failed and why this one works.
          </motion.p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <motion.div variants={fadeIn} className="rounded-2xl bg-red-dim/50 border border-red/10 p-6">
              <div className="text-red text-[13px] font-bold mb-3">FAILED</div>
              <div className="text-lg font-semibold text-text1 mb-2">Bancor v3</div>
              <div className="text-base text-text2">Minted tokens to pay claims. Collapsed when it mattered most.</div>
            </motion.div>
            <motion.div variants={fadeIn} className="rounded-2xl bg-amber-dim/50 border border-amber/10 p-6">
              <div className="text-amber text-[13px] font-bold mb-3">PARTIAL</div>
              <div className="text-lg font-semibold text-text1 mb-2">Active management</div>
              <div className="text-base text-text2">Reduces IL 30-50% but can&rsquo;t eliminate it. Fails in trends.</div>
            </motion.div>
            <motion.div variants={fadeIn} className="rounded-2xl bg-pink-dim/50 border border-pink/20 p-6 ring-1 ring-pink/10">
              <div className="text-pink text-[13px] font-bold mb-3">IL SHIELD</div>
              <div className="text-lg font-semibold text-text1 mb-2">Stablecoin-backed insurance</div>
              <div className="text-base text-text2">USDC vaults. Actuarial pricing. Uncorrelated with crashes.</div>
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
        className="py-28 px-5"
      >
        <div className="mx-auto max-w-[900px] grid grid-cols-1 md:grid-cols-2 gap-5">
          <motion.div variants={fadeIn} className="rounded-3xl border border-card-border bg-card p-9 flex flex-col justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-pink-dim mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">For LPs</h3>
              <p className="text-base text-text2 mb-8">Protect your positions across Uniswap, PancakeSwap, SushiSwap. Streaming premium. Automatic payout. Cancel anytime.</p>
            </div>
            <Link href="/protect" className="inline-flex items-center gap-1 text-base font-semibold text-pink hover:underline">
              Protect a position <span>&rarr;</span>
            </Link>
          </motion.div>
          <motion.div variants={fadeIn} className="rounded-3xl border border-card-border bg-card p-9 flex flex-col justify-between">
            <div>
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-dim mb-6">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <path d="m8 12 2 2 4-4" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold mb-3">For Yield Seekers</h3>
              <p className="text-base text-text2 mb-8">Deposit USDC. Earn premium income. Senior vault (8-12% APY, last-loss) or Junior vault (20-50% APY, first-loss).</p>
            </div>
            <Link href="/vaults" className="inline-flex items-center gap-1 text-base font-semibold text-amber hover:underline">
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
          <motion.h2 variants={fadeIn} className="text-2xl md:text-3xl font-bold text-center mb-10">Under the hood</motion.h2>
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
                className="rounded-xl border border-card-border bg-input px-4 py-3.5 text-base text-text2 flex items-center gap-2.5"
              >
                <span className="h-2 w-2 rounded-full bg-pink shrink-0" />
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
        className="py-28 px-5 text-center relative"
      >
        <GlowOrb className="w-[500px] h-[500px] top-0 left-1/2 -translate-x-1/2" color="pink" />
        <div className="relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-5">Ready to protect your LP?</h2>
          <p className="text-text2 mb-10 text-base">Live on testnet. No mainnet funds needed.</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/protect" className="rounded-[20px] bg-pink-cta px-8 py-4 text-lg font-semibold text-pink-cta-text hover:brightness-110 transition-all">
              Launch App
            </Link>
            <Link href="https://github.com/robtg4/il-shield-protocol" target="_blank" className="rounded-[20px] border border-card-border px-8 py-4 text-lg font-semibold text-text3 hover:text-text1 transition-all">
              GitHub
            </Link>
          </div>
          <p className="text-sm text-text3 mt-8">No token. No airdrop. Just protection.</p>
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
