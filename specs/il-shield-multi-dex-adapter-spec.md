# IL Shield — Multi-DEX Adapter Spec (Tier 1: Uniswap v3 Forks)

## Objective

Make IL Shield compatible with every major DEX that uses Uniswap v3's concentrated liquidity model. These DEXs share an identical position interface — same `NonfungiblePositionManager.positions()` return struct, same tick/liquidity math, same `sqrtPriceX96` encoding. The adapter is a thin contract that reads position data from each DEX's position manager and returns it in a standardized format that ILShieldCore already understands.

The UX must make it immediately obvious which DEXs are supported and let the user select their source DEX before entering a position ID.

---

## Supported DEXs (Tier 1)

All of these return the identical position struct from their NonfungiblePositionManager:

```
(nonce, operator, token0, token1, fee, tickLower, tickUpper, liquidity,
 feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1)
```

| DEX | Chains | Position Manager | Pool Factory |
|-----|--------|-----------------|--------------|
| **Uniswap v3** | Ethereum, Arbitrum, Optimism, Polygon, Base, BNB | Per-chain (see Uniswap docs) | Per-chain |
| **Uniswap v4** | Ethereum, Unichain | PositionManager (new) | Singleton PoolManager |
| **PancakeSwap v3** | BNB, Ethereum, Arbitrum, Base, zkSync, Linea, Polygon | `0x46a15b0b27311cedf172ab29e4f4766fbe7f4364` (BNB) | `0x0BFbCF9fa4f9c56b0F40a671Ad40E0805A091865` (BNB) |
| **SushiSwap v3** | Ethereum, Arbitrum, Polygon, Avalanche, 35+ chains | Per-chain (forked Uni v3 PM) | Per-chain |
| **Aerodrome** | Base | Velodrome-style NonfungiblePositionManager | Velodrome Factory |

---

## Contract Changes

### 1. IPositionAdapter Interface

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

interface IPositionAdapter {
    struct PositionData {
        uint160 sqrtPriceX96;      // pool's sqrtPriceX96 at time of read
        int24 tickLower;           // position's lower tick
        int24 tickUpper;           // position's upper tick
        uint128 liquidity;         // position's liquidity
        address token0;            // sorted token0
        address token1;            // sorted token1
        uint24 feeRate;            // pool fee in hundredths of a bip (3000 = 0.30%)
        address pool;              // pool contract address
    }

    /// @notice Read position data from the DEX's on-chain contracts
    function getPosition(uint256 positionId) external view returns (PositionData memory);

    /// @notice Read current pool price for a previously read position
    function getPoolPrice(address pool) external view returns (uint160 sqrtPriceX96);

    /// @notice Human-readable DEX name
    function dexName() external pure returns (string memory);

