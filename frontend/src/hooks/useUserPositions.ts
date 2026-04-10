"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import type { DexConfig } from "@/config/dex-registry";

const TOKEN_LABELS: Record<string, string> = {
  "0x0000000000000000000000000000000000000000": "ETH",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": "WETH",
  "0x31d0220469e10c4e71834a79b1f276d740d3768f": "USDC",
  "0xc6ffea5afaf2fd72cf00140dd3dda8841682128e": "USDC",
  "0x54738b6d21e9b3091f9cf82f9d3cf0d05ae4040a": "USDC",
  "0x6f79350e44a35225870e5fddf55b17574fd77d1a": "USDC",
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
};

function tokenLabel(addr: string): string {
  return TOKEN_LABELS[addr.toLowerCase()] || `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export interface UserPosition {
  tokenId: bigint;
  token0: string;
  token1: string;
  fee: number;
  feePct: string;
  tickLower: number;
  tickUpper: number;
  label: string;
}

// Standard v3 NonfungiblePositionManager ABI (works for Uni v3, Sushi v3, PCS v3)
const V3_PM_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "positions",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      { name: "nonce", type: "uint96" },
      { name: "operator", type: "address" },
      { name: "token0", type: "address" },
      { name: "token1", type: "address" },
      { name: "fee", type: "uint24" },
      { name: "tickLower", type: "int24" },
      { name: "tickUpper", type: "int24" },
      { name: "liquidity", type: "uint128" },
      { name: "feeGrowthInside0LastX128", type: "uint256" },
      { name: "feeGrowthInside1LastX128", type: "uint256" },
      { name: "tokensOwed0", type: "uint128" },
      { name: "tokensOwed1", type: "uint128" },
    ],
  },
] as const;

// Known v3 NonfungiblePositionManager addresses per DEX per chain
const V3_POSITION_MANAGERS: Record<string, Record<number, Address>> = {
  "uniswap-v3": {
    11155111: "0x1238536071E1c677A632429e3655c799b22cDA52",
    1: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
  },
  "sushiswap-v3": {
    11155111: "0x544bA588efD839d2692Fc31EA991cD39993c135F",
  },
  "pancakeswap-v3": {
    11155111: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  },
};

/**
 * Reads user's LP positions from the appropriate position manager
 * based on the selected DEX.
 */
export function useUserPositions(selectedDex: DexConfig | null, chainId: number) {
  const { address } = useAccount();

  // Determine which position manager to query
  const dexId = selectedDex?.id ?? "";
  const isV3 = dexId.includes("v3");
  const pmAddress = isV3
    ? V3_POSITION_MANAGERS[dexId]?.[chainId]
    : undefined; // v4 uses a different approach (handled separately if needed)

  const hasPM = !!pmAddress;

  // Read position count
  const { data: balanceData } = useReadContract({
    address: pmAddress,
    abi: V3_PM_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasPM },
  });

  const positionCount = balanceData ? Number(balanceData as bigint) : 0;

  // Read token IDs
  const tokenIdCalls = Array.from({ length: Math.min(positionCount, 50) }, (_, i) => ({
    address: pmAddress!,
    abi: V3_PM_ABI,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)] as const,
  }));

  const { data: tokenIdsData } = useReadContracts({
    contracts: tokenIdCalls,
    query: { enabled: positionCount > 0 && !!address && hasPM },
  });

  const tokenIds: bigint[] = (tokenIdsData || [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => r.result as bigint);

  // Read position details for each token (v3 positions() call)
  const positionCalls = tokenIds.map((id) => ({
    address: pmAddress!,
    abi: V3_PM_ABI,
    functionName: "positions" as const,
    args: [id] as const,
  }));

  const { data: positionData } = useReadContracts({
    contracts: positionCalls,
    query: { enabled: tokenIds.length > 0 && hasPM },
  });

  const positions: UserPosition[] = tokenIds.map((id, i) => {
    const result = positionData?.[i];
    if (!result || result.status !== "success" || !result.result) {
      return {
        tokenId: id,
        token0: "?",
        token1: "?",
        fee: 0,
        feePct: "?",
        tickLower: 0,
        tickUpper: 0,
        label: `Position #${id.toString()}`,
      };
    }

    const data = result.result as readonly [
      bigint, string, string, string, number, number, number, bigint,
      bigint, bigint, bigint, bigint
    ];
    const token0Addr = data[2] as string;
    const token1Addr = data[3] as string;
    const fee = Number(data[4]);
    const tickLower = Number(data[5]);
    const tickUpper = Number(data[6]);
    const t0 = tokenLabel(token0Addr);
    const t1 = tokenLabel(token1Addr);
    const feePct = (fee / 10000).toFixed(2);

    return {
      tokenId: id,
      token0: t0,
      token1: t1,
      fee,
      feePct: `${feePct}%`,
      tickLower,
      tickUpper,
      label: `${t0}/${t1} ${feePct}% #${id.toString()}`,
    };
  });

  return {
    positions,
    positionCount,
    isLoading: hasPM && positionCount > 0 && positions.length === 0,
    hasPositionManager: hasPM,
  };
}
