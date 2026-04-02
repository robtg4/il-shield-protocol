"use client";

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import { ADDRESSES, ERC20_ABI, IL_SHIELD_CORE_ABI, VAULT_ABI, DURATION_BLOCKS } from "@/lib/contracts";

export function useUSDCBalance() {
  const { address } = useAccount();
  const { data, refetch } = useReadContract({
    address: ADDRESSES.USDC,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
  return {
    raw: data as bigint | undefined,
    formatted: data ? formatUnits(data as bigint, 6) : "0",
    refetch,
  };
}

export function useUSDCAllowance() {
  const { address } = useAccount();
  const { data, refetch } = useReadContract({
    address: ADDRESSES.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, ADDRESSES.ILShieldCore] : undefined,
    query: { enabled: !!address },
  });
  return {
    raw: data as bigint | undefined,
    refetch,
  };
}

export function useApproveUSDC() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (amount: string) => {
    const amountWei = parseUnits(amount, 6);
    writeContract({
      address: ADDRESSES.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [ADDRESSES.ILShieldCore, amountWei],
    });
  };

  return { approve, isPending, isConfirming, isSuccess, error, hash };
}

export function useRegister() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = (params: {
    positionId: bigint;
    coverageTier: number;
    duration: string;
    premiumAmount: string;
    referrer?: Address;
  }) => {
    const durationBlocks = DURATION_BLOCKS[params.duration] || DURATION_BLOCKS["30d"];
    const premiumWei = parseUnits(params.premiumAmount, 6);

    writeContract({
      address: ADDRESSES.ILShieldCore,
      abi: IL_SHIELD_CORE_ABI,
      functionName: "register",
      args: [
        params.positionId,
        params.coverageTier,
        durationBlocks,
        premiumWei,
        params.referrer || "0x0000000000000000000000000000000000000000",
      ],
    });
  };

  return { register, isPending, isConfirming, isSuccess, error, hash };
}

export function useSettle() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const settle = (ilpnId: bigint, exitSqrtPriceX96: bigint) => {
    writeContract({
      address: ADDRESSES.ILShieldCore,
      abi: IL_SHIELD_CORE_ABI,
      functionName: "settle",
      args: [ilpnId, exitSqrtPriceX96, "0x"],
    });
  };

  return { settle, isPending, isConfirming, isSuccess, error, hash };
}

export function useCancelProtection() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancel = (ilpnId: bigint) => {
    writeContract({
      address: ADDRESSES.ILShieldCore,
      abi: IL_SHIELD_CORE_ABI,
      functionName: "cancelProtection",
      args: [ilpnId],
    });
  };

  return { cancel, isPending, isConfirming, isSuccess, error, hash };
}

export function useTopUpPremium() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const topUp = (ilpnId: bigint, amount: string) => {
    const amountWei = parseUnits(amount, 6);
    writeContract({
      address: ADDRESSES.ILShieldCore,
      abi: IL_SHIELD_CORE_ABI,
      functionName: "topUpPremium",
      args: [ilpnId, amountWei],
    });
  };

  return { topUp, isPending, isConfirming, isSuccess, error, hash };
}

export function useVaultDeposit(vault: "senior" | "junior") {
  const { address } = useAccount();
  const vaultAddr = vault === "senior" ? ADDRESSES.SeniorVault : ADDRESSES.JuniorVault;
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const deposit = (amount: string) => {
    if (!address) return;
    const amountWei = parseUnits(amount, 6);
    writeContract({
      address: vaultAddr,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [amountWei, address],
    });
  };

  return { deposit, isPending, isConfirming, isSuccess, error, hash };
}

export function useVaultTotalAssets(vault: "senior" | "junior") {
  const vaultAddr = vault === "senior" ? ADDRESSES.SeniorVault : ADDRESSES.JuniorVault;
  const { data } = useReadContract({
    address: vaultAddr,
    abi: VAULT_ABI,
    functionName: "totalAssets",
  });
  return {
    raw: data as bigint | undefined,
    formatted: data ? formatUnits(data as bigint, 6) : "0",
  };
}
