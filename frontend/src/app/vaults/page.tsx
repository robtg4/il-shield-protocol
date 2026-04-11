"use client";

import { useState, useCallback, useEffect } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits } from "viem";
import { BackgroundOrbs } from "@/components/BackgroundOrbs";
import { NavBar } from "@/components/NavBar";
import { TxProgressOverlay } from "@/components/TxProgressOverlay";
import { useUSDCBalance, useChainAddresses } from "@/hooks/useILShield";
import { useVaultAnalytics } from "@/hooks/useVaultAnalytics";
import { ERC20_ABI, VAULT_ABI } from "@/lib/contracts";

type Tranche = "senior" | "junior";

const TRANCHE_INFO = {
  senior: {
    name: "Senior Tranche",
    badge: "Last-loss",
    badgeColor: "bg-green-dim text-green",
    barColor: "bg-green",
    apyRange: "8–12%",
    risk: "Low",
    riskDesc: "Only absorbs losses after Junior is fully depleted. Premium income provides steady yield.",
    premiumShare: "70%",
    lockPeriod: "14 days",
    testnetLock: "10 blocks (~2 min)",
    howItWorks: [
      "You deposit USDC into the Senior vault",
      "You earn 70% of all premium income from protected LPs",
      "Your capital is only at risk if Junior is fully wiped out",
      "Withdraw anytime after the lock period (or emergency withdraw at 5% penalty)",
    ],
  },
  junior: {
    name: "Junior Tranche",
    badge: "First-loss",
    badgeColor: "bg-amber-dim text-amber",
    barColor: "bg-amber",
    apyRange: "20–50%",
    risk: "High",
    riskDesc: "First to absorb IL claim payouts. Higher yield compensates for higher risk.",
    premiumShare: "15%",
    lockPeriod: "28 days",
    testnetLock: "20 blocks (~4 min)",
    howItWorks: [
      "You deposit USDC into the Junior vault",
      "You earn 15% of all premium income — plus residual after Senior yield",
      "Your capital absorbs IL claim payouts first (before Senior)",
      "Higher risk = higher potential returns. Withdraw after lock period.",
    ],
  },
};

