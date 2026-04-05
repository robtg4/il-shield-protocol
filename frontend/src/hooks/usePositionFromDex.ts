"use client";

import { useReadContract } from "wagmi";
import type { Address } from "viem";
import type { DexConfig } from "@/config/dex-registry";

export interface DexPositionData {
  sqrtPriceX96: bigint;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  token0: Address;
  token1: Address;
  feeRate: number;
  pool: Address;
}

const POSITION_ADAPTER_ABI = [
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "getPosition",
    outputs: [
      {
        components: [
          { name: "sqrtPriceX96", type: "uint160" },
          { name: "tickLower", type: "int24" },
          { name: "tickUpper", type: "int24" },
          { name: "liquidity", type: "uint128" },
          { name: "token0", type: "address" },
          { name: "token1", type: "address" },
          { name: "feeRate", type: "uint24" },
          { name: "pool", type: "address" },
        ],
        type: "tuple",
      },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "pool", type: "address" }],
    name: "getPoolPrice",
    outputs: [{ name: "sqrtPriceX96", type: "uint160" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

export function usePositionFromDex(
  dex: DexConfig | null,
  positionId: bigint | null,
  chainId: number
) {
  const adapterAddress = dex?.adapters[chainId] as Address | undefined;
  const hasAdapter = !!adapterAddress && adapterAddress !== "0x0000000000000000000000000000000000000000";

  const { data, isLoading, error } = useReadContract({
    address: adapterAddress,
    abi: POSITION_ADAPTER_ABI,
    functionName: "getPosition",
    args: positionId !== null ? [positionId] : undefined,
    query: { enabled: hasAdapter && positionId !== null && positionId > BigInt(0) },
  });

  const position = data as DexPositionData | undefined;

  return {
    position,
    isLoading: hasAdapter ? isLoading : false,
    error,
    dexName: dex?.name ?? "",
    hasAdapter,
  };
}
