"use client";

import { useReadContracts } from "wagmi";
import { useChainAddresses } from "./useILShield";
import { DURATION_BLOCKS } from "@/lib/contracts";

const ORACLE_ABI = [
  {
    name: "computePremiumRate",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "poolId", type: "bytes32" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "coverageTier", type: "uint8" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export interface PremiumQuote {
  /** Rate per block for this position (18-dec WAD, liquidity-scaled) */
  ratePerBlock: bigint;
  /** Total cost for selected duration (6-dec USDC) */
  totalCost: bigint;
  /** Total cost in USD */
  totalCostUSD: number;
  /** Daily cost in USD */
  dailyCostUSD: number;
  /** Monthly cost in USD */
  monthlyCostUSD: number;
  /** Recommended minimum deposit (total cost, in USD) */
  minDepositUSD: number;
}

export interface PremiumQuotes {
  tiers: [PremiumQuote | null, PremiumQuote | null, PremiumQuote | null];
  selected: PremiumQuote | null;
  isLoading: boolean;
}

/**
 * Read premium rates from the PricingOracle for all 3 tiers,
 * scale by position liquidity (matching the contract's register() logic),
 * then compute total cost for the selected duration.
 */
export function usePremiumQuote(
  poolId: string | null,
  tickLower: number,
  tickUpper: number,
  liquidity: bigint,
  selectedTier: number,
  selectedDuration: string,
): PremiumQuotes {
  const addrs = useChainAddresses();
  const oracleAddr = addrs.PricingOracle;
  const hasPool = !!poolId && poolId !== "0x0000000000000000000000000000000000000000000000000000000000000000";

  const calls = [0, 1, 2].map((tier) => ({
    address: oracleAddr,
    abi: ORACLE_ABI,
    functionName: "computePremiumRate" as const,
    args: [poolId as `0x${string}`, tickLower, tickUpper, tier] as const,
  }));

  const { data, isLoading } = useReadContracts({
    contracts: calls,
    query: { enabled: hasPool && tickLower !== 0 && tickUpper !== 0 },
  });

  const durationBlocks = BigInt(DURATION_BLOCKS[selectedDuration] || DURATION_BLOCKS["30d"]);
  const blocksPerDay = BigInt(7200);

  function buildQuote(tierIndex: number): PremiumQuote | null {
    const result = data?.[tierIndex];
    if (!result || result.status !== "success" || result.result === undefined) return null;

    const ratePerUnitLiq = result.result as bigint;

    // Scale by position liquidity — matches contract:
    // premiumRate = FullMath.mulDiv(ratePerUnitLiq, liquidity, 1e18)
    const scaledRate = liquidity > BigInt(0)
      ? (ratePerUnitLiq * liquidity) / BigInt(1e18)
      : ratePerUnitLiq;

    // Total cost for duration (multiply first, divide last for precision)
    // The contract stores premiumBalance in WAD (18-dec) and compares:
    //   premiumDepositWad (= deposit * 1e12) >= scaledRate * durationBlocks
    // So minDeposit (6-dec USDC) = (scaledRate * durationBlocks) / 1e12
    const totalCostWad = scaledRate * durationBlocks;
    const totalCost6Dec = totalCostWad / BigInt(1e12);
    const totalCostUSD = Number(totalCost6Dec) / 1e6;

    const dailyCostWad = scaledRate * blocksPerDay;
    const dailyCost6Dec = dailyCostWad / BigInt(1e12);
    const dailyCostUSD = Number(dailyCost6Dec) / 1e6;
    const monthlyCostUSD = dailyCostUSD * 30;

    // Add 5% buffer to min deposit for rounding safety
    const minDepositUSD = totalCostUSD * 1.05;

    return {
      ratePerBlock: scaledRate,
      totalCost: totalCost6Dec,
      totalCostUSD,
      dailyCostUSD,
      monthlyCostUSD,
      minDepositUSD,
    };
  }

  const tiers: [PremiumQuote | null, PremiumQuote | null, PremiumQuote | null] = [
    buildQuote(0),
    buildQuote(1),
    buildQuote(2),
  ];

  return {
    tiers,
    selected: tiers[selectedTier] ?? null,
    isLoading,
  };
}
