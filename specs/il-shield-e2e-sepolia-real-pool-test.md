# IL Shield — End-to-End Manual Test on Ethereum Sepolia

Complete walkthrough using a **real WETH/USDC pool on Uniswap v3 Sepolia** anchored to the **live Chainlink ETH/USD feed**. This is the only way to get meaningful IL math on testnet — the pool price genuinely tracks real ETH, so the oracle price anchor is valid and settlement produces real, verifiable IL calculations.

Total time: ~30 minutes. No mainnet funds required.

---

## Why This Works Without Mainnet

Mainnet testing requires real money because IL only matters when the pool price reflects real asset prices. On testnet, if you LP into a made-up TokenA/TokenB pool and configure it against Chainlink ETH/USD, the numbers are nonsense — the Chainlink feed tracks real ETH, but your pool tracks fake tokens.

**The fix:** Uniswap v3 on Sepolia has live WETH/USDC pools that have existed for 2+ years, hold ~$144M in simulated liquidity, and track a price that's close enough to real ETH/USD for the Chainlink feed to be a meaningful anchor. When we LP into this pool, the pool's `sqrtPriceX96` corresponds to an ETH/USD rate, and Chainlink's feed is the correct price oracle for computing IL against entry.

---

## Anchor Infrastructure (Live Sepolia)

**Uniswap v3 Sepolia WETH/USDC 0.3% pool:**
```
Pool:              0xe5e20f2977b83d39421e7b0c81f35c128e05d70d
WETH:              0xfff9976782d46cc05630d1f6ebab18b2324d6b14
USDC (Sepolia):    (token1 of the pool — read from pool.token1())
PositionManager:   0x1238536071E1c677A632429e3655c799b22cDA52
Factory:           0x0227628f3F023bb0B980b67D528571c95c6DaC1c
```

**IL Shield V2 Contracts:**
```
TestUSDC:          0x54738B6D21E9b3091f9CF82f9d3cf0d05aE4040A
ILShieldCore:      0xdbB160dc5f8e00A8f216042F6b1Dc16055B10722
SeniorVault:       0xc4887c6e2b28b8E7c4c068f5e5e10Ab469EAEb0F
JuniorVault:       0x6e7171177d5b321cBa8791C367d354ce089110cB
ILPNRegistry:      0xfE0865A25b263B700C9724431A3D2bF0d3d34c63
PricingOracle:     0x3BD63791f0308029F66448DB037fBe6F7A4a4733
V3 Adapter:        0x89ea6bde36bb30bd8594f5855534f05866f3df26
Chainlink ETH/USD: 0x694AA1769357215DE4FAC081bf1f309aDC325306
```

**Important:** We use the **Uniswap v3 adapter** (not v4) because the real anchor pool exists on v3 and has had real trading activity for years. The v3 NonfungiblePositionManager returns the exact position data the adapter needs.

---

## Environment Setup (2 min)

```bash
export RPC=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
export KEY=0xYOUR_PRIVATE_KEY
export WALLET=$(cast wallet address --private-key $KEY)

# IL Shield contracts
export ILSHIELD_USDC=0x54738B6D21E9b3091f9CF82f9d3cf0d05aE4040A
export CORE=0xdbB160dc5f8e00A8f216042F6b1Dc16055B10722
export SENIOR=0xc4887c6e2b28b8E7c4c068f5e5e10Ab469EAEb0F
export JUNIOR=0x6e7171177d5b321cBa8791C367d354ce089110cB
export ILPN=0xfE0865A25b263B700C9724431A3D2bF0d3d34c63
export ORACLE=0x3BD63791f0308029F66448DB037fBe6F7A4a4733
export ADAPTER=0x89ea6bde36bb30bd8594f5855534f05866f3df26
export CHAINLINK=0x694AA1769357215DE4FAC081bf1f309aDC325306

# Uniswap v3 Sepolia infrastructure
export V3_POOL=0xe5e20f2977b83d39421e7b0c81f35c128e05d70d
export V3_PM=0x1238536071E1c677A632429e3655c799b22cDA52
export WETH=0xfff9976782d46cc05630d1f6ebab18b2324d6b14

echo "Wallet: $WALLET"
cast balance $WALLET --rpc-url $RPC
```

Make sure you have Sepolia ETH (grab from faucets.chain.link/sepolia).

---

## Step 1: Verify the Anchor Pool is Live (1 min)

First, confirm the pool exists and has price/liquidity. This is the foundation of the whole test.

