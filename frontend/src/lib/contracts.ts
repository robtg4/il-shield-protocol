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

// Ethereum Sepolia V3 (adapter + unit-fix redeploy)
const SEPOLIA: ChainAddresses = {
  ILShieldCore: "0x772F171b0b382D26961E3803c7FB1f206102a236",
  SeniorVault: "0x71A79914bd89CA46D73Dd645357aC076f524C678",
  JuniorVault: "0xE4cf05DdE8c5f299C3798a49e2A6Be596C3b7E7d",
  ILPNRegistry: "0x923721cC1c1f2C92F855993808d8a4e4a6AE189C",
  PricingOracle: "0xa225407cC259241CeA87a4007443da5BcFF180F0",
  USDC: "0xaBb5f3CBA569365E8059088376c0008bFE280822",
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
      { name: "adapter", type: "address" },
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