    /// @notice DEX identifier for the frontend (lowercase, no spaces)
    function dexId() external pure returns (string memory);
}
```

### 2. UniswapV3Adapter (reference implementation — works for all v3 forks)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPositionAdapter} from "../interfaces/IPositionAdapter.sol";

interface INonfungiblePositionManager {
    function positions(uint256 tokenId) external view returns (
        uint96 nonce,
        address operator,
        address token0,
        address token1,
        uint24 fee,
        int24 tickLower,
        int24 tickUpper,
        uint128 liquidity,
        uint256 feeGrowthInside0LastX128,
        uint256 feeGrowthInside1LastX128,
        uint128 tokensOwed0,
        uint128 tokensOwed1
    );
    function factory() external view returns (address);
}

interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address);
}

interface IUniswapV3Pool {
    function slot0() external view returns (
        uint160 sqrtPriceX96,
        int24 tick,
        uint16 observationIndex,
        uint16 observationCardinality,
        uint16 observationCardinalityNext,
        uint8 feeProtocol,
        bool unlocked
    );
}

/// @title UniswapV3Adapter
/// @notice Reads position data from any Uniswap v3 fork NonfungiblePositionManager.
/// @dev Works identically for Uniswap v3, PancakeSwap v3, SushiSwap v3 — just deploy
///      with the correct positionManager address for each DEX/chain combo.
contract UniswapV3Adapter is IPositionAdapter {
    INonfungiblePositionManager public immutable positionManager;
    IUniswapV3Factory public immutable factory;
    string private _dexName;
    string private _dexId;

    constructor(
        address _positionManager,
        string memory dexName_,
        string memory dexId_
    ) {
        positionManager = INonfungiblePositionManager(_positionManager);
        factory = IUniswapV3Factory(positionManager.factory());
        _dexName = dexName_;
        _dexId = dexId_;
    }

    function getPosition(uint256 positionId) external view override returns (PositionData memory data) {
        (
            ,                           // nonce
            ,                           // operator
            address token0,
            address token1,
            uint24 fee,
            int24 tickLower,
            int24 tickUpper,
            uint128 liquidity,
            ,,,                         // feeGrowth, tokensOwed
        ) = positionManager.positions(positionId);

        address pool = factory.getPool(token0, token1, fee);
        require(pool != address(0), "Pool not found");

        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();

        data = PositionData({
            sqrtPriceX96: sqrtPriceX96,
            tickLower: tickLower,
            tickUpper: tickUpper,
            liquidity: liquidity,
            token0: token0,
            token1: token1,
            feeRate: fee,
            pool: pool
        });
    }

    function getPoolPrice(address pool) external view override returns (uint160 sqrtPriceX96) {
        (sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
    }

    function dexName() external view override returns (string memory) { return _dexName; }
    function dexId() external view override returns (string memory) { return _dexId; }
}
```

**Key insight: this single contract works for Uniswap v3, PancakeSwap v3, and SushiSwap v3.** You deploy three instances with different constructor arguments:

```solidity
// Uniswap v3 on Ethereum mainnet
new UniswapV3Adapter(UNI_V3_POSITION_MANAGER, "Uniswap v3", "uniswap-v3");

// PancakeSwap v3 on BNB Chain
new UniswapV3Adapter(0x46a15b0b27311cedf172ab29e4f4766fbe7f4364, "PancakeSwap v3", "pancakeswap-v3");

// SushiSwap v3 on Arbitrum
new UniswapV3Adapter(SUSHI_V3_POSITION_MANAGER, "SushiSwap v3", "sushiswap-v3");
```

### 3. UniswapV4Adapter

Uniswap v4 uses a different position architecture (singleton PoolManager, no NFT-based positions in the same way). This needs its own adapter that reads from the v4 PositionManager.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IPositionAdapter} from "../interfaces/IPositionAdapter.sol";

/// @title UniswapV4Adapter
/// @notice Reads position data from Uniswap v4's PositionManager and StateView
contract UniswapV4Adapter is IPositionAdapter {
    address public immutable poolManager;
    address public immutable stateView;

    constructor(address _poolManager, address _stateView) {
        poolManager = _poolManager;
        stateView = _stateView;
    }

    function getPosition(uint256 positionId) external view override returns (PositionData memory data) {
        // v4 position reading logic via StateView
        // Implementation depends on the v4 periphery contracts
        // The PositionManager in v4 stores positions differently:
        // positionInfo mapping, not the v3 struct
        revert("V4 adapter: implement per v4 periphery API");
    }

    function getPoolPrice(address pool) external view override returns (uint160 sqrtPriceX96) {
        // Read from StateView.getSlot0(poolId)
        revert("V4 adapter: implement per v4 periphery API");
    }

    function dexName() external pure override returns (string memory) { return "Uniswap v4"; }
    function dexId() external pure override returns (string memory) { return "uniswap-v4"; }
}
```

### 4. AerodromeAdapter

Aerodrome (Velodrome v2 on Base) uses a similar but slightly different NonfungiblePositionManager. The `positions()` return struct may include gauge-related fields. Deploy a UniswapV3Adapter pointed at Aerodrome's position manager — if the struct matches, it works directly. If not, create a thin wrapper that strips the extra fields.

### 5. ILShieldCore Changes

Modify `register()` to accept an adapter address:

```solidity
// Add to state:
mapping(address => bool) public approvedAdapters;

