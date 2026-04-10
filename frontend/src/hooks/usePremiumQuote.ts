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
  /** Rate per block in USDC (raw, 18 decimals) */
  ratePerBlock: bigint;
  /** Cost for selected duration in USDC (6 decimals) */
  totalCost: bigint;
  /** Cost in human-readable USD */
  totalCostUSD: number;
  /** Daily cost in USD */
  dailyCostUSD: number;
  /** Monthly cost in USD */
  monthlyCostUSD: number;
}

export interface PremiumQuotes {
  /** Quote for each tier (0=50%, 1=75%, 2=100%) */
  tiers: [PremiumQuote | null, PremiumQuote | null, PremiumQuote | null];
  /** Currently selected tier's quote */
  selected: PremiumQuote | null;
  isLoading: boolean;
}

/**
 * Read premium rates from the PricingOracle for all 3 tiers,
 * then compute total cost for the selected duration.
 */
export function usePremiumQuote(
  poolId: string | null,
  tickLower: number,
  tickUpper: number,
  selectedTier: number,
  selectedDuration: string,
): PremiumQuotes {
  const addrs = useChainAddresses();
  const oracleAddr = addrs.PricingOracle;
  const hasPool = !!poolId && poolId !== "0x0000000000000000000000000000000000000000000000000000000000000000";

  // Read premium rate for all 3 tiers in one batch
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

    const ratePerBlock = result.result as bigint;
    // totalCost = ratePerBlock * durationBlocks
    // ratePerBlock is in 18 decimals, but represents USDC per unit liquidity per block
    // For the UI we show the raw rate × duration as the minimum deposit
    const totalCost = ratePerBlock * durationBlocks;

    // Convert to USDC (6 decimals): rate is 18 dec, so divide by 1e12 to get 6 dec
    const totalCost6Dec = totalCost / BigInt(1e12);
    const totalCostUSD = Number(totalCost6Dec) / 1e6;

    const dailyCost6Dec = (ratePerBlock * blocksPerDay) / BigInt(1e12);
    const dailyCostUSD = Number(dailyCost6Dec) / 1e6;
    const monthlyCostUSD = dailyCostUSD * 30;

    return {
      ratePerBlock,
      totalCost: totalCost6Dec,
      totalCostUSD,
      dailyCostUSD,
      monthlyCostUSD,
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