```bash
# Read slot0 — current price
cast call $V3_POOL "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)" --rpc-url $RPC

# Read liquidity
cast call $V3_POOL "liquidity()(uint128)" --rpc-url $RPC

# Read the token addresses
cast call $V3_POOL "token0()(address)" --rpc-url $RPC
cast call $V3_POOL "token1()(address)" --rpc-url $RPC
cast call $V3_POOL "fee()(uint24)" --rpc-url $RPC
```

**Expected:**
- `slot0` returns a sqrtPriceX96 close to the real ETH/USD rate
- `liquidity` is non-zero (likely in the billions)
- `token0` and `token1` are the Sepolia USDC and WETH addresses
- `fee` is `3000` (0.30%)

Set the pool USDC address based on which is token1 (usually USDC is token0 because lower address sorts first, but verify):

```bash
export POOL_TOKEN0=$(cast call $V3_POOL "token0()(address)" --rpc-url $RPC)
export POOL_TOKEN1=$(cast call $V3_POOL "token1()(address)" --rpc-url $RPC)
echo "Token0: $POOL_TOKEN0"
echo "Token1: $POOL_TOKEN1"
# The one that isn't WETH is the pool's USDC
```

Also verify Chainlink is alive:

```bash
cast call $CHAINLINK "latestAnswer()(int256)" --rpc-url $RPC
# Should return a current ETH/USD price in 8 decimals (e.g., 2055 * 1e8 = 205500000000)
```

---

## Step 2: Get Sepolia WETH and USDC (3 min)

To provide liquidity on the v3 pool, you need both sides. You can get them two ways:

**Option A: Swap on the dapp**

1. Open https://app.uniswap.org on Sepolia
2. Swap some Sepolia ETH → WETH (just wrap it)
3. Swap some WETH → USDC (using the anchor pool itself)

**Option B: Via terminal**

```bash
# Wrap ETH to WETH (WETH has a deposit() function that takes ETH)
cast send $WETH "deposit()" --value 0.05ether --rpc-url $RPC --private-key $KEY

# Verify WETH balance
cast call $WETH "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC

# Get pool USDC by swapping — use app.uniswap.org as it's easier than manually calling the router
# Or if you want to skip this and just provide WETH-only liquidity (single-sided), you can
# mint a position with only WETH — it requires setting the tick range entirely below or above current price
```

For the test, you need enough to create a small LP. **0.01 WETH + ~20 USDC** is enough for a meaningful test.

---

## Step 3: Mint IL Shield Test USDC (1 min)

