"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import type { Address } from "viem";
import type { DexConfig } from "@/config/dex-registry";
import { useChainAddresses } from "./useILShield";

const TOKEN_LABELS: Record<string, string> = {
  "0x0000000000000000000000000000000000000000": "ETH",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0xfff9976782d46cc05630d1f6ebab18b2324d6b14": "WETH",
  "0x31d0220469e10c4e71834a79b1f276d740d3768f": "USDC",
  "0xc6ffea5afaf2fd72cf00140dd3dda8841682128e": "USDC",
  "0x54738b6d21e9b3091f9cf82f9d3cf0d05ae4040a": "USDC",
  "0x6f79350e44a35225870e5fddf55b17574fd77d1a": "USDC",
  "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984": "UNI",
  "0x1c7d4b196cb0c7b01d743fbc6116a902379c7238": "USDC",
  "0x677aa002e57291409800a6748a870b8fefe1c5d2": "LINK",
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
  liquidity: bigint;
  label: string;
}

// ──────────────────────────────────────────────────────────────────
// V3 ABI (Uni v3, Sushi v3, PCS v3 — all identical)
// ──────────────────────────────────────────────────────────────────
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

// ──────────────────────────────────────────────────────────────────
// V4 ABI (Uniswap v4 PositionManager — different struct)
// ──────────────────────────────────────────────────────────────────
const V4_PM_ABI = [
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
    name: "getPoolAndPositionInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "info", type: "uint256" },
    ],
  },
] as const;

// ──────────────────────────────────────────────────────────────────
// Known position manager addresses per DEX per chain
// ──────────────────────────────────────────────────────────────────
const V3_POSITION_MANAGERS: Record<string, Record<number, Address>> = {
  "uniswap-v3": {
    1: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88",
    11155111: "0x1238536071E1c677A632429e3655c799b22cDA52",
  },
  "sushiswap-v3": {
    11155111: "0x544bA588efD839d2692Fc31EA991cD39993c135F",
  },
  "pancakeswap-v3": {
    11155111: "0x46A15B0b27311cedF172AB29E4f4766fbE7F4364",
  },
};

const V4_POSITION_MANAGERS: Record<number, Address> = {
  11155111: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4",
};

// ──────────────────────────────────────────────────────────────────
// Decode v4 packed PositionInfo
// ──────────────────────────────────────────────────────────────────
function unpackInt24(val: number): number {
  return val >= 0x800000 ? val - 0x1000000 : val;
}

function decodeV4PositionInfo(packed: bigint) {
  const tickLower = unpackInt24(Number((packed >> BigInt(8)) & BigInt(0xffffff)));
  const tickUpper = unpackInt24(Number((packed >> BigInt(32)) & BigInt(0xffffff)));
  return { tickLower, tickUpper };
}

// ──────────────────────────────────────────────────────────────────
// V3 position reading
// ──────────────────────────────────────────────────────────────────
function useV3Positions(pmAddress: Address | undefined, enabled: boolean) {
  const { address } = useAccount();

  const { data: balanceData } = useReadContract({
    address: pmAddress,
    abi: V3_PM_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address && !!pmAddress },
  });

  const count = balanceData ? Number(balanceData as bigint) : 0;

  const tokenIdCalls = Array.from({ length: Math.min(count, 50) }, (_, i) => ({
    address: pmAddress!,
    abi: V3_PM_ABI,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)] as const,
  }));

  const { data: idsData } = useReadContracts({
    contracts: tokenIdCalls,
    query: { enabled: count > 0 && !!address && !!pmAddress },
  });

  const tokenIds: bigint[] = (idsData || [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => r.result as bigint);

  const posCalls = tokenIds.map((id) => ({
    address: pmAddress!,
    abi: V3_PM_ABI,
    functionName: "positions" as const,
    args: [id] as const,
  }));

  const { data: posData } = useReadContracts({
    contracts: posCalls,
    query: { enabled: tokenIds.length > 0 && !!pmAddress },
  });

  const positions: UserPosition[] = tokenIds.map((id, i) => {
    const result = posData?.[i];
    if (!result || result.status !== "success" || !result.result) {
      return { tokenId: id, token0: "?", token1: "?", fee: 0, feePct: "?", tickLower: 0, tickUpper: 0, liquidity: BigInt(0), label: `#${id.toString()}` };
    }
    const d = result.result as readonly [bigint, string, string, string, number, number, number, bigint, bigint, bigint, bigint, bigint];
    const t0 = tokenLabel(d[2] as string);
    const t1 = tokenLabel(d[3] as string);
    const fee = Number(d[4]);
    const feePct = (fee / 10000).toFixed(2);
    return {
      tokenId: id, token0: t0, token1: t1, fee, feePct: `${feePct}%`,
      tickLower: Number(d[5]), tickUpper: Number(d[6]),
      liquidity: d[7] as bigint,
      label: `${t0}/${t1} ${feePct}% #${id.toString()}`,
    };
  });

  return { positions, count, isLoading: count > 0 && positions.length === 0 };
}