function VaultCard({
  tranche,
  selected,
  onSelect,
}: {
  tranche: Tranche;
  selected: boolean;
  onSelect: () => void;
}) {
  const info = TRANCHE_INFO[tranche];
  const analytics = useVaultAnalytics(tranche);

  return (
    <button
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition-all ${
        selected ? "border-pink/40 bg-card shadow-lg" : "border-card-border bg-card/70 hover:border-card-border hover:bg-card"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-base font-semibold text-text1">{info.name}</div>
        <span className={`rounded-full px-2.5 py-1 text-[12px] font-medium ${info.badgeColor}`}>
          {info.badge}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="rounded-xl bg-input p-2.5 text-center">
          <div className="text-[12px] text-text3">TVL</div>
          <div className="font-mono text-sm font-semibold text-text1">
            ${analytics.totalAssetsUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-xl bg-input p-2.5 text-center">
          <div className="text-[12px] text-text3">Target APY</div>
          <div className="font-mono text-sm font-semibold text-green">{info.apyRange}</div>
        </div>
        <div className="rounded-xl bg-input p-2.5 text-center">
          <div className="text-[12px] text-text3">Risk</div>
          <div className={`text-sm font-semibold ${tranche === "senior" ? "text-green" : "text-amber"}`}>
            {info.risk}
          </div>
        </div>
      </div>

      {analytics.userAssetsUSD > 0 && (
        <div className="rounded-xl bg-pink-dim p-2.5 text-center">
          <div className="text-[12px] text-text3">Your position</div>
          <div className="font-mono text-sm font-semibold text-pink">
            ${analytics.userAssetsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            <span className="text-[12px] text-text3 ml-1">({analytics.userSharePct.toFixed(2)}%)</span>
          </div>
        </div>
      )}
    </button>
  );
}

function TrancheDetail({ tranche }: { tranche: Tranche }) {
  const info = TRANCHE_INFO[tranche];
  const analytics = useVaultAnalytics(tranche);

  return (
    <div className="space-y-3">
      {/* How it works */}
      <div className="rounded-2xl bg-input p-4">
        <div className="text-[13px] text-text3 font-medium mb-3">How {info.name} works</div>
        <div className="space-y-3">
          {info.howItWorks.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-dim text-[12px] font-semibold text-pink">
                {i + 1}
              </span>
              <div className="text-sm text-text2">{step}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk / Return analysis */}
      <div className="rounded-2xl bg-input p-4">
        <div className="text-[13px] text-text3 font-medium mb-3">Risk & Return</div>
        <div className="space-y-2 text-[12px]">
          <Row label="Premium share" value={info.premiumShare} />
          <Row label="Target APY" value={info.apyRange} />
          <Row label="Risk level" value={info.risk} />
          <Row label="Lock period" value={`${info.lockPeriod} (testnet: ${info.testnetLock})`} />
          <Row label="Emergency withdraw" value="Available anytime (5% penalty)" />
        </div>
        <div className="mt-3 rounded-xl bg-card p-3">
          <div className="text-[12px] text-text2">{info.riskDesc}</div>
        </div>
      </div>

      {/* ROI scenarios */}
      <div className="rounded-2xl bg-input p-4">
        <div className="text-[13px] text-text3 font-medium mb-3">Estimated returns on $10,000</div>
        <div className="overflow-x-auto -mx-1">
          <table className="w-full min-w-[300px] text-[12px]">
            <thead>
              <tr className="text-text3 border-b border-card-border">
                <th className="px-3 py-2 text-left font-medium">Period</th>
                <th className="px-3 py-2 text-right font-medium">Low ({tranche === "senior" ? "8%" : "20%"})</th>
                <th className="px-3 py-2 text-right font-medium">High ({tranche === "senior" ? "12%" : "50%"})</th>
              </tr>
            </thead>
            <tbody>
              {[
                { period: "30 days", low: tranche === "senior" ? 65.75 : 164.38, high: tranche === "senior" ? 98.63 : 410.96 },
                { period: "90 days", low: tranche === "senior" ? 197.26 : 493.15, high: tranche === "senior" ? 295.89 : 1232.88 },
                { period: "1 year", low: tranche === "senior" ? 800 : 2000, high: tranche === "senior" ? 1200 : 5000 },
              ].map((r) => (
                <tr key={r.period} className="border-b border-card-border last:border-0">
                  <td className="px-3 py-2 text-text2">{r.period}</td>
                  <td className="px-3 py-2 text-right text-green font-mono">+${r.low.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-green font-mono">+${r.high.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-2 text-[11px] text-text3">
          Returns depend on premium volume and claim frequency. Past performance is not indicative of future results.
        </div>
      </div>

      {/* Vault health */}
      <div className="rounded-2xl bg-input p-4">
        <div className="text-[13px] text-text3 font-medium mb-3">Vault metrics</div>
        <div className="space-y-2 text-[12px]">
          <Row label="Total value locked" value={`$${analytics.totalAssetsUSD.toLocaleString()}`} />
          <Row label="Your deposits" value={analytics.userAssetsUSD > 0 ? `$${analytics.userAssetsUSD.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : "—"} />
          <Row label="Your share" value={analytics.userSharePct > 0 ? `${analytics.userSharePct.toFixed(4)}%` : "—"} />
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text3">{label}</span>
      <span className="font-mono text-text2">{value}</span>
    </div>
  );
}

export default function VaultsPage() {
  const { address, isConnected } = useAccount();
  const addrs = useChainAddresses();
  const usdcBalance = useUSDCBalance();
  const [selectedTranche, setSelectedTranche] = useState<Tranche>("senior");
  const [amount, setAmount] = useState("");
  const [txStep, setTxStep] = useState<"idle" | "approve" | "deposit">("idle");

  const vaultAddr = selectedTranche === "senior" ? addrs.SeniorVault : addrs.JuniorVault;

  // Allowance against the vault (not Core)
  const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
    address: addrs.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, vaultAddr] : undefined,
    query: { enabled: !!address },
  });
  const allowance = (allowanceData as bigint) || BigInt(0);

  // Approve write (targets vault, not Core)
  const { writeContract: writeApprove, data: approveHash, isPending: isApproving } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash });

  // Deposit write
  const { writeContract, data: depositHash, isPending: isDepositing } = useWriteContract();
  const { isLoading: isDepositConfirming, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash });

  const needsApproval = amount && parseUnits(amount || "0", 6) > allowance;

  // Approve → deposit flow
  useEffect(() => {
    if (isApproveSuccess && txStep === "approve") {
      refetchAllowance();
      setTxStep("deposit");
      writeContract({
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [parseUnits(amount, 6), address!],
      });
    }
  }, [isApproveSuccess, txStep]);

  useEffect(() => {
    if (isDepositSuccess) {
      setTxStep("idle");
      setAmount("");
      usdcBalance.refetch();
    }
  }, [isDepositSuccess]);

  const handleDeposit = useCallback(() => {
    if (!isConnected || !amount) return;
    if (needsApproval) {
      setTxStep("approve");
      writeApprove({
        address: addrs.USDC,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [vaultAddr, parseUnits(amount, 6)],
      });
    } else {
      setTxStep("deposit");
      writeContract({
        address: vaultAddr,
        abi: VAULT_ABI,
        functionName: "deposit",
        args: [parseUnits(amount, 6), address!],
      });
    }
  }, [isConnected, amount, needsApproval, vaultAddr, address]);

  const isTxPending = isApproving || isApproveConfirming || isDepositing || isDepositConfirming;

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />

      {isTxPending && (
        <TxProgressOverlay
          step={txStep === "approve" ? "approve" : "register"}
          message={
            isApproveConfirming || isDepositConfirming
              ? "Transaction submitted — waiting for confirmation..."
              : "Please confirm in your wallet"
          }
        />
      )}

      <div className="relative z-10 flex min-h-screen flex-col">
        <NavBar />
        <main className="flex flex-1 flex-col items-center px-4 pt-10">
          <h1 className="mb-3 text-center text-4xl font-medium tracking-tight text-text1 md:text-[52px] md:leading-[1.1]">
            Earn yield. Back LPs.
          </h1>
          <p className="mb-8 text-center text-sm text-text2 max-w-[500px]">
            Deposit USDC into the underwriting vaults. Premium income from protected LPs flows to you. Choose your risk level.
          </p>

          <div className="w-full max-w-[1000px] flex flex-col lg:flex-row gap-4 lg:items-start">

            {/* LEFT: Tranche selection + deposit */}
            <div className="w-full lg:w-[420px] lg:shrink-0 space-y-4">
              {/* Tranche cards */}
              <div className="space-y-3">
                <VaultCard tranche="senior" selected={selectedTranche === "senior"} onSelect={() => setSelectedTranche("senior")} />
                <VaultCard tranche="junior" selected={selectedTranche === "junior"} onSelect={() => setSelectedTranche("junior")} />
              </div>

              {/* Deposit form */}
              <div className="rounded-3xl border border-card-border bg-card p-4">
                <div className="text-[13px] text-text3 mb-2">
                  Deposit into {TRANCHE_INFO[selectedTranche].name}
                </div>

                <div className="rounded-2xl bg-input p-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-text3">Amount (USDC)</span>
                    <span className="text-[12px] text-text3">
                      Balance: {isConnected ? Number(usdcBalance.formatted).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                    </span>
                  </div>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0"
                    value={amount}
                    onChange={(e) => {
                      if (/^\d*\.?\d*$/.test(e.target.value)) setAmount(e.target.value);
                    }}
                    className="w-full bg-transparent text-[28px] text-text1 outline-none placeholder:text-text3 font-mono"
                  />
                </div>

                {isDepositSuccess && (
                  <div className="mt-2 rounded-xl bg-green-dim p-2 text-[12px] text-green text-center">
                    Deposit successful! Your shares are now earning premium income.
                  </div>
                )}

                <button
                  onClick={handleDeposit}
                  disabled={!isConnected || !amount || isTxPending}
                  className={`mt-4 w-full rounded-[20px] py-4 text-lg font-semibold transition-all ${
                    !isConnected || !amount
                      ? "cursor-default bg-input text-text3"
                      : isTxPending
                        ? "bg-pink-cta text-pink-cta-text opacity-70"
                        : "bg-pink-cta text-pink-cta-text hover:brightness-110"
                  }`}
                >
                  {!isConnected
                    ? "Connect wallet"
                    : !amount
                      ? "Enter amount"
                      : isTxPending
                        ? "Processing..."
                        : needsApproval
                          ? "Approve & Deposit"
                          : `Deposit to ${selectedTranche === "senior" ? "Senior" : "Junior"}`}
                </button>
              </div>
            </div>

            {/* RIGHT: Education + analysis */}
            <div className="w-full lg:flex-1">
              <TrancheDetail tranche={selectedTranche} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
