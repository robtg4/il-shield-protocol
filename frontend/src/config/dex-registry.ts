import type { Address } from "viem";

export interface DexConfig {
  id: string;
  name: string;
  shortName: string;
  color: string;
  chains: number[];
  adapters: Record<number, Address>;
}

export const DEX_REGISTRY: DexConfig[] = [
  {
    id: "uniswap-v4",
    name: "Uniswap v4",
    shortName: "UNI v4",
    color: "#FF007A",
    chains: [1, 11155111, 1301],
    adapters: {
      11155111: "0xd619aff860efae0cea17ba91dbb916f29f2024bf",
      1301: "0x0000000000000000000000000000000000000000",
    },
  },
  {
    id: "uniswap-v3",
    name: "Uniswap v3",
    shortName: "UNI v3",
    color: "#FF007A",
    chains: [1, 42161, 10, 137, 8453, 56, 11155111],
    adapters: {
      11155111: "0x0000000000000000000000000000000000000000",
    },
  },
  {
    id: "pancakeswap-v3",
    name: "PancakeSwap v3",
    shortName: "PCS v3",
    color: "#1FC7D4",
    chains: [56, 1, 42161, 8453, 324, 59144, 137],
    adapters: {},
  },
  {
    id: "sushiswap-v3",
    name: "SushiSwap v3",
    shortName: "SUSHI v3",
    color: "#FA52A0",
    chains: [1, 42161, 137, 43114],
    adapters: {},
  },
  {
    id: "aerodrome",
    name: "Aerodrome",
    shortName: "AERO",
    color: "#0052FF",
    chains: [8453],
    adapters: {},
  },
];

const ZERO = "0x0000000000000000000000000000000000000000";

/** Get all DEXs that list this chain (for display purposes) */
export function getDexesForChain(chainId: number): DexConfig[] {
  return DEX_REGISTRY.filter((d) => d.chains.includes(chainId));
}

/** Get only DEXs with a deployed (non-zero) adapter on this chain */
export function getDeployedDexesForChain(chainId: number): DexConfig[] {
  return DEX_REGISTRY.filter(
    (d) => d.chains.includes(chainId) && d.adapters[chainId] && d.adapters[chainId] !== ZERO
  );
}

/** Get a DEX by id */
export function getDexById(id: string): DexConfig | undefined {
  return DEX_REGISTRY.find((d) => d.id === id);
}
