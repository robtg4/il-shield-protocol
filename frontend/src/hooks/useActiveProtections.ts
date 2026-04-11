"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useChainAddresses } from "./useILShield";

const CORE_ABI = [
  {
    name: "nextPositionId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      { name: "poolId", type: "bytes32" },
      { name: "entrySqrtPriceX96", type: "uint160" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "coverageTier", type: "uint8" },
      { name: "coverageStartBlock", type: "uint48" },
      { name: "coverageEndBlock", type: "uint48" },
      { name: "premiumBalance", type: "uint256" },
      { name: "premiumRatePerBlock", type: "uint256" },
      { name: "lastPremiumBlock", type: "uint256" },
      { name: "maxPayout", type: "uint256" },
      { name: "settled", type: "bool" },
      { name: "owner", type: "address" },
      { name: "referrer", type: "address" },
    ],
  },
] as const;

export interface ActiveProtection {
  ilpnId: number;
  coverageTier: number;
  premiumBalance: bigint;
  premiumRatePerBlock: bigint;
  settled: boolean;
  coverageStartBlock: number;
  coverageEndBlock: number;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  maxPayout: bigint;
}

export function useActiveProtections() {
  const { address } = useAccount();
  const addrs = useChainAddresses();

  const { data: nextIdData } = useReadContract({
    address: addrs.ILShieldCore,
    abi: CORE_ABI,
    functionName: "nextPositionId",
    query: { refetchInterval: 15_000 },
  });

  const totalIds = nextIdData ? Number(nextIdData as bigint) : 0;

  // Scan all position IDs (up to 50) to find ones owned by this wallet
  const scanCount = Math.min(totalIds, 50);
  const positionCalls = Array.from({ length: scanCount }, (_, i) => ({
    address: addrs.ILShieldCore,
    abi: CORE_ABI,
    functionName: "positions" as const,
    args: [BigInt(i)] as const,
  }));

  const { data: positionsData, isLoading } = useReadContracts({
    contracts: positionCalls,
    query: { enabled: scanCount > 0 && !!address },
  });

  const protections: ActiveProtection[] = [];

  if (positionsData && address) {
    for (let i = 0; i < positionsData.length; i++) {
      const result = positionsData[i];
      if (!result || result.status !== "success" || !result.result) continue;

      const data = result.result as readonly [
        string, bigint, number, number, bigint, number, number, number,
        bigint, bigint, bigint, bigint, boolean, string, string
      ];

      const owner = data[13] as string;
      if (owner.toLowerCase() !== address.toLowerCase()) continue;

      protections.push({
        ilpnId: i,
        coverageTier: Number(data[5]),
        premiumBalance: data[8] as bigint,
        premiumRatePerBlock: data[9] as bigint,
        settled: data[12] as boolean,
        coverageStartBlock: Number(data[6]),
        coverageEndBlock: Number(data[7]),
        tickLower: Number(data[3]),
        tickUpper: Number(data[4]),
        liquidity: data[4] as bigint,
        maxPayout: data[11] as bigint,
      });
    }
  }

  const active = protections.filter((p) => !p.settled);
  const settled = protections.filter((p) => p.settled);

  return { active, settled, all: protections, isLoading, totalIds };
}