// Add governance function:
function approveAdapter(address adapter, bool approved) external onlyRole(GOVERNANCE_ROLE) {
    approvedAdapters[adapter] = approved;
}

// Modify register():
function register(
    address adapter,              // NEW: which DEX adapter
    uint256 positionId,           // the DEX-specific position NFT ID
    uint8 coverageTier,
    uint48 durationBlocks,
    uint256 premiumDeposit,
    address referrer
) external nonReentrant whenNotPaused returns (uint256 ilpnId) {
    require(approvedAdapters[adapter], "Adapter not approved");
    
    // Read position data from the DEX
    IPositionAdapter.PositionData memory pos = IPositionAdapter(adapter).getPosition(positionId);
    require(pos.liquidity > 0, "Empty position");
    
    // ... rest of register logic, but now using:
    // pos.sqrtPriceX96 as entrySqrtPriceX96
    // pos.tickLower, pos.tickUpper, pos.liquidity
    // instead of hardcoded zeros
}
```

This is the only change to `src/core/ILShieldCore.sol`. Everything downstream (settlement, premium streaming, vault payout) operates on the stored Position struct as before.

---

## Deployment Plan

### Phase 1: Ethereum Sepolia (already deployed)
- Deploy `UniswapV3Adapter` pointed at Uniswap v3 Sepolia PM
- Deploy `UniswapV4Adapter` pointed at v4 Sepolia PM + StateView
- Call `core.approveAdapter()` for both
- Redeploy ILShieldCore with the new `register()` signature

### Phase 2: BNB Chain (testnet first, then mainnet)
- Deploy `UniswapV3Adapter("PancakeSwap v3", "pancakeswap-v3")` pointed at `0x46a15b0b...`
- Deploy IL Shield core contracts (same code, different chain)
- Configure PricingOracle with BNB/USD Chainlink feed

### Phase 3: Base
- Deploy `UniswapV3Adapter("Aerodrome", "aerodrome")` pointed at Aerodrome's PM
- Deploy IL Shield core contracts
- Configure with ETH/USD Chainlink on Base

### Phase 4: Arbitrum
- Deploy two adapters: Uniswap v3 + SushiSwap v3
- Deploy IL Shield core contracts
- Approve both adapters

---

## Frontend: DEX Selector UX

### Position Input — Before

```
┌──────────────────────────────────────────┐
│  Position                    [In range]  │
│  —                           ETH / USDC  │
│  Enter a Uniswap v4 position ID         │
└──────────────────────────────────────────┘
```

### Position Input — After

The position input card gets a DEX selector row at the top. It shows logos of all supported DEXs for the connected chain. Only DEXs available on the current chain are shown — if you're on BNB Chain, you see PancakeSwap and Uniswap v3 but not Aerodrome (Base-only). The selected DEX determines which adapter is called.

```
┌──────────────────────────────────────────┐
│  ┌────────────────────────────────────┐  │
│  │ [UNI✓] [PCS] [SUSHI] [AERO]       │  │
│  │  Uniswap v4                        │  │
│  └────────────────────────────────────┘  │
│                                          │
│  Position ID           [In range]        │
│  [_______________]     ETH / USDC        │
│  Paste your position NFT ID              │
│                                          │
│  ┌─ Position data (auto-populated) ──┐  │
│  │  Liquidity: $48,291               │  │
│  │  Range: $1,800 — $3,200           │  │
│  │  Entry price: $2,641              │  │
│  │  Current price: $2,048            │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

When the user enters a position ID and the selected DEX's adapter successfully reads it, the position data auto-populates below the input. If the position ID doesn't exist on the selected DEX, show an error: "Position not found on [DEX name]. Try a different DEX or check the ID."

### DEX Pill Component

