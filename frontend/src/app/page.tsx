"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { BackgroundOrbs } from "@/components/BackgroundOrbs";
import { NavBar } from "@/components/NavBar";
import { ShieldDivider } from "@/components/ShieldDivider";
import { TokenPairSelector } from "@/components/TokenPairSelector";
import { CoverageTierPills } from "@/components/CoverageTierPills";
import { DurationPills } from "@/components/DurationPills";
import { PremiumInput } from "@/components/PremiumInput";
import { PLCards } from "@/components/PLCards";
import { ProgressBar } from "@/components/ProgressBar";
import { StatusBadge } from "@/components/StatusBadge";
import { SummaryRow } from "@/components/SummaryRow";

type Screen = "protect" | "active" | "settlement";

const DEMO = {
  positionValue: "1,245.87",
  positionDollar: "$3,147.22",
  coveredAmounts: ["$1,573.61", "$2,360.42", "$3,147.22"],
  ilAtRisk: "$247.13",
  feeEarned: "$89.42",
  monthlyPremiums: ["$4.72", "$7.08", "$9.44"],
  streamingRate: "0.000156 USDC/block",
  activationDelay: "48 hours",
  settlementPayout: "+$335.34",
};

export default function Home() {
  const { isConnected } = useAccount();
  const [screen, setScreen] = useState<Screen>("protect");
  const [selectedTier, setSelectedTier] = useState(2);
  const [selectedDuration, setSelectedDuration] = useState("30d");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [warmingPercent, setWarmingPercent] = useState(0);
  const [premiumBalance, setPremiumBalance] = useState(100);
  const initialPremium = 100;

  useEffect(() => {
    if (screen !== "active") return;
    setWarmingPercent(0);
    const interval = setInterval(() => {
      setWarmingPercent((prev) => {
        if (prev >= 100) { clearInterval(interval); return 100; }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [screen]);

  useEffect(() => {
    if (screen !== "active") return;
    const prem = parseFloat(premiumAmount) || 100;
    setPremiumBalance(prem);
    const interval = setInterval(() => {
      setPremiumBalance((prev) => Math.max(0, prev - prem * 0.002));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, premiumAmount]);

  const handleProtect = useCallback(() => {
    setIsConfirming(true);
    setTimeout(() => { setIsConfirming(false); setScreen("active"); }, 2200);
  }, []);

  const handleSettle = useCallback(() => setScreen("settlement"), []);

  const handleDone = useCallback(() => {
    setScreen("protect");
    setPremiumAmount("");
    setSelectedTier(2);
    setSelectedDuration("30d");
  }, []);

  const coveredAmount = DEMO.coveredAmounts[selectedTier] || DEMO.coveredAmounts[2];
  const monthlyPremium = DEMO.monthlyPremiums[selectedTier] || DEMO.monthlyPremiums[2];
  const premBalPercent = initialPremium > 0 ? (premiumBalance / initialPremium) * 100 : 0;
  const daysRemaining = premiumBalance > 0 ? Math.round((premiumBalance / 9.44) * 30) : 0;

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />
      <div className="relative z-10 flex min-h-screen flex-col">
        <NavBar />
        <main className="flex flex-1 flex-col items-center px-4 pt-10">

          {/* ── PROTECT SCREEN ── */}
          {screen === "protect" && (
            <>
              <h1 className="mb-7 text-center text-4xl font-medium tracking-tight text-text1 md:text-[52px] md:leading-[1.1]">
                Protect anytime, anywhere.
              </h1>
              <div className="w-full max-w-[480px] rounded-3xl border border-card-border bg-card p-4">
                {/* Position */}
                <div className="rounded-2xl bg-input p-3">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="text-[13px] text-text3">Position</span>
                    <StatusBadge status="in-range" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[28px] text-text1">{DEMO.positionValue}</span>
                    <TokenPairSelector token0="ETH" token1="USDC" />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[13px] text-text3">
                    <span>{DEMO.positionDollar}</span>
                    <span>IL: <span className="text-red">{DEMO.ilAtRisk}</span> · Fees: <span className="text-green">{DEMO.feeEarned}</span></span>
                  </div>
                </div>

                <ShieldDivider />

                {/* Coverage */}
                <div className="rounded-2xl bg-input p-3">
                  <div className="mb-1.5 text-[13px] text-text3">Coverage</div>
                  <div className="mb-3 text-[28px] text-green">{coveredAmount}</div>
                  <div className="mb-2"><CoverageTierPills selected={selectedTier} onSelect={setSelectedTier} /></div>
                  <DurationPills selected={selectedDuration} onSelect={setSelectedDuration} />
                </div>

                {/* Premium */}
                <div className="mt-3">
                  <PremiumInput value={premiumAmount} onChange={setPremiumAmount} balance="2,847.32" />
                </div>

                {/* Summary */}
                <div className="mt-3 space-y-0.5 px-1">
                  <SummaryRow label="Monthly premium" value={monthlyPremium} mono />
                  <SummaryRow label="Streaming rate" value={DEMO.streamingRate} mono />
                  <SummaryRow label="Activation delay" value={DEMO.activationDelay} />
                  <SummaryRow label="Current IL at risk" value={DEMO.ilAtRisk} valueColor="var(--red)" mono />
                </div>

                {/* CTA */}
                <button
                  onClick={handleProtect}
                  disabled={!premiumAmount || isConfirming}
                  className={`mt-4 w-full rounded-[20px] py-4 text-lg font-semibold transition-all ${
                    !premiumAmount ? "cursor-default bg-input text-text3"
                      : isConfirming ? "bg-pink-cta text-pink-cta-text opacity-70"
                      : "bg-pink-cta text-pink-cta-text hover:brightness-110"
                  }`}
                >
                  {isConfirming ? "Confirming..." : !premiumAmount ? "Enter amount" : "Protect position"}
                </button>
              </div>
              <p className="mt-4 max-w-[480px] text-center text-sm leading-relaxed text-text2">
                Protect LP positions with <span className="cursor-pointer text-pink">zero app fees</span> on 18+ networks including Ethereum, Unichain, and Base.
              </p>
            </>
          )}

          {/* ── ACTIVE PROTECTION SCREEN ── */}
          {screen === "active" && (
            <>
              <h1 className="mb-7 text-center text-4xl font-medium tracking-tight text-text1 md:text-[52px] md:leading-[1.1]">
                {warmingPercent >= 100 ? "Position protected." : "Warming up..."}
              </h1>
              <div className="w-full max-w-[480px] rounded-3xl border border-card-border bg-card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TokenPairSelector token0="ETH" token1="USDC" />
                    <span className="text-[13px] text-text3">0.30%</span>
                  </div>
                  <StatusBadge status={warmingPercent >= 100 ? "active" : "warming"} warmingPercent={warmingPercent < 100 ? warmingPercent : undefined} />
                </div>

                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="text-text3">{["50%", "75%", "100%"][selectedTier]} · {selectedDuration}</span>
                  <span className={warmingPercent >= 100 ? "text-green" : "text-amber"}>{warmingPercent}%</span>
                </div>
                <ProgressBar percent={warmingPercent} color={warmingPercent >= 100 ? "green" : "amber"} />

                <div className="mt-4">
                  <PLCards il="-$247.13" covered="+$247.13" exposure="$0.00" exposurePositive />
                </div>

                <div className="mt-3 rounded-2xl bg-input p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] text-text3">Premium balance</span>
                    <span className="font-mono text-sm text-text1">${premiumBalance.toFixed(2)}</span>
                  </div>
                  <ProgressBar percent={premBalPercent} color={premBalPercent < 20 ? "amber" : "pink"} />
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`font-mono text-xs ${premBalPercent < 20 ? "text-amber" : "text-text3"}`}>{DEMO.streamingRate}</span>
                    <span className={`text-xs ${premBalPercent < 20 ? "text-amber" : "text-text3"}`}>~{daysRemaining}d remaining</span>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <button className="flex-1 rounded-[20px] bg-input py-3.5 text-base font-semibold text-text1 transition-colors hover:bg-input-hover">Top up</button>
                  <button onClick={handleSettle} className="flex-1 rounded-[20px] bg-pink-cta py-3.5 text-base font-semibold text-pink-cta-text transition-colors hover:brightness-110">Settle claim</button>
                </div>
              </div>
              <p className="mt-4 max-w-[480px] text-center text-sm text-text2">Settles automatically when you close your Uniswap position.</p>
            </>
          )}

          {/* ── SETTLEMENT SCREEN ── */}
          {screen === "settlement" && (
            <>
              <h1 className="mb-7 text-center text-4xl font-medium tracking-tight text-text1 md:text-[52px] md:leading-[1.1]">
                Claim settled.
              </h1>
              <div className="w-full max-w-[480px] rounded-3xl border border-card-border bg-card p-4">
                <div className="flex flex-col items-center py-6">
                  <div className="mb-3.5 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-green-dim">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <path d="m9 12 2 2 4-4" />
                    </svg>
                  </div>
                  <div className="font-mono text-[40px] font-medium text-green">{DEMO.settlementPayout}</div>
                  <div className="mt-1 text-sm text-text2">Deposited to your wallet</div>
                </div>

                <div className="rounded-2xl bg-input p-3">
                  <SummaryRow label="Position" value="ETH/USDC · 0.30%" />
                  <SummaryRow label="Entry" value="$2,512.47" mono />
                  <SummaryRow label="Exit" value="$3,847.22" mono />
                  <SummaryRow label="Measured IL" value="-$347.13" valueColor="var(--red)" mono />
                  <SummaryRow label="Coverage" value="100% (no deductible)" />
                  <SummaryRow label="Fee (2%)" value="-$6.94" mono />
                  <SummaryRow label="Payout" value="+$335.34" valueColor="var(--green)" mono />
                </div>

                <button onClick={handleDone} className="mt-4 w-full rounded-[20px] bg-pink-cta py-4 text-lg font-semibold text-pink-cta-text transition-colors hover:brightness-110">
                  Done
                </button>
              </div>
              <p className="mt-4 text-center text-sm text-text2">
                View transaction on <span className="cursor-pointer text-pink">Etherscan</span>
              </p>
            </>
          )}

        </main>
      </div>
    </div>
  );
}
