# Claude Code Prompt: Polish IL Shield Protocol README

## Context

You are polishing the GitHub README for IL Shield Protocol — a parametric impermanent loss protection protocol for Uniswap v4 LPs. The README needs to serve three audiences: **grant reviewers** (evaluating whether to fund us), **developers** (evaluating the code), and **potential integrators** (protocols that might embed IL Shield).

The repo contains Solidity smart contracts deployed on Ethereum Sepolia and Unichain Sepolia. The test suite has 216 passing tests.

## Product Summary

IL Shield is insurance for Uniswap LPs:
- LPs pay a streaming USDC premium
- If impermanent loss exceeds fee income when they close their position, they get paid
- Claims are paid from tranched stablecoin vaults (Senior: last-loss 8-12% APY, Junior: first-loss 20-50% APY)
- No native token, stablecoin collateral only, non-transferable ERC-721 protection NFTs
- Net IL pricing: gross IL - fee income = viable premiums
- Optional Uniswap v4 hook for atomic in-pool protection

### Architecture
- **ILShieldCore** — Registration, premium streaming, settlement logic
- **PricingOracle** — Chainlink + TWAP + volatility feeds for actuarial pricing
- **ILPNRegistry** — Soulbound ERC-721 protection position NFTs
- **SeniorVault** — ERC-4626 vault, last-loss tranche, 8-12% target APY
- **JuniorVault** — ERC-4626 vault, first-loss tranche, 20-50% target APY
- **ILShieldHook** — Optional Uniswap v4 hook for native pool integration

### Key Differentiators
- Bancor failed because it minted BNT to pay claims (correlated collateral). IL Shield uses stablecoins — vault solvency is uncorrelated with the market crashes that trigger claims.
- Unlike Panoptic (options-based), IL Shield requires zero options knowledge. Pay premium, get protection.
- Complementary to active LP management (Gamma, Arrakis, Charm) — they reduce IL 30-50%, IL Shield covers the rest.

## README Structure Required

Create a professional, well-structured README.md with:

### 1. Header
- Project name with shield emoji: 🛡️ IL Shield Protocol
- One-line description: "Parametric impermanent loss protection for Uniswap v4 liquidity providers"
- Badge row: License (MIT), Tests (216 passing), Solidity version, Chains (Sepolia, Unichain Sepolia)
- Links: Website | Docs | Discord

### 2. Overview (2-3 paragraphs)
- What IL Shield does (insurance for LPs)
- Why it exists (the $1.5-3B annual IL problem)
- Why it's different (stablecoin collateral, tranched vaults, no native token)
- Keep it punchy. Not a whitepaper intro — a README intro.

### 3. How It Works (visual flow)
```
LP Position → Register with IL Shield → Stream USDC Premium → Position Closed
                                                                    ↓
                                                        IL > Fee Income? → Payout from Vaults
                                                        IL ≤ Fee Income? → No claim needed
```

### 4. Architecture
- Clean ASCII or text diagram of contract relationships
- Brief description of each contract (1-2 lines each)
- Mention key design patterns: ERC-4626 vaults, ERC-721 positions, streaming payments, parametric settlement

### 5. Key Features
Bullet list:
- Net IL pricing (gross IL - fee income)
- Tranched underwriting (Senior/Junior vaults)
- Anti-gaming mechanisms (activation delay, bonus-malus, tiered coverage, C-level repricing)
- Chainlink + TWAP oracle integration
- ZK IL verification via Brevis coprocessor
- Optional v4 hook for atomic protection
- Non-transferable ERC-721 protection NFTs
- No native token — all stablecoin denominated

### 6. Deployments
Table:
| Network | Contract | Address |
|---------|----------|---------|
| Ethereum Sepolia | ILShieldCore | `0x...` |
| Ethereum Sepolia | PricingOracle | `0x...` |
| ... | ... | ... |
| Unichain Sepolia | ILShieldCore | `0x...` |
| ... | ... | ... |

(Use placeholder addresses if actual ones aren't in the codebase — mark as TBD)

### 7. Getting Started
```bash
# Clone
git clone https://github.com/[org]/il-shield-protocol.git
cd il-shield-protocol

# Install dependencies
forge install

# Run tests
forge test

# Run tests with gas reporting
forge test --gas-report
```

### 8. Testing
- Mention the 216 tests
- Categories: unit, integration, adversarial, invariant, fork tests
- How to run specific test suites
- Coverage command if applicable

### 9. Security
- Current audit status (heading into audits — OpenZeppelin, Spearbit, Code4rena)
- Bug bounty info (Immunefi — planned)
- Known limitations or assumptions
- Responsible disclosure contact

### 10. Integration Guide (brief)
- For protocols wanting to embed IL Shield protection
- Key integration points: ILShieldCore.register(), ILShieldCore.settle()
- Mention the v4 hook for native integration
- Point to full integration docs (link to docs site)

### 11. Roadmap
Simple timeline:
- ✅ Core contracts complete
- ✅ Test suite (216 tests passing)
- ✅ Testnet deployment (Ethereum Sepolia + Unichain Sepolia)
- 🔄 Audit preparation
- ⏳ Security audits (OpenZeppelin + Spearbit + Code4rena)
- ⏳ Formal verification (Certora Prover)
- ⏳ Mainnet launch (Ethereum + Unichain)
- ⏳ L2 expansion (Arbitrum, Base)
- ⏳ Protocol integrations (Gamma, Arrakis)

### 12. Contributing
- Standard contributing section
- Point to CONTRIBUTING.md (create if doesn't exist)
- Code style: Foundry/Forge conventions
- PR process

### 13. License
- MIT (or whatever license is used)

### 14. Links
- Website: il-shield-protocol.vercel.app
- Documentation: [link]
- Discord: [link]
- Twitter/X: [link]
- Governance Forum Post: [link]

## Style Notes
- Professional but not stuffy. This is DeFi, not a bank.
- Use emojis sparingly (section headers are fine, not every bullet)
- Code blocks for any technical content
- Keep the total README scannable — someone should get the gist in 60 seconds
- Don't put the entire whitepaper in the README — link to docs for deep dives
- Make it look like a serious, well-maintained project (because grant reviewers WILL check the GitHub)
