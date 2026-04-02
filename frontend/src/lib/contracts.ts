// Contract addresses — update after deployment
export const ADDRESSES = {
  ILShieldCore: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  SeniorVault: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  JuniorVault: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  ILPNRegistry: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  PricingOracle: "0x0000000000000000000000000000000000000000" as `0x${string}`,
  USDC: "0x0000000000000000000000000000000000000000" as `0x${string}`,
} as const;

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
