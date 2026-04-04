"use client";

import { useReadContract } from "wagmi";
import { useChainAddresses } from "./useILShield";

const AGGREGATOR_ABI = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
] as const;

export function useChainlinkPrice() {
  const addrs = useChainAddresses();

  const { data: roundData } = useReadContract({
    address: addrs.chainlinkEthUsd,
    abi: AGGREGATOR_ABI,
    functionName: "latestRoundData",
    query: { refetchInterval: 15_000 },
  });

  const { data: decimals } = useReadContract({
    address: addrs.chainlinkEthUsd,
    abi: AGGREGATOR_ABI,
    functionName: "decimals",
  });

  if (!roundData || !decimals) {
    return { price: 0, updatedAt: 0, decimals: 8, address: addrs.chainlinkEthUsd };
  }

  const [, answer, , updatedAt] = roundData;
  const price = Number(answer) / 10 ** Number(decimals);
  const secondsAgo = Math.max(0, Math.floor(Date.now() / 1000) - Number(updatedAt));

  return {
    price,
    updatedAt: secondsAgo,
    decimals: Number(decimals),
    address: addrs.chainlinkEthUsd,
  };
}
