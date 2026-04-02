const steps = [
  {
    number: "01",
    title: "Provide liquidity on Uniswap",
    description:
      "Deposit into any Uniswap v4 pool as normal. IL Shield wraps your existing position — no need to move liquidity.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Purchase IL protection",
    description:
      "Select your coverage tier (50–100%), duration, and deposit a USDC premium. Streaming premiums deduct per-block — no lump-sum lockup.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Earn fees, stay protected",
    description:
      "Keep earning swap fees from your LP position. If prices diverge and IL exceeds your fee income, your coverage kicks in automatically.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Settle and collect",
    description:
      "When you close your position, IL Shield computes your loss on-chain and pays you from the underwriting vault. Verified by Chainlink oracles.",
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
];

const stats = [
  { label: "Vault collateral", value: "Stablecoins only", detail: "No inflationary token risk" },
  { label: "Pricing model", value: "Net IL framework", detail: "Only charges for loss beyond fees" },
  { label: "Settlement", value: "Oracle-verified", detail: "Chainlink + TWAP cross-check" },
  { label: "Cover tokens", value: "Non-transferable", detail: "No securities classification risk" },
];

export function HowItWorks() {
  return (
    <section className="w-full max-w-[960px] px-4 pb-24">
      {/* Section header */}
      <div className="mb-16 text-center">
        <h2 className="mb-3 text-3xl font-medium tracking-tight text-text1 md:text-4xl">
          How IL Shield works
        </h2>
        <p className="mx-auto max-w-[540px] text-sm leading-relaxed text-text2">
          Parametric insurance for Uniswap v4 liquidity providers. Priced actuarially,
          collateralized in stablecoins, settled trustlessly.
        </p>
      </div>

      {/* Steps */}
      <div className="mb-20 grid gap-4 md:grid-cols-2">
        {steps.map((step) => (
          <div
            key={step.number}
            className="rounded-2xl border border-card-border bg-card p-6 transition-colors hover:border-pink/20"
          >
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-input">
                {step.icon}
              </div>
              <span className="font-mono text-xs text-text3">{step.number}</span>
            </div>
            <h3 className="mb-2 text-base font-semibold text-text1">{step.title}</h3>
            <p className="text-sm leading-relaxed text-text2">{step.description}</p>
          </div>
        ))}
      </div>

      {/* Architecture highlights */}
      <div className="rounded-3xl border border-card-border bg-card p-6 md:p-8">
        <h3 className="mb-6 text-center text-lg font-semibold text-text1">
          Built different from every prior attempt
        </h3>
        <div className="grid gap-4 sm:grid-cols-2">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-input p-4">
              <div className="mb-0.5 text-[11px] font-medium uppercase tracking-[0.05em] text-text3">
                {stat.label}
              </div>
              <div className="text-base font-semibold text-text1">{stat.value}</div>
              <div className="mt-1 text-xs text-text2">{stat.detail}</div>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-text3">
          IL Shield does not repeat Bancor&apos;s mistake. Collateral is stablecoins, not inflationary native tokens.
          The underwriting vault&apos;s ability to pay claims is independent of crypto market conditions.
        </p>
      </div>
    </section>
  );
}
