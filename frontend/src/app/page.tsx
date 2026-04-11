"use client";

import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import { useAccount, useChainId } from "wagmi";
import { useSearchParams } from "next/navigation";
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
import { DURATION_BLOCKS } from "@/lib/contracts";
import { useChainAddresses } from "@/hooks/useILShield";
import { usePositionAnalytics } from "@/hooks/usePositionAnalytics";
import { useUserPositions } from "@/hooks/useUserPositions";
import { ViewToggle, type ViewMode } from "@/components/analytics/ViewToggle";
import { SimpleAnalytics } from "@/components/analytics/SimpleAnalytics";
import { TechnicalAnalytics } from "@/components/analytics/TechnicalAnalytics";
import { PositionSelector } from "@/components/PositionSelector";
import { DexSelector } from "@/components/DexSelector";
import { DexLogo } from "@/components/DexLogo";
import { SupportedDexRow } from "@/components/SupportedDexRow";
import { getDeployedDexesForChain, type DexConfig } from "@/config/dex-registry";
import { usePremiumQuote } from "@/hooks/usePremiumQuote";
import { PremiumCostBreakdown } from "@/components/PremiumCostBreakdown";
import { TxProgressOverlay } from "@/components/TxProgressOverlay";
import { useActiveProtections } from "@/hooks/useActiveProtections";
import { ProtectionsList } from "@/components/ProtectionCard";

type Screen = "protect" | "active" | "settlement";

export default function Home() {
  return (
    <Suspense>
      <HomeInner />
    </Suspense>
  );
}