```typescript
// components/DexSelector.tsx

interface DexConfig {
  id: string;           // "uniswap-v4", "pancakeswap-v3", etc.
  name: string;         // "Uniswap v4"
  shortName: string;    // "UNI v4"
  logo: string;         // path to logo SVG/PNG
  color: string;        // brand color for active state
  chains: number[];     // supported chain IDs
  adapter: Address;     // adapter contract address per chain
}

const DEX_REGISTRY: DexConfig[] = [
  {
    id: "uniswap-v4",
    name: "Uniswap v4",
    shortName: "UNI v4",
    logo: "/logos/uniswap.svg",
    color: "#FF007A",
    chains: [1, 11155111, 1301],  // mainnet, sepolia, unichain
    adapter: { 1: "0x...", 11155111: "0x...", 1301: "0x..." },
  },
  {
    id: "uniswap-v3",
    name: "Uniswap v3",
    shortName: "UNI v3",
    logo: "/logos/uniswap.svg",
    color: "#FF007A",
    chains: [1, 42161, 10, 137, 8453, 56],
    adapter: { 1: "0x...", 42161: "0x...", /* ... */ },
  },
  {
    id: "pancakeswap-v3",
    name: "PancakeSwap v3",
    shortName: "PCS v3",
    logo: "/logos/pancakeswap.svg",
    color: "#1FC7D4",
    chains: [56, 1, 42161, 8453, 324, 59144, 137],
    adapter: { 56: "0x...", 1: "0x...", /* ... */ },
  },
  {
    id: "sushiswap-v3",
    name: "SushiSwap v3",
    shortName: "SUSHI v3",
    logo: "/logos/sushiswap.svg",
    color: "#FA52A0",
    chains: [1, 42161, 137, 43114],
    adapter: { 1: "0x...", 42161: "0x...", /* ... */ },
  },
  {
    id: "aerodrome",
    name: "Aerodrome",
    shortName: "AERO",
    logo: "/logos/aerodrome.svg",
    color: "#0052FF",
    chains: [8453],  // Base only
    adapter: { 8453: "0x..." },
  },
];

function DexSelector({ chainId, selected, onSelect }) {
  // Filter to DEXs available on the connected chain
  const available = DEX_REGISTRY.filter(d => d.chains.includes(chainId));

  return (
    <div className="flex gap-1 bg-input rounded-xl p-1">
      {available.map(dex => (
        <button
          key={dex.id}
          onClick={() => onSelect(dex)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            selected.id === dex.id
              ? 'bg-card text-text1 shadow-sm'
              : 'text-text3 hover:text-text2'
          }`}
        >
          <img src={dex.logo} alt="" className="w-4 h-4" />
          {dex.shortName}
        </button>
      ))}
    </div>
  );
}
```

### Position Reading Hook

```typescript
// hooks/usePositionFromDex.ts

export function usePositionFromDex(dex: DexConfig, positionId: bigint, chainId: number) {
  const adapterAddress = dex.adapter[chainId];

  // All v3 forks use the same ABI for the adapter
  const { data, isLoading, error } = useReadContract({
    address: adapterAddress,
    abi: POSITION_ADAPTER_ABI,
    functionName: 'getPosition',
    args: [positionId],
    query: { enabled: !!adapterAddress && positionId > 0n },
  });

  return {
    position: data as PositionData | undefined,
    isLoading,
    error,
    dexName: dex.name,
  };
}

// The adapter ABI is identical for every DEX — that's the point of the adapter pattern
const POSITION_ADAPTER_ABI = [
  {
    inputs: [{ name: "positionId", type: "uint256" }],
    name: "getPosition",
    outputs: [{
      components: [
        { name: "sqrtPriceX96", type: "uint160" },
        { name: "tickLower", type: "int24" },
        { name: "tickUpper", type: "int24" },
        { name: "liquidity", type: "uint128" },
        { name: "token0", type: "address" },
        { name: "token1", type: "address" },
        { name: "feeRate", type: "uint24" },
        { name: "pool", type: "address" },
      ],
      type: "tuple",
    }],
    stateMutability: "view",
    type: "function",
  },
] as const;
```

### Updated register() Hook

```typescript
// hooks/useILShield.ts — updated register