The IL Shield protocol uses its own TestUSDC (distinct from the pool's USDC) for premium payments.

```bash
cast send $ILSHIELD_USDC "mint(address,uint256)" $WALLET 100000000000 \
  --rpc-url $RPC --private-key $KEY

cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC
```

Expected: `100000000000` (100,000 USDC with 6 decimals).

Add the token to MetaMask: Settings → Import Token → `0x54738B6D21E9b3091f9CF82f9d3cf0d05aE4040A`, symbol USDC, decimals 6.

---

## Step 4: Provide Liquidity on the WETH/USDC Pool (5 min)

Create a real Uniswap v3 LP position on the anchor pool.

1. Open https://app.uniswap.org
2. Switch to **Ethereum Sepolia**
3. Go to **Pool** → **New position** → select **v3**
4. Select token pair: **WETH / USDC** (using the pool's USDC address from Step 1)
5. Select fee tier: **0.3%**
6. Set a **wide range** — accept the default or use the "full range" toggle
7. Enter amounts — as small as 0.005 WETH and the equivalent USDC
8. Click **Preview** → **Add**
9. Confirm in MetaMask

When the transaction confirms, you'll own a v3 NonfungiblePositionManager NFT. Record the token ID:

```bash
# How many v3 NFTs do you own?
cast call $V3_PM "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC

# Get your most recent token ID
BALANCE=$(cast call $V3_PM "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC | awk '{print $1}')
LAST_INDEX=$((BALANCE - 1))
export TOKEN_ID=$(cast call $V3_PM "tokenOfOwnerByIndex(address,uint256)(uint256)" $WALLET $LAST_INDEX --rpc-url $RPC | awk '{print $1}')
echo "Your v3 position token ID: $TOKEN_ID"
```

---

## Step 5: Verify the Adapter Reads Your Position (1 min)

```bash
cast call $ADAPTER "getPosition(uint256)((uint160,int24,int24,uint128,address,address,uint24,address))" $TOKEN_ID --rpc-url $RPC
```

The return tuple fields in order:
1. `sqrtPriceX96` — **must be non-zero** (the current pool price)
2. `tickLower` — your position's lower tick
3. `tickUpper` — your position's upper tick
4. `liquidity` — **must be non-zero** (your actual LP liquidity)
5. `token0` — the pool's token0
6. `token1` — the pool's token1
7. `feeRate` — 3000
8. `pool` — must equal `$V3_POOL` (0xe5e20f...d70d)

**If all three (sqrtPriceX96, liquidity, pool) are correct, the adapter pipeline is validated end-to-end.**

Extract the pool address and derive the poolId the core uses:

```bash
# The core computes poolId as bytes32(uint256(uint160(pool_address)))
# For the V3_POOL address, that's:
export POOL_ID=0x000000000000000000000000e5e20f2977b83d39421e7b0c81f35c128e05d70d
echo "Pool ID for oracle: $POOL_ID"
```

---

## Step 6: Configure the Anchor Pool in the Pricing Oracle (1 min)

This is the critical step — we map the real WETH/USDC pool to the live Chainlink ETH/USD feed.

```bash
cast send $ORACLE \
  "configurePool(bytes32,address,address,uint256,uint256,uint256)" \
  $POOL_ID \
  $CHAINLINK \
  0x0000000000000000000000000000000000000000 \
  350000000000000000 \
  3000 \
  1000000000000000000 \
  --rpc-url $RPC --private-key $KEY
```

Parameters explained:
- `poolId` — the real v3 WETH/USDC pool, converted to bytes32
- `chainlinkFeed` — live ETH/USD feed on Sepolia
- `twapSource` — zero (no TWAP fallback needed for this test)
- `volFloor` — 0.35e18 (35% annualized volatility floor)
- `feeTier` — 3000 (matches the pool)
- `volToLiqRatio` — 1e18

Verify:

```bash
cast call $ORACLE "poolConfigs(bytes32)" $POOL_ID --rpc-url $RPC
```

The first returned field should be the Chainlink address (not zero).

**If this reverts with `AccessControl`:** Your wallet doesn't have `KEEPER_ROLE` on the oracle. Only the deployer wallet can configure pools. Run this step from the deployer wallet, or have the deployer grant your wallet `KEEPER_ROLE`:

```bash
# From the deployer wallet
cast send $ORACLE "grantRole(bytes32,address)" \
  0xfac56cb7b38e56b5fa5fce3b1b83d1e88e4f8a8aa88e4f28e10f5a38e7e38e9 $YOUR_WALLET \
  --rpc-url $RPC --private-key $DEPLOYER_KEY
```

(The bytes32 above is `keccak256("KEEPER_ROLE")`.)

---

## Step 7: Test the Dapp UI (3 min)

Open the IL Shield dapp in your browser.

1. Connect MetaMask on **Ethereum Sepolia**
2. The vault TVLs should show (~$5M Senior, ~$1M Junior)
3. The **DEX selector** row should show available DEXes on Sepolia
4. Select **Uniswap v3**
5. The **position dropdown** should show your WETH/USDC LP position
6. Select your position
7. Choose **100%** coverage tier
8. Choose **30d** duration
9. Enter premium: **`1000`**
10. Click **Approve & Protect**

MetaMask pops up twice — confirm both.

Wait for transactions to confirm. The screen transitions to Active Protection showing the warming bar animating.

**Check:** The transaction data for the second popup should show the adapter address (`0x89ea6b...df26`) as the first argument to `register()`.

---

## Step 8: Verify Position Stored with Real Data (1 min)

```bash
export ILPN_ID=$(($(cast call $CORE "nextPositionId()(uint256)" --rpc-url $RPC) - 1))
echo "ILPN ID: $ILPN_ID"

cast call $CORE "positions(uint256)" $ILPN_ID --rpc-url $RPC
```

Returned fields in order:
1. `poolId` — should equal `$POOL_ID`
2. **`entrySqrtPriceX96`** — must be non-zero, should match the pool's current `slot0()` price at registration time
3. `tickLower` / `tickUpper` — match your LP
4. **`liquidity`** — non-zero, real LP liquidity
5. `coverageTier` — 2
6. `coverageStartBlock` — current + 10
7. `premiumBalance` — 1000000000 (1000 USDC)
...

**This is the key verification.** Non-zero `entrySqrtPriceX96` and non-zero `liquidity` = the entire adapter → core → storage pipeline works on live Sepolia against a real ETH-tracking pool.

---

## Step 9: The Moment of Truth — Settle with Real IL (3 min)

Wait for the warming period (10 blocks ≈ 2 minutes), then settle with a **synthetic exit price that represents a realistic ETH move**. Since the pool tracks real ETH, we can compute what `sqrtPriceX96` would look like if ETH moved 15% up.

```bash
# Record balances before
export USDC_BEFORE=$(cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC | awk '{print $1}')
export JUNIOR_BEFORE=$(cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $JUNIOR --rpc-url $RPC | awk '{print $1}')

echo "Before settlement:"
echo "  Your USDC:      $USDC_BEFORE"
echo "  Junior vault:   $JUNIOR_BEFORE"

# Wait for warming
echo "Waiting for warming period..."
sleep 140

# Read current pool price
CURRENT_SQRT=$(cast call $V3_POOL "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)" --rpc-url $RPC | head -1 | awk '{print $1}')
echo "Current pool sqrtPriceX96: $CURRENT_SQRT"

# Compute sqrtPriceX96 for a 15% price increase: sqrt(1.15) * current ≈ 1.07238 * current
EXIT_SQRT=$(python3 -c "print(int($CURRENT_SQRT * 1.07238053))")
echo "Exit sqrtPriceX96 (15% up): $EXIT_SQRT"

# Settle
cast send $CORE "settle(uint256,uint160,bytes)" \
  $ILPN_ID $EXIT_SQRT 0x \
  --rpc-url $RPC --private-key $KEY

# Record balances after
export USDC_AFTER=$(cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC | awk '{print $1}')
export JUNIOR_AFTER=$(cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $JUNIOR --rpc-url $RPC | awk '{print $1}')

echo ""
echo "=== Settlement Results ==="
echo "Your USDC:      $USDC_BEFORE → $USDC_AFTER (change: $((USDC_AFTER - USDC_BEFORE)))"
echo "Junior vault:   $JUNIOR_BEFORE → $JUNIOR_AFTER (drop: $((JUNIOR_BEFORE - JUNIOR_AFTER)))"
```

**Pass criteria:**
- `USDC_AFTER > USDC_BEFORE` → you received a real IL payout
- `JUNIOR_AFTER < JUNIOR_BEFORE` → the payout came from the Junior vault (tranche waterfall working)
- The delta in your USDC should approximately equal the delta in Junior (minus any protocol fees)

**If the settlement reverts with `SettlementPriceDisputed`:** The Chainlink oracle price diverges too much from your synthesized exit price. This is actually a *good* signal — it means the dispute resolution is working. The oracle is anchoring to real ETH and rejecting artificial prices. To avoid the dispute, use an exit price closer to the current Chainlink-implied price.

**Alternative — settle at the current real price:** If you want to see non-zero IL from organic price movement, register at one block, wait ~10 minutes (real ETH may move 0.1-0.5%), and settle at the actual current pool price:

```bash
# Get current pool price as exit price — no synthesis
REAL_CURRENT=$(cast call $V3_POOL "slot0()(uint160,int24,uint16,uint16,uint16,uint8,bool)" --rpc-url $RPC | head -1 | awk '{print $1}')
cast send $CORE "settle(uint256,uint160,bytes)" $ILPN_ID $REAL_CURRENT 0x \
  --rpc-url $RPC --private-key $KEY
```

The IL will be small but real.

---

## Step 10: Cancel and Refund (2 min)

Test the cancellation path:

```bash
# Approve more USDC
cast send $ILSHIELD_USDC "approve(address,uint256)" $CORE 10000000000 \
  --rpc-url $RPC --private-key $KEY

# Register a new position
cast send $CORE \
  "register(address,uint256,uint8,uint48,uint256,address)" \
  $ADAPTER $TOKEN_ID 1 200 2000000000 0x0000000000000000000000000000000000000000 \
  --rpc-url $RPC --private-key $KEY

CANCEL_ID=$(($(cast call $CORE "nextPositionId()(uint256)" --rpc-url $RPC) - 1))

BEFORE_CANCEL=$(cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC | awk '{print $1}')

# Cancel
cast send $CORE "cancelProtection(uint256)" $CANCEL_ID \
  --rpc-url $RPC --private-key $KEY

AFTER_CANCEL=$(cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC | awk '{print $1}')
echo "Refund: $((AFTER_CANCEL - BEFORE_CANCEL))"
```

**Expected:** Refund ≈ 2000000000 (the full premium, minus any streamed premium if warming was complete).

---

## Step 11: Double-Settle Protection (1 min)

```bash
# Try to settle the already-settled position from Step 9
cast send $CORE "settle(uint256,uint160,bytes)" $ILPN_ID $EXIT_SQRT 0x \
  --rpc-url $RPC --private-key $KEY
```

**Expected:** Transaction reverts with `PositionAlreadySettled`.

---

## Step 12: Final State Check (1 min)

```bash
echo "=== Final System State ==="
echo ""
echo "Your IL Shield USDC:"
cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC
echo ""
echo "Your ILPN NFT count:"
cast call $ILPN "balanceOf(address)(uint256)" $WALLET --rpc-url $RPC
echo ""
echo "Senior vault TVL:"
cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $SENIOR --rpc-url $RPC
echo ""
echo "Junior vault TVL:"
cast call $ILSHIELD_USDC "balanceOf(address)(uint256)" $JUNIOR --rpc-url $RPC
echo ""
echo "Total positions ever registered:"
cast call $CORE "nextPositionId()(uint256)" --rpc-url $RPC
echo ""
echo "Current Chainlink ETH/USD (×1e8):"
cast call $CHAINLINK "latestAnswer()(int256)" --rpc-url $RPC
```

---

## Pass Criteria

- [ ] Step 1: Anchor pool `0xe5e20f...d70d` has non-zero liquidity and returns a valid slot0 price
- [ ] Step 3: TestUSDC minted (100,000)
- [ ] Step 4: Created a real v3 LP position on WETH/USDC anchor pool
- [ ] Step 5: Adapter returned non-zero sqrtPriceX96, non-zero liquidity, correct pool address
- [ ] Step 6: Pool configured in oracle mapped to Chainlink ETH/USD
- [ ] Step 7: Dapp detected the position and register() succeeded through the UI
- [ ] Step 8: `positions()` shows non-zero `entrySqrtPriceX96` and non-zero `liquidity`
- [ ] Step 9: **`USDC_AFTER > USDC_BEFORE` AND `JUNIOR_AFTER < JUNIOR_BEFORE`** (the critical IL payout check)
- [ ] Step 10: Cancel refunded ~2000 USDC
- [ ] Step 11: Double settle reverted with `PositionAlreadySettled`
- [ ] Step 12: Balances consistent with all operations

---

## What This Proves

Step 9 is the only test in the project's history that proves the full IL math works **against a real ETH-tracking pool with a live Chainlink oracle anchor on live chain** without spending mainnet money. Every previous test either:
- Used mock position data (`vm.store` injection in fork tests), OR
- Used the legacy `register()` that stored `entrySqrtPriceX96: 0`, OR
- Used the adapter but with made-up tokens where Chainlink wasn't a valid anchor

This test closes all three gaps simultaneously. The WETH/USDC pool on v3 Sepolia has existed for years, actually tracks ETH's real price, and the Chainlink ETH/USD feed on Sepolia is the same live feed used for the Chainlink price aggregator on mainnet. When you see `USDC_AFTER > USDC_BEFORE` and `JUNIOR_AFTER < JUNIOR_BEFORE`, you've verified the full lifecycle end-to-end with real market-relevant math.

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Pool address returns empty slot0 | Pool contract not at that address on your RPC | Verify Sepolia RPC is correct; the pool is at `0xe5e20f2977b83d39421e7b0c81f35c128e05d70d` |
| Can't get WETH/USDC for LP | Need both sides for a v3 position | Use app.uniswap.org to swap ETH → WETH → USDC before creating LP |
| LP creation reverts | Tick range alignment issue | Use "full range" toggle in the Uniswap UI |
| Adapter returns zero liquidity | Wrong token ID, or position has been closed | Double-check the token ID, verify it's still yours via `ownerOf` |
| Step 6 reverts `AccessControl` | Wallet lacks `KEEPER_ROLE` on oracle | Run from deployer wallet, or have deployer grant `KEEPER_ROLE` |
| Register reverts `AdapterNotApproved` | V3 adapter not whitelisted on core | Deployer calls `core.approveAdapter(0x89ea6b..., true)` |
| Register reverts `EmptyPosition` | Adapter returned sqrtPriceX96=0 AND liquidity=0 | Your LP position may be out of range or empty; verify in the Uniswap UI |
| Step 9 reverts `SettlementPriceDisputed` | Synthetic exit price diverges too much from Chainlink | Use the real current pool price instead (alternative command in Step 9) |
| Settle reverts `CoverageNotStarted` | Warming period not complete | Wait longer (>140 seconds from register) |
| Junior didn't drop | IL computed to zero due to tiny price delta | Use a larger price delta (20-30% instead of 15%) or wait for real organic ETH movement |
