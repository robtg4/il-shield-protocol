// Contract addresses — Unichain Sepolia deployment (2026-04-02)
export const ADDRESSES = {
  ILShieldCore: "0x5CbE5E8Dce54091f9e19A986f49289b4f29771d1" as `0x${string}`,
  SeniorVault: "0xBC021bA9301F1c62AE0Aa51aC6cdee5C85861d0B" as `0x${string}`,
  JuniorVault: "0x56343693d78a4FcE2c882c8ad86D81127C7F46cf" as `0x${string}`,
  ILPNRegistry: "0x4C94377DdDCeFa10d0c2473B92f7dC9E2f5e8b7f" as `0x${string}`,
  PricingOracle: "0x7D9E7B8cFa3D3607a73EFd880888da1eBB19CAee" as `0x${string}`,
  USDC: "0x31d0220469e10c4E71834a79b1f276d740d3768F" as `0x${string}`,
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
