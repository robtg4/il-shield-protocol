"use client";

import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { useChainAddresses } from "./useILShield";
import {
  POSITION_MANAGER_ABI,
  decodePositionInfo,
} from "@/lib/positionManager";

const TOKEN_LABELS: Record<string, string> = {
  "0x0000000000000000000000000000000000000000": "ETH",
  "0x4200000000000000000000000000000000000006": "WETH",
  "0x31d0220469e10c4e71834a79b1f276d740d3768f": "USDC",
  "0xc6ffea5afaf2fd72cf00140dd3dda8841682128e": "USDC",
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
  label: string; // "ETH/USDC 0.30% #123"
}

export function useUserPositions() {
  const { address } = useAccount();
  const addrs = useChainAddresses();
  const pmAddress = addrs.v4PositionManager as `0x${string}`;
  const hasPositionManager = pmAddress !== "0x0000000000000000000000000000000000000000";

  // Read position count
  const { data: balanceData } = useReadContract({
    address: pmAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && hasPositionManager },
  });

  const positionCount = balanceData ? Number(balanceData as bigint) : 0;

  // Read token IDs
  const tokenIdCalls = Array.from({ length: Math.min(positionCount, 50) }, (_, i) => ({
    address: pmAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: "tokenOfOwnerByIndex" as const,
    args: [address!, BigInt(i)] as const,
  }));

  const { data: tokenIdsData } = useReadContracts({
    contracts: tokenIdCalls,
    query: { enabled: positionCount > 0 && !!address && hasPositionManager },
  });

  const tokenIds: bigint[] = (tokenIdsData || [])
    .filter((r) => r.status === "success" && r.result !== undefined)
    .map((r) => r.result as bigint);

  // Read pool + position info for each token
  const infoCalls = tokenIds.map((id) => ({
    address: pmAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: "getPoolAndPositionInfo" as const,
    args: [id] as const,
  }));

  const { data: infoData } = useReadContracts({
    contracts: infoCalls,
    query: { enabled: tokenIds.length > 0 && hasPositionManager },
  });

  const positions: UserPosition[] = tokenIds.map((id, i) => {
    const result = infoData?.[i];
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

    const [poolKey, packedInfo] = result.result as [
      { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string },
      bigint,
    ];
    const info = decodePositionInfo(packedInfo);
    const t0 = tokenLabel(poolKey.currency0);
    const t1 = tokenLabel(poolKey.currency1);
    const feePct = (Number(poolKey.fee) / 10000).toFixed(2);

    return {
      tokenId: id,
      token0: t0,
      token1: t1,
      fee: Number(poolKey.fee),
      feePct: `${feePct}%`,
      tickLower: info.tickLower,
      tickUpper: info.tickUpper,
      label: `${t0}/${t1} ${feePct}% #${id.toString()}`,
    };
  });

  return {
    positions,
    positionCount,
    isLoading: positionCount > 0 && positions.length === 0,
    hasPositionManager,
  };
}
