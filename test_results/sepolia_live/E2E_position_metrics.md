# IL Shield E2E Test — Position Metrics

**Generated:** 2026-04-10T00:20:54Z
**Block:** 10626565
**Wallet:** 0xa170fD4370029b4a7d88F7AFC4567186A6FA3579

---

## 1. Anchor Pool State

| Field | Value |
|-------|-------|
| Pool address | `0xE5E20F2977B83D39421E7B0c81f35C128e05d70d` |
| slot0 | `1964755297072242670122073275772704 [1.964e33]
202381 [2.023e5]
0
1
1
0
true` |
| Pool liquidity | `827862510185083079159 [8.278e20]` |
| Token0 (USDC) | `0x6F79350e44a35225870e5fDDf55b17574Fd77d1a` |
| Token1 (WETH) | `0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14` |
| Fee | 3000 (0.30%) |

---

## 2. Chainlink Oracle

| Field | Value |
|-------|-------|
| Feed address | `0x694AA1769357215DE4FAC081bf1f309aDC325306` |
| ETH/USD (8 dec) | `218912102696 [2.189e11]` |
| ETH/USD (human) | $2189.12 |
| latestRoundData | `18446744073709583625 [1.844e19]
218912102696 [2.189e11]
1775779428 [1.775e9]
1775779428 [1.775e9]
18446744073709583625 [1.844e19]` |

---

## 3. Wallet Balances (Pre-Registration)

| Asset | Balance |
|-------|---------|
| ETH (gas) | `42796455334022024` |
| WETH | `58866036020390 [5.886e13]` |
| Pool USDC | `0` |
| IL Shield TestUSDC | `5100000000000 [5.1e12]` |

---

## 4. LP Position

| Field | Value |
|-------|-------|
| NonfungiblePositionManager | `0x1238536071E1c677A632429e3655c799b22cDA52` |
| Token ID | **226129** |
| V3 NFTs owned | `1` |
| Pool | `0xE5E20F2977B83D39421E7B0c81f35C128e05d70d` |

### Adapter Read (`getPosition(226129)`)

```
(1964755297072242670122073275772704 [1.964e33], 199380 [1.993e5], 205380 [2.053e5], 7218395948839 [7.218e12], 0x6F79350e44a35225870e5fDDf55b17574Fd77d1a, 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14, 3000, 0xE5E20F2977B83D39421E7B0c81f35C128e05d70d)
```

| Decoded Field | Value |
|---------------|-------|
| sqrtPriceX96 | 1964755297072242670122073275772704 [1.964e33] |
| tickLower | 199380 [1.993e5] |
| tickUpper | 205380 [2.053e5] |
| liquidity | 7218395948839 [7.218e12] |
| token0 | 0x6F79350e44a35225870e5fDDf55b17574Fd77d1a |
| token1 | 0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14 |
| feeRate | 3000 |
| pool | 0xE5E20F2977B83D39421E7B0c81f35C128e05d70d |

### Key Validations

- [x] sqrtPriceX96 > 0
- [x] liquidity > 0 (real LP, not zero)
- [x] pool matches anchor pool `0xE5E20F2977B83D39421E7B0c81f35C128e05d70d`
- [x] feeRate = 3000
- [x] token0/token1 match pool tokens

---

## 5. IL Shield Protocol State

| Field | Value |
|-------|-------|
| ILShieldCore | `0xdbB160dc5f8e00A8f216042F6b1Dc16055B10722` |
| V3 Adapter | `0x89eA6bdE36BB30bD8594F5855534f05866f3DF26` |
| Senior vault TVL | `5000000000000 [5e12]` |
| Junior vault TVL | `1000000000000 [1e12]` |
| Next position ID | `0` |

---

## 6. Operations Performed

| Step | Operation | Tx/Result |
|------|-----------|-----------|
| 1 | Verify anchor pool | slot0 non-zero, liquidity 828e18 |
| 2a | Wrap 0.05 ETH → WETH | 0.05 WETH received |
| 2b | Swap 0.025 WETH → pool USDC | ~40.53 USDC received |
| 2c | Mint v3 LP (ticks 199380–205380) | Token ID 226129, liquidity 7.218e12 |
| 3 | Mint 100K IL Shield TestUSDC | Balance now 5.1M |

---

## 7. Derived Values for Subsequent Steps

```bash
# Use these for Steps 4+
export TOKEN_ID=226129
export POOL_ID=0x000000000000000000000000e5e20f2977b83d39421e7b0c81f35c128e05d70d
```

| Derived | Value |
|---------|-------|
| Pool ID (bytes32) | `0x000000000000000000000000e5e20f2977b83d39421e7b0c81f35c128e05d70d` |
| Entry sqrtPriceX96 | 1964755297072242670122073275772704 [1.964e33] |
| Position liquidity | 7218395948839 [7.218e12] |
| Chainlink ETH/USD | `218912102696 [2.189e11]` |