export function useRegister() {
  const addrs = useChainAddresses();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const register = (params: {
    adapter: Address;               // NEW: the DEX adapter address
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
        params.adapter,                  // NEW: adapter address
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
```

---

## "Supported DEXs" Display

### On the landing page

Below the hero headline, show a row of supported DEX logos with a subtle label:

```
Protect LP positions on

[UNI logo]  [PCS logo]  [SUSHI logo]  [AERO logo]
Uniswap     PancakeSwap  SushiSwap    Aerodrome
```

This row adapts per chain — on BNB Chain it shows PancakeSwap first (largest there). On Base it highlights Aerodrome. On Ethereum it leads with Uniswap.

### On the protect screen

The DEX selector pills appear above the position ID input. The selected DEX's branding subtly tints the card — for example, selecting PancakeSwap adds a faint cyan glow to the position card border matching PancakeSwap's `#1FC7D4` brand color.

### On the active protection screen

Show the DEX logo + name next to the position info so the user always knows which DEX the protected position lives on:

```
[PCS logo]  PancakeSwap v3  ·  ETH/USDC 0.30%  ·  #58294
```

### On the settlement screen

Include the DEX in the settlement summary:

```
Source DEX:     PancakeSwap v3
Position:      #58294
Network:       BNB Chain
Coverage:      100%
Payout:        $1,031.42
```

---

## Test Plan for Multi-DEX

For each new adapter deployment:

1. **Read test:** Call `adapter.getPosition(knownPositionId)` and verify the returned struct matches on-chain data from the DEX's position manager directly
2. **Price test:** Call `adapter.getPoolPrice(pool)` and verify it matches the pool's `slot0().sqrtPriceX96`
3. **Register test:** Call `core.register(adapter, positionId, ...)` and verify the position is stored with correct entry price and liquidity
4. **Settle test:** Advance blocks, call `core.settle()` and verify IL is computed from the adapter-provided entry price vs a new price
5. **Cross-DEX test:** Register positions from two different DEXs in the same ILShieldCore deployment. Settle both. Verify both produce correct, independent IL calculations from the shared vault

---

## File Structure

```
src/
  interfaces/
    IPositionAdapter.sol          // Standardized adapter interface
  adapters/
    UniswapV3Adapter.sol          // Works for Uni v3, PCS v3, Sushi v3
    UniswapV4Adapter.sol          // v4 singleton + StateView
    AerodromeAdapter.sol          // If needed — may just be UniswapV3Adapter
  core/
    ILShieldCore.sol              // Modified register() to accept adapter
    ... (unchanged)

frontend/
  src/
    config/
      dex-registry.ts             // DEX configs, logos, chain mappings
    components/
      DexSelector.tsx             // Pill selector for DEX choice
      DexLogo.tsx                 // Renders DEX logo at various sizes
      SupportedDexRow.tsx         // Landing page DEX logos row
    hooks/
      usePositionFromDex.ts       // Reads position via adapter
```

---

## Scope Summary

| Item | Effort | Notes |
|------|--------|-------|
| `IPositionAdapter` interface | 1 hour | ~30 lines |
| `UniswapV3Adapter` (covers 3 DEXs) | 2 hours | ~100 lines, single contract for all v3 forks |
| `UniswapV4Adapter` | 4 hours | Needs v4-specific position reading |
| `AerodromeAdapter` | 2 hours | Verify if UniswapV3Adapter works directly |
| `ILShieldCore.register()` modification | 2 hours | Add adapter param + approved adapter mapping |
| Frontend `DexSelector` + registry | 4 hours | Component + config + logos |
| Frontend `usePositionFromDex` hook | 2 hours | Generic adapter reading |
| Tests per adapter | 2 hours each | 5 tests per adapter (read, price, register, settle, cross-DEX) |
| **Total** | **~3 days** | One adapter contract, deployed 3–4 times with different constructor args |

The critical realization: `UniswapV3Adapter.sol` is a single ~100 line contract that you deploy once per DEX per chain, each time with a different `positionManager` address and `dexName`. It is not three separate adapter contracts — it is one contract serving all Uniswap v3 forks.
