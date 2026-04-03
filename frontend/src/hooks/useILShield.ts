"use client";

import { useAccount, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits, type Address } from "viem";
import { getAddresses, ERC20_ABI, IL_SHIELD_CORE_ABI, VAULT_ABI, DURATION_BLOCKS } from "@/lib/contracts";

/** Returns the correct contract addresses for the connected chain */
export function useChainAddresses() {
  const chainId = useChainId();
  return getAddresses(chainId);
}

export function useUSDCBalance() {
  const { address } = useAccount();
  const addrs = useChainAddresses();
  const { data, refetch } = useReadContract({
    address: addrs.USDC,
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
  const addrs = useChainAddresses();
  const { data, refetch } = useReadContract({
    address: addrs.USDC,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address ? [address, addrs.ILShieldCore] : undefined,
    query: { enabled: !!address },
  });
  return {
    raw: data as bigint | undefined,
    refetch,
  };
}

export function useApproveUSDC() {
  const addrs = useChainAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = (amount: string) => {
    const amountWei = parseUnits(amount, 6);
    writeContract({
      address: addrs.USDC,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [addrs.ILShieldCore, amountWei],
    });
  };

  return { approve, isPending, isConfirming, isSuccess, error, hash };
}

export function useRegister() {
  const addrs = useChainAddresses();
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
      address: addrs.ILShieldCore,
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
  const addrs = useChainAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const settle = (ilpnId: bigint, exitSqrtPriceX96: bigint) => {
    writeContract({
      address: addrs.ILShieldCore,
      abi: IL_SHIELD_CORE_ABI,
      functionName: "settle",
      args: [ilpnId, exitSqrtPriceX96, "0x"],
    });
  };

  return { settle, isPending, isConfirming, isSuccess, error, hash };
}

export function useCancelProtection() {
  const addrs = useChainAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancel = (ilpnId: bigint) => {
    writeContract({
      address: addrs.ILShieldCore,
      abi: IL_SHIELD_CORE_ABI,
      functionName: "cancelProtection",
      args: [ilpnId],
    });
  };

  return { cancel, isPending, isConfirming, isSuccess, error, hash };
}

export function useTopUpPremium() {
  const addrs = useChainAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const topUp = (ilpnId: bigint, amount: string) => {
    const amountWei = parseUnits(amount, 6);
    writeContract({
      address: addrs.ILShieldCore,
      abi: IL_SHIELD_CORE_ABI,
      functionName: "topUpPremium",
      args: [ilpnId, amountWei],
    });
  };

  return { topUp, isPending, isConfirming, isSuccess, error, hash };
}

export function useVaultDeposit(vault: "senior" | "junior") {
  const { address } = useAccount();
  const addrs = useChainAddresses();
  const vaultAddr = vault === "senior" ? addrs.SeniorVault : addrs.JuniorVault;
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
  const addrs = useChainAddresses();
  const vaultAddr = vault === "senior" ? addrs.SeniorVault : addrs.JuniorVault;
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
