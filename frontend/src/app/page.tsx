"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
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
import { ScrollIndicator } from "@/components/ScrollIndicator";
import { HowItWorks } from "@/components/HowItWorks";
import {
  useUSDCBalance,
  useUSDCAllowance,
  useApproveUSDC,
  useRegister,
  useSettle,
  useCancelProtection,
  useVaultTotalAssets,
} from "@/hooks/useILShield";
import { ADDRESSES, DURATION_BLOCKS } from "@/lib/contracts";

type Screen = "protect" | "active" | "settlement";

export default function Home() {
  const { address, isConnected } = useAccount();
  const usdcBalance = useUSDCBalance();
  const usdcAllowance = useUSDCAllowance();
  const seniorAssets = useVaultTotalAssets("senior");
  const juniorAssets = useVaultTotalAssets("junior");

  // Contract write hooks
  const {
    approve: approveUSDC,
    isPending: isApproving,
    isConfirming: isApproveConfirming,
    isSuccess: isApproveSuccess,
  } = useApproveUSDC();
  const {
    register,
    isPending: isRegistering,
    isConfirming: isRegisterConfirming,
    isSuccess: isRegisterSuccess,
    error: registerError,
  } = useRegister();
  const {
    settle,
    isPending: isSettling,
    isConfirming: isSettleConfirming,
    isSuccess: isSettleSuccess,
  } = useSettle();

  // Screen state
  const [screen, setScreen] = useState<Screen>("protect");
  const [selectedTier, setSelectedTier] = useState(2);
  const [selectedDuration, setSelectedDuration] = useState("30d");
  const [premiumAmount, setPremiumAmount] = useState("");
  const [ilpnId, setIlpnId] = useState<bigint>(BigInt(0));
  const [txStep, setTxStep] = useState<"idle" | "approve" | "register">("idle");

  // Active screen state
  const [warmingPercent, setWarmingPercent] = useState(0);
  const [premiumBalance, setPremiumBalance] = useState(0);

  // Compute derived values
  const coveragePct = selectedTier === 0 ? 50 : selectedTier === 1 ? 75 : 100;
  const durationLabel = selectedDuration;
  const durationBlocks = DURATION_BLOCKS[selectedDuration] || DURATION_BLOCKS["30d"];

  // Check if approval is needed
  const needsApproval =
    premiumAmount &&
    usdcAllowance.raw !== undefined &&
    parseUnits(premiumAmount || "0", 6) > usdcAllowance.raw;

  // Handle approve → register flow
  useEffect(() => {
    if (isApproveSuccess && txStep === "approve") {
      usdcAllowance.refetch();
      setTxStep("register");
      register({
        positionId: BigInt(1),
        coverageTier: selectedTier,
        duration: selectedDuration,
        premiumAmount,
      });
    }
  }, [isApproveSuccess, txStep]);

  useEffect(() => {
    if (isRegisterSuccess) {
      setTxStep("idle");
      setScreen("active");
      setPremiumBalance(parseFloat(premiumAmount) || 0);
      usdcBalance.refetch();
    }
  }, [isRegisterSuccess]);

  useEffect(() => {
    if (isSettleSuccess) {
      setScreen("settlement");
    }
  }, [isSettleSuccess]);

  // Simulate warming on active screen
  useEffect(() => {
    if (screen !== "active") return;
    setWarmingPercent(0);
    const interval = setInterval(() => {
      setWarmingPercent((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 2;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [screen]);

  // Simulate premium depletion
  useEffect(() => {
    if (screen !== "active" || premiumBalance <= 0) return;
    const interval = setInterval(() => {
      setPremiumBalance((prev) => Math.max(0, prev - 0.01));
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, premiumBalance]);

  const handleProtect = useCallback(() => {
    if (!isConnected || !premiumAmount) return;

    if (needsApproval) {
      setTxStep("approve");
      approveUSDC(premiumAmount);
    } else {
      setTxStep("register");
      register({
        positionId: BigInt(1),
        coverageTier: selectedTier,
        duration: selectedDuration,
        premiumAmount,
      });
    }
  }, [isConnected, premiumAmount, needsApproval, selectedTier, selectedDuration]);

  const handleSettle = useCallback(() => {
    // Use a dummy exit price for testnet (sqrt(3000) * 2^96)
    const exitSqrtPrice = BigInt("4339505179874779489431521458380032");
    settle(ilpnId, exitSqrtPrice);
  }, [ilpnId, settle]);

  const handleDone = useCallback(() => {
    setScreen("protect");
    setPremiumAmount("");
    setSelectedTier(2);
    setSelectedDuration("30d");
    setTxStep("idle");
  }, []);

  const isTxPending = isApproving || isApproveConfirming || isRegistering || isRegisterConfirming;
  const initialPremium = parseFloat(premiumAmount) || 100;
  const premBalPercent = initialPremium > 0 ? (premiumBalance / initialPremium) * 100 : 0;
  const daysRemaining = premiumBalance > 0 ? Math.round(premiumBalance * 30) : 0;

  const ctaText = () => {
    if (!isConnected) return "Connect wallet";
    if (!premiumAmount) return "Enter amount";
    if (txStep === "approve" || isApproving || isApproveConfirming) return "Step 1: Approving USDC...";
    if (txStep === "register" || isRegistering || isRegisterConfirming) return "Step 2: Activating protection...";
    if (needsApproval) return "Approve & Protect";
    return "Protect position";
  };

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
                    <span className="text-[28px] text-text1">—</span>
                    <TokenPairSelector token0="ETH" token1="USDC" />
                  </div>
                  <div className="mt-1 text-[13px] text-text3">
                    Enter a Uniswap v4 position ID to protect
                  </div>
                </div>

                <ShieldDivider />

                {/* Coverage */}
                <div className="rounded-2xl bg-input p-3">
                  <div className="mb-1.5 text-[13px] text-text3">Coverage</div>
                  <div className="mb-3 text-[28px] text-green">{coveragePct}%</div>
                  <div className="mb-2">
                    <CoverageTierPills selected={selectedTier} onSelect={setSelectedTier} />
                  </div>
                  <DurationPills selected={selectedDuration} onSelect={setSelectedDuration} />
                </div>

                {/* Premium */}
                <div className="mt-3">
                  <PremiumInput
                    value={premiumAmount}
                    onChange={setPremiumAmount}
                    balance={isConnected ? Number(usdcBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                  />
                </div>

                {/* Summary */}
                <div className="mt-3 space-y-0.5 px-1">
                  <SummaryRow label="Coverage tier" value={`${coveragePct}%`} />
                  <SummaryRow label="Duration" value={`${durationLabel} (${durationBlocks.toLocaleString()} blocks)`} mono />
                  <SummaryRow label="Activation delay" value="10 blocks (~2 min)" />
                  <SummaryRow
                    label="Senior vault TVL"
                    value={`$${Number(seniorAssets.formatted).toLocaleString()}`}
                    mono
                  />
                  <SummaryRow
                    label="Junior vault TVL"
                    value={`$${Number(juniorAssets.formatted).toLocaleString()}`}
                    mono
                  />
                </div>

                {/* Error display */}
                {registerError && (
                  <div className="mt-2 rounded-xl bg-red-dim p-2 text-xs text-red">
                    {registerError.message?.slice(0, 120)}
                  </div>
                )}

                {/* CTA */}
                <button
                  onClick={isConnected ? handleProtect : undefined}
                  disabled={!isConnected || !premiumAmount || isTxPending}
                  className={`mt-4 w-full rounded-[20px] py-4 text-lg font-semibold transition-all ${
                    !isConnected || !premiumAmount
                      ? "cursor-default bg-input text-text3"
                      : isTxPending
                        ? "bg-pink-cta text-pink-cta-text opacity-70"
                        : "bg-pink-cta text-pink-cta-text hover:brightness-110"
                  }`}
                >
                  {ctaText()}
                </button>
              </div>

              <p className="mt-4 max-w-[480px] text-center text-sm leading-relaxed text-text2">
                Protect LP positions with{" "}
                <span className="text-pink">zero app fees</span> on Unichain Sepolia testnet.
              </p>

              <ScrollIndicator />

              {/* How it works section */}
              <div className="mt-20 w-full flex justify-center">
                <HowItWorks />
              </div>
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
                  <StatusBadge
                    status={warmingPercent >= 100 ? "active" : "warming"}
                    warmingPercent={warmingPercent < 100 ? warmingPercent : undefined}
                  />
                </div>

                <div className="mb-1 flex items-center justify-between text-[13px]">
                  <span className="text-text3">
                    {coveragePct}% · {durationLabel}
                  </span>
                  <span className={warmingPercent >= 100 ? "text-green" : "text-amber"}>
                    {warmingPercent}%
                  </span>
                </div>
                <ProgressBar percent={warmingPercent} color={warmingPercent >= 100 ? "green" : "amber"} />

                <div className="mt-4">
                  <PLCards il="-$0.00" covered="+$0.00" exposure="$0.00" exposurePositive />
                </div>

                {/* Premium balance */}
                <div className="mt-3 rounded-2xl bg-input p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-[13px] text-text3">Premium balance</span>
                    <span className="font-mono text-sm text-text1">
                      ${premiumBalance.toFixed(2)}
                    </span>
                  </div>
                  <ProgressBar percent={premBalPercent} color={premBalPercent < 20 ? "amber" : "pink"} />
                  <div className="mt-2 flex items-center justify-between">
                    <span className={`font-mono text-xs ${premBalPercent < 20 ? "text-amber" : "text-text3"}`}>
                      streaming per-block
                    </span>
                    <span className={`text-xs ${premBalPercent < 20 ? "text-amber" : "text-text3"}`}>
                      ~{daysRemaining}d remaining
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={handleDone}
                    className="flex-1 rounded-[20px] bg-input py-3.5 text-base font-semibold text-text1 transition-colors hover:bg-input-hover"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSettle}
                    disabled={isSettling || isSettleConfirming}
                    className={`flex-1 rounded-[20px] py-3.5 text-base font-semibold transition-colors ${
                      isSettling || isSettleConfirming
                        ? "bg-pink-cta text-pink-cta-text opacity-70"
                        : "bg-pink-cta text-pink-cta-text hover:brightness-110"
                    }`}
                  >
                    {isSettling || isSettleConfirming ? "Settling..." : "Settle claim"}
                  </button>
                </div>
              </div>

              <p className="mt-4 max-w-[480px] text-center text-sm text-text2">
                Settles automatically when you close your Uniswap position.
              </p>
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
                  <div className="font-mono text-[40px] font-medium text-green">$0.00</div>
                  <div className="mt-1 text-sm text-text2">
                    Protection settled — position closed
                  </div>
                </div>

                <div className="rounded-2xl bg-input p-3">
                  <SummaryRow label="Position" value="ETH/USDC" />
                  <SummaryRow label="Coverage" value={`${coveragePct}%`} />
                  <SummaryRow label="Duration" value={durationLabel} />
                  <SummaryRow label="Network" value="Unichain Sepolia" />
                </div>

                <button
                  onClick={handleDone}
                  className="mt-4 w-full rounded-[20px] bg-pink-cta py-4 text-lg font-semibold text-pink-cta-text transition-colors hover:brightness-110"
                >
                  Done
                </button>
              </div>

              <p className="mt-4 text-center text-sm text-text2">
                View transaction on{" "}
                <span className="cursor-pointer text-pink">Uniscan</span>
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