// ──────────────────────────────────────────────────────────────────
// V4 position reading
// ──────────────────────────────────────────────────────────────────
function useV4Positions(pmAddress: Address | undefined, enabled: boolean) {
  const { address } = useAccount();

  const { data: balanceData } = useReadContract({
    address: pmAddress,
    abi: V4_PM_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: enabled && !!address && !!pmAddress },
  });

  const count = balanceData ? Number(balanceData as bigint) : 0;

  const tokenIdCalls = Array.from({ length: Math.min(count, 50) }, (_, i) => ({
    address: pmAddress!,
    abi: V4_PM_ABI,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)] as const,
  }));

  const { data: idsData } = useReadContracts({
    contracts: tokenIdCalls,
    query: { enabled: count > 0 && !!address && !!pmAddress },
  });

  const tokenIds: bigint[] = (idsData || [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => r.result as bigint);

  const infoCalls = tokenIds.map((id) => ({
    address: pmAddress!,
    abi: V4_PM_ABI,
    functionName: "getPoolAndPositionInfo" as const,
    args: [id] as const,
  }));

  const { data: infoData } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: tokenIds.length > 0 && !!pmAddress },
  });

  const positions: UserPosition[] = tokenIds.map((id, i) => {
    const result = infoData?.[i];
    if (!result || result.status !== "success" || !result.result) {
      return { tokenId: id, token0: "?", token1: "?", fee: 0, feePct: "?", tickLower: 0, tickUpper: 0, liquidity: BigInt(0), label: `#${id.toString()}` };
    }
    const [poolKey, packedInfo] = result.result as [
      { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string },
      bigint,
    ];
    const info = decodeV4PositionInfo(packedInfo);
    const t0 = tokenLabel(poolKey.currency0);
    const t1 = tokenLabel(poolKey.currency1);
    const feePct = (Number(poolKey.fee) / 10000).toFixed(2);
    return {
      tokenId: id, token0: t0, token1: t1, fee: Number(poolKey.fee), feePct: `${feePct}%`,
      tickLower: info.tickLower, tickUpper: info.tickUpper,
      liquidity: BigInt(0), // v4 liquidity requires separate StateView call
      label: `${t0}/${t1} ${feePct}% #${id.toString()}`,
    };
  });

  return { positions, count, isLoading: count > 0 && positions.length === 0 };
}

// ──────────────────────────────────────────────────────────────────
// Main hook — routes to v3 or v4 based on selected DEX
// ──────────────────────────────────────────────────────────────────
export function useUserPositions(selectedDex: DexConfig | null, chainId: number) {
  const dexId = selectedDex?.id ?? "";
  const isV4 = dexId === "uniswap-v4";
  const isV3 = dexId.includes("v3");

  const v3PM = isV3 ? V3_POSITION_MANAGERS[dexId]?.[chainId] : undefined;
  const v4PM = isV4 ? V4_POSITION_MANAGERS[chainId] : undefined;

  const v3 = useV3Positions(v3PM, isV3);
  const v4 = useV4Positions(v4PM, isV4);

  if (isV4) {
    return {
      positions: v4.positions,
      positionCount: v4.count,
      isLoading: v4.isLoading,
      hasPositionManager: !!v4PM,
    };
  }

  return {
    positions: v3.positions,
    positionCount: v3.count,
    isLoading: v3.isLoading,
    hasPositionManager: !!v3PM,
  };
}