function HomeInner() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const addrs = useChainAddresses();
  const searchParams = useSearchParams();
  const positionIdParam = searchParams.get("positionId");

  // DEX selection (must come before position discovery)
  const availableDexes = useMemo(() => getDeployedDexesForChain(chainId), [chainId]);
  const [selectedDex, setSelectedDex] = useState<DexConfig | null>(null);
  useEffect(() => {
    if (availableDexes.length > 0 && !selectedDex) {
      setSelectedDex(availableDexes[0]);
    }
  }, [availableDexes, selectedDex]);

  // User positions from on-chain — based on selected DEX
  const { positions: userPositions, isLoading: positionsLoading } = useUserPositions(selectedDex, chainId);
  const [selectedPositionId, setSelectedPositionId] = useState<bigint | null>(null);

  // Auto-select from URL param or first position
  useEffect(() => {
    if (positionIdParam) {
      setSelectedPositionId(BigInt(positionIdParam));
    } else if (userPositions.length > 0 && selectedPositionId === null) {
      setSelectedPositionId(userPositions[0].tokenId);
    }
  }, [positionIdParam, userPositions, selectedPositionId]);

  // Reset position selection when DEX changes
  useEffect(() => {
    setSelectedPositionId(null);
  }, [selectedDex?.id]);

  const selectedPosition = userPositions.find((p) => p.tokenId === selectedPositionId) ?? null;
  const positionId = selectedPositionId ?? BigInt(1);

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

  // Analytics view mode (persisted in localStorage)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("ilshield-view-mode") as ViewMode) || "simple";
    }
    return "simple";
  });
  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("ilshield-view-mode", mode);
    }
  }, []);

  // Position analytics — driven by selected position, no static data
  const analytics = usePositionAnalytics(selectedPosition, parseFloat(premiumAmount) || undefined);

  // Premium quotes — read rates from PricingOracle for all 3 tiers
  // poolId = bytes32(uint256(1)) for legacy, or derived from adapter pool address
  // For now use the legacy poolId format since that's what's configured on the oracle
  const premiumPoolId = selectedPosition
    ? ("0x0000000000000000000000000000000000000000000000000000000000000001" as `0x${string}`)
    : null;
  const premiumQuotes = usePremiumQuote(
    premiumPoolId,
    selectedPosition?.tickLower ?? 0,
    selectedPosition?.tickUpper ?? 0,
    selectedTier,
    selectedDuration,
  );

  // Active protections — always visible when wallet connected
  const { active: activeProtections, settled: settledProtections, isLoading: protectionsLoading } = useActiveProtections();

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

  // Resolve adapter address from selected DEX + chain
  const adapterAddress = (selectedDex?.adapters[chainId] || "0x0000000000000000000000000000000000000000") as `0x${string}`;

  // Handle approve → register flow
  useEffect(() => {
    if (isApproveSuccess && txStep === "approve") {
      usdcAllowance.refetch();
      setTxStep("register");
      register({
        adapter: adapterAddress,
        positionId,
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
        adapter: adapterAddress,
        positionId,
        coverageTier: selectedTier,
        duration: selectedDuration,
        premiumAmount,
      });
    }
  }, [isConnected, premiumAmount, needsApproval, selectedTier, selectedDuration, adapterAddress]);

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

      {/* Transaction progress overlay */}
      {(isTxPending || isSettling || isSettleConfirming) && (
        <TxProgressOverlay
          step={
            isSettling || isSettleConfirming ? "settle"
            : txStep === "approve" || isApproving || isApproveConfirming ? "approve"
            : "register"
          }
          message={
            isApproveConfirming || isRegisterConfirming || isSettleConfirming
              ? "Transaction submitted — waiting for confirmation..."
              : "Please confirm in your wallet"
          }
        />
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        <NavBar />
        <main className="flex flex-1 flex-col items-center px-4 pt-10">
          {/* ── PROTECT SCREEN ── */}
          {screen === "protect" && (
            <>
              <h1 className="mb-7 text-center text-4xl font-medium tracking-tight text-text1 md:text-[52px] md:leading-[1.1]">
                Protect anytime, anywhere.
              </h1>

              {/* Two-column layout: Transaction (left) + Analytics (right) */}
              <div className="w-full max-w-[1000px] flex flex-col lg:flex-row gap-4 lg:items-start">

                {/* ── LEFT: Transaction Card ── */}
                <div className="w-full lg:w-[440px] lg:shrink-0 rounded-3xl border border-card-border bg-card p-4">
                  {/* DEX selector */}
                  {availableDexes.length > 0 && selectedDex && (
                    <div className="mb-3">
                      <DexSelector
                        available={availableDexes}
                        selected={selectedDex}
                        onSelect={setSelectedDex}
                      />
                    </div>
                  )}

                  {/* Position selector */}
                  <div className="rounded-2xl bg-input p-3" style={selectedDex ? { borderLeft: `3px solid ${selectedDex.color}20` } : undefined}>
                    <div className="mb-1.5 flex items-center gap-2 text-[13px] text-text3">
                      {selectedDex && <DexLogo dexId={selectedDex.id} size={14} />}
                      <span>Position{selectedDex ? ` on ${selectedDex.name}` : ""}</span>
                    </div>
                    {isConnected && userPositions.length > 0 ? (
                      <PositionSelector
                        positions={userPositions}
                        selected={selectedPositionId}
                        onSelect={setSelectedPositionId}
                        isLoading={positionsLoading}
                      />
                    ) : isConnected && !positionsLoading ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text3">No Uniswap v4 positions found</span>
                        <TokenPairSelector token0="ETH" token1="USDC" />
                      </div>
                    ) : !isConnected ? (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-text3">Connect wallet to select a position</span>
                        <TokenPairSelector token0="ETH" token1="USDC" />
                      </div>
                    ) : (
                      <div className="h-8 w-40 animate-pulse rounded bg-card" />
                    )}
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

                  {/* Premium cost breakdown */}
                  {selectedPosition && (
                    <div className="mt-3">
                      <PremiumCostBreakdown
                        quotes={premiumQuotes}
                        selectedTier={selectedTier}
                        selectedDuration={selectedDuration}
                      />
                    </div>
                  )}

                  {/* Premium deposit */}
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

                {/* ── RIGHT: Analytics Card ── */}
                <div className="w-full lg:flex-1 rounded-3xl border border-card-border bg-card p-4">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-text1 font-medium">Position Analytics</span>
                    {analytics && <ViewToggle mode={viewMode} onChange={handleViewModeChange} />}
                  </div>
                  {analytics ? (
                    <div
                      className="transition-all duration-200 ease-out"
                      key={viewMode}
                      style={{ animation: "fadeSlideIn 200ms ease" }}
                    >
                      {viewMode === "simple" ? (
                        <SimpleAnalytics data={analytics} />
                      ) : (
                        <TechnicalAnalytics data={analytics} />
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="1.5" className="mb-3">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <div className="text-sm text-text2 mb-1">
                        {!isConnected
                          ? "Connect your wallet to see analytics"
                          : userPositions.length === 0
                            ? "No positions detected"
                            : "Select a position to view analytics"}
                      </div>
                      <div className="text-[12px] text-text3">
                        {!isConnected
                          ? "Analytics are driven by your on-chain position data"
                          : "Open a Uniswap v4 LP position, then select it here"}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Your Protections ── */}
              {isConnected && (activeProtections.length > 0 || settledProtections.length > 0 || protectionsLoading) && (
                <div className="w-full max-w-[1000px] mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--pink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span className="text-sm font-medium text-text1">
                      Your Protections
                      {activeProtections.length > 0 && (
                        <span className="ml-1.5 text-[12px] text-pink">({activeProtections.length} active)</span>
                      )}
                    </span>
                  </div>
                  <ProtectionsList
                    active={activeProtections}
                    settled={settledProtections}
                    isLoading={protectionsLoading}
                  />
                </div>
              )}

              <div className="mt-6">
                <SupportedDexRow />
              </div>

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
                  <SummaryRow label="Network" value={chainId === 1301 ? "Unichain Sepolia" : "Ethereum Sepolia"} />
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
                <span className="cursor-pointer text-pink">{addrs.explorerName}</span>
              </p>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
