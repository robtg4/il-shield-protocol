// Uniswap v4 PositionManager on Unichain Sepolia
// Update this address after confirming the deployment
export const POSITION_MANAGER_ADDRESS = "0xB433cB0BEE1b1517C06B52DBCB22B41e6DFdEadC" as `0x${string}`;

export const POSITION_MANAGER_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "tokenOfOwnerByIndex",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "positionInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "uint256" }], // packed PositionInfo
  },
  {
    name: "getPoolAndPositionInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [
      {
        name: "poolKey",
        type: "tuple",
        components: [
          { name: "currency0", type: "address" },
          { name: "currency1", type: "address" },
          { name: "fee", type: "uint24" },
          { name: "tickSpacing", type: "int24" },
          { name: "hooks", type: "address" },
        ],
      },
      { name: "info", type: "uint256" },
    ],
  },
  {
    name: "nextTokenId",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ type: "address" }],
  },
] as const;

// Decode packed PositionInfo: 200 bits poolId | 24 bits tickUpper | 24 bits tickLower | 8 bits hasSubscriber
export function decodePositionInfo(packed: bigint) {
  const hasSubscriber = Number(packed & BigInt(0xff));
  const tickLower = unpackInt24(Number((packed >> BigInt(8)) & BigInt(0xffffff)));
  const tickUpper = unpackInt24(Number((packed >> BigInt(32)) & BigInt(0xffffff)));
  const poolIdTruncated = packed >> BigInt(56);
  return { poolIdTruncated, tickLower, tickUpper, hasSubscriber: hasSubscriber !== 0 };
}

function unpackInt24(val: number): number {
  // Convert uint24 to int24
  return val >= 0x800000 ? val - 0x1000000 : val;
}
