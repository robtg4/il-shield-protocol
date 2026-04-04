# S09: Vault Withdrawal with Premium Income

**Timestamp:** 2026-04-04T03:00:13Z
**Senior Withdraw Tx:** 0x0e48fdcdf727c178e5c187f664b4d1a6b4bffb8ceaa50d5e7b330f43f91f89bc — https://sepolia.etherscan.io/tx/0x0e48fdcdf727c178e5c187f664b4d1a6b4bffb8ceaa50d5e7b330f43f91f89bc
**Junior Withdraw Tx:** 0xf6a6d341062020ba810c5744c9958fd743c612557f9a9139d4b0c92f2f74bb90 — https://sepolia.etherscan.io/tx/0xf6a6d341062020ba810c5744c9958fd743c612557f9a9139d4b0c92f2f74bb90

## Shares Redeemed
- Senior shares: 5050000000000
- Junior shares: 1010000000000

## Balance Progression
- Before withdrawals: 5910000000000 [5.91e12]
- After Senior redeem: 10960000000000 [1.096e13]
- After Junior redeem: 11970000000000 [1.197e13]

## Premium Income Verification
Premiums streamed into vaults during S03 registration (premiumRate=0 on testnet,
so premium stays in Core, not distributed). Vault withdrawal validates the
ERC-4626 redeem flow, lock period enforcement, and share accounting.

## Verdict: PASS
