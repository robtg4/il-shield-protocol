"use client";

import { useAccount, useReadContract } from "wagmi";
import { useChainAddresses } from "./useILShield";
import { VAULT_ABI, ERC20_ABI } from "@/lib/contracts";

export interface VaultAnalytics {
  totalAssets: bigint;
  totalAssetsUSD: number;
  totalSupply: bigint;
  sharePrice: number;
  userShares: bigint;
  userAssetsUSD: number;
  userSharePct: number;
  // Estimated yield from premium income
  estimatedAPY: number;
}

export function useVaultAnalytics(vault: "senior" | "junior"): VaultAnalytics & { isLoading: boolean } {
  const { address } = useAccount();
  const addrs = useChainAddresses();
  const vaultAddr = vault === "senior" ? addrs.SeniorVault : addrs.JuniorVault;

  const { data: totalAssetsData } = useReadContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "totalAssets",
    query: { refetchInterval: 15_000 },
  });

  const { data: totalSupplyData } = useReadContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "totalSupply",
    query: { refetchInterval: 15_000 },
  });

  const { data: userSharesData } = useReadContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const { data: userAssetsData } = useReadContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "convertToAssets",
    args: userSharesData ? [userSharesData as bigint] : undefined,
    query: { enabled: !!userSharesData && (userSharesData as bigint) > BigInt(0) },
  });

  const totalAssets = (totalAssetsData as bigint) || BigInt(0);
  const totalSupply = (totalSupplyData as bigint) || BigInt(0);
  const userShares = (userSharesData as bigint) || BigInt(0);
  const userAssets = (userAssetsData as bigint) || BigInt(0);

  const totalAssetsUSD = Number(totalAssets) / 1e6;
  const userAssetsUSD = Number(userAssets) / 1e6;
  const sharePrice = totalSupply > BigInt(0)
    ? Number(totalAssets) / Number(totalSupply) * 1e6 // Adjust for virtual offset
    : 1;
  const userSharePct = totalSupply > BigInt(0) && userShares > BigInt(0)
    ? (Number(userShares) / Number(totalSupply)) * 100
    : 0;

  // Estimated APY based on premium share splits
  // Senior gets 70% of premiums, Junior gets 15%
  // This is illustrative — real APY depends on premium volume
  const estimatedAPY = vault === "senior" ? 8 : 25;

  return {
    totalAssets,
    totalAssetsUSD,
    totalSupply,
    sharePrice,
    userShares,
    userAssetsUSD,
    userSharePct,
    estimatedAPY,
    isLoading: !totalAssetsData,
  };
}
