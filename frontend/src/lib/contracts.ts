type Addr = `0x${string}`;

interface ChainAddresses {
  ILShieldCore: Addr;
  SeniorVault: Addr;
  JuniorVault: Addr;
  ILPNRegistry: Addr;
  PricingOracle: Addr;
  USDC: Addr;
  chainlinkEthUsd: Addr;
  v4PoolManager: Addr;
  v4PositionManager: Addr;
  explorerUrl: string;
  explorerName: string;
}

// Ethereum Sepolia V2 (live Chainlink + Uniswap v4 + adapter support)
const SEPOLIA: ChainAddresses = {
  ILShieldCore: "0xdbB160dc5f8e00A8f216042F6b1Dc16055B10722",
  SeniorVault: "0xc4887c6e2b28b8E7c4c068f5e5e10Ab469EAEb0F",
  JuniorVault: "0x6e7171177d5b321cBa8791C367d354ce089110cB",
  ILPNRegistry: "0xfE0865A25b263B700C9724431A3D2bF0d3d34c63",
  PricingOracle: "0x3BD63791f0308029F66448DB037fBe6F7A4a4733",
  USDC: "0x54738B6D21E9b3091f9CF82f9d3cf0d05aE4040A",
  chainlinkEthUsd: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
  v4PoolManager: "0xE03A1074c86CFeDd5C142C4F04F1a1536e203543",
  v4PositionManager: "0x429ba70129df741B2Ca2a85BC3A2a3328e5c09b4",
  explorerUrl: "https://sepolia.etherscan.io",
  explorerName: "Etherscan",
};

// Unichain Sepolia (secondary — mock Chainlink, hook testing)
const UNICHAIN_SEPOLIA: ChainAddresses = {
  ILShieldCore: "0x5CbE5E8Dce54091f9e19A986f49289b4f29771d1",
  SeniorVault: "0xBC021bA9301F1c62AE0Aa51aC6cdee5C85861d0B",
  JuniorVault: "0x56343693d78a4FcE2c882c8ad86D81127C7F46cf",
  ILPNRegistry: "0x4C94377DdDCeFa10d0c2473B92f7dC9E2f5e8b7f",
  PricingOracle: "0x7D9E7B8cFa3D3607a73EFd880888da1eBB19CAee",
  USDC: "0x31d0220469e10c4E71834a79b1f276d740d3768F",
  chainlinkEthUsd: "0x8BDE08C4BD88dbE16561F2990D7DE75B76Fc3752", // MockFeed
  v4PoolManager: "0x0000000000000000000000000000000000000000",
  v4PositionManager: "0x0000000000000000000000000000000000000000",
  explorerUrl: "https://sepolia.uniscan.xyz",
  explorerName: "Uniscan",
};

export const CHAIN_CONFIGS: Record<number, ChainAddresses> = {
  11155111: SEPOLIA,
  1301: UNICHAIN_SEPOLIA,
};

// Default to Sepolia
export const DEFAULT_CHAIN_ID = 11155111;

export function getAddresses(chainId: number | undefined): ChainAddresses {
  return CHAIN_CONFIGS[chainId ?? DEFAULT_CHAIN_ID] ?? SEPOLIA;
}

export const ERC20_ABI = [
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
] as const;

export const IL_SHIELD_CORE_ABI = [
  {
    name: "register",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "positionId", type: "uint256" },
      { name: "coverageTier", type: "uint8" },
      { name: "durationBlocks", type: "uint48" },
      { name: "premiumDeposit", type: "uint256" },
      { name: "referrer", type: "address" },
    ],
    outputs: [{ name: "ilpnId", type: "uint256" }],
  },
  {
    name: "settle",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ilpnId", type: "uint256" },
      { name: "settlementSqrtPriceX96", type: "uint160" },
      { name: "brevisProof", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "topUpPremium",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "ilpnId", type: "uint256" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "cancelProtection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "ilpnId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "processStreaming",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "ilpnIds", type: "uint256[]" }],
    outputs: [],
  },
] as const;

export const VAULT_ABI = [
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assets", type: "uint256" },
      { name: "receiver", type: "address" },
      { name: "owner", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "totalAssets",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
] as const;

// Duration in blocks (12s per block)
export const DURATION_BLOCKS: Record<string, number> = {
  "7d": 50_400,
  "30d": 216_000,
  "90d": 648_000,
  "180d": 1_296_000,
};
