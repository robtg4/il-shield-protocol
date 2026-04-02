# IL Shield — UI/UX Design Specification v1.0

**Product:** IL Shield — Tokenized Impermanent Loss Protection for Uniswap v4  
**Design System Basis:** Uniswap app.uniswap.org (April 2026) — intentional product-family variant  
**Target Platforms:** Desktop web (primary), mobile web (responsive), future: embedded widget for third-party LP interfaces  
**Date:** April 2026

---

## 1. Design Philosophy

IL Shield is designed to look and feel like a native Uniswap product page. The interface is intentionally a variant of the Uniswap swap interface — same card system, same input patterns, same CTA style, same background treatment — adapted for IL protection rather than token swapping. A user familiar with Uniswap should feel immediate recognition and zero learning curve when encountering IL Shield.

The core interaction maps directly onto Uniswap's swap mental model. "Sell" becomes "Position" (what you're protecting). "Buy" becomes "Coverage" (what you receive). The down-arrow divider becomes a shield icon. The pink "Get started" CTA becomes "Protect position." This 1:1 mapping is deliberate and must be preserved across all screens.

---

## 2. Color System

### 2.1 Core Palette

All color values are taken directly from Uniswap's production interface and must not be modified. IL Shield adds no brand colors of its own — it uses Uniswap's palette exclusively to maximize the native feel.

| Token | Hex | Usage |
|---|---|---|
| `bg` | `#131313` | Page background |
| `card` | `#1B1B1B` | Primary card surface |
| `input` | `#232323` | Inner input surfaces, secondary cards |
| `inputHover` | `#2C2C2C` | Hover state on input surfaces |
| `cardBorder` | `#ffffff0f` | Card border — extremely faint, barely visible, but structurally present |
| `text1` | `#FFFFFF` | Primary text, headings, amounts |
| `text2` | `#9B9B9B` | Secondary text, labels, descriptions |
| `text3` | `#5E5E5E` | Tertiary text, placeholders, disabled states |
| `pink` | `#FC72FF` | Primary accent, active nav, selected states, "Connect" button |
| `pinkCta` | `#311C31` | CTA button background (muted dark pink) |
| `pinkCtaText` | `#FC72FF` | CTA button text color |
| `pinkDim` | `#FC72FF20` | Pink tinted backgrounds (selected tier pills, active nav pill) |
| `green` | `#40B66B` | Positive values, "In range" badge, coverage amounts, "Active" status |
| `greenDim` | `#40B66B1a` | Green tinted backgrounds (P&L cards, status badges) |
| `red` | `#FF5F52` | Negative values, IL amounts, "Out of range" badge |
| `redDim` | `#FF5F521a` | Red tinted backgrounds (IL P&L card) |
| `amber` | `#EEB317` | Warning states, "Warming" status, low premium balance |
| `amberDim` | `#EEB3171a` | Amber tinted backgrounds |

### 2.2 Token Brand Colors

Used exclusively for token logos in the pair selector and floating orbs.

| Token | Hex |
|---|---|
| ETH | `#627EEA` |
| USDC | `#2775CA` |
| WBTC | `#F09242` |
| Uniswap Pink | `#FF007A` |
| Purple (generic) | `#8B5CF6` |
| Blue (generic) | `#4C82FB` |

---

## 3. Typography

### 3.1 Font Stack

The primary font is Inter, matching Uniswap's production typeface. Monospace is used exclusively for financial amounts, prices, and rates.

| Context | Font | Fallbacks |
|---|---|---|
| Primary (all UI text) | Inter | system-ui, -apple-system, sans-serif |
| Financial amounts | JetBrains Mono | SF Mono, Fira Code, Consolas, monospace |

### 3.2 Type Scale

| Element | Size | Weight | Font | Color | Letter Spacing |
|---|---|---|---|---|---|
| Hero headline | 52px | 500 | Inter | `text1` | -0.02em |
| Page title | 20px | 600 | Inter | `text1` | 0 |
| Card amount (large) | 36px | 400 | Inter | `text1` or semantic | 0 |
| Card amount (medium) | 28px | 400 | Inter | `text1` | 0 |
| P&L value | 18px | 600 | JetBrains Mono | semantic color | 0 |
| Nav link | 15px | 400 | Inter | `text2` (inactive), `text1` (active) | 0 |
| Nav brand | 17px | 600 | Inter | `pink` | 0 |
| Section label | 14px | 400 | Inter | `text2` | 0 |
| Body text | 14px | 400 | Inter | `text2` | 0 |
| Button text (primary) | 18px | 600 | Inter | `pinkCtaText` or `#fff` | 0 |
| Button text (secondary) | 16px | 600 | Inter | `text1` | 0 |
| Token selector text | 16px | 600 | Inter | `text1` | 0 |
| Pill label | 14px | 600 | Inter | semantic color | 0 |
| Caption / detail | 13px | 400 or 500 | Inter | `text3` | 0 |
| Micro label | 11px | 500 | Inter | `text3` | 0.05em |
| Stat label (uppercase) | 11px | 500 | Inter | `text3` | 0.05em |
| Dollar sub-value | 13-14px | 400 | Inter | `text3` | 0 |
| Streaming rate | 12-13px | 400 | JetBrains Mono | `text3` | 0 |

### 3.3 Line Heights

Hero headline: 1.1. Card amounts: 1.2. Body text: 1.5. All other text: default (approximately 1.4).

---

## 4. Spacing and Layout

### 4.1 Grid and Dimensions

The layout is centered single-column with a fixed-width card. The page uses a max-width container for the nav bar and the main card area.

| Element | Value |
|---|---|
| Nav max-width | 1400px |
| Card width | 480px (fixed, not responsive — matches Uniswap's swap card) |
| Card border-radius | 24px |
| Inner surface border-radius | 16px |
| Button border-radius (primary CTA) | 20px |
| Pill border-radius | 20px (full-round for small pills), 16px for tier/duration pills |
| Token logo border-radius | 50% (circle) |

### 4.2 Spacing Values

All spacing follows an 8px base grid. The specific values used in each component are documented in the component specifications below.

| Spacing Token | Value | Usage |
|---|---|---|
| `card-padding` | 16px | Horizontal padding inside the card |
| `section-gap` | 12-14px | Vertical gap between sections inside the card |
| `inner-padding` | 12-14px | Padding inside inner surfaces (`input` bg sections) |
| `label-to-content` | 6px | Space between a label ("Position", "Coverage") and its content |
| `button-padding-y` | 16px | Vertical padding inside the primary CTA |
| `pill-padding-x` | 10-12px | Horizontal padding inside pills |
| `pill-padding-y` | 6-8px | Vertical padding inside pills |
| `nav-gap` | 24px | Gap between nav links |
| `hero-to-card` | 28px | Space between the hero headline and the card |
| `card-to-tagline` | 16px | Space between the card bottom and the tagline text |

### 4.3 Card Elevation

Cards use no box-shadow. Depth is created entirely through background-color layering: `bg` (#131313) → `card` (#1B1B1B) → `input` (#232323) → `inputHover` (#2C2C2C). The very faint border (`#ffffff0f`, approximately 6% white opacity) provides the only edge definition. This matches Uniswap's approach where the card appears to float on the dark background through contrast alone.

---

## 5. Background Treatment

### 5.1 Floating Orbs

The page background is `#131313` with an overlay of floating, blurred circles ("orbs") that create ambient color on the page. This matches the Uniswap homepage's token-logo scatter pattern.

Each orb is a circular `div` with `border-radius: 50%`, a solid token-brand background color, `filter: blur(Npx)`, and `opacity: 0.35`. Orbs are positioned absolutely within a `position: fixed; inset: 0` container with `pointer-events: none` and `z-index: 0`.

Recommended orb configuration (15 orbs for visual richness without performance impact):

| # | X% | Y% | Size (px) | Color | Blur (px) |
|---|---|---|---|---|---|
| 1 | 10 | 12 | 44 | #FF007A | 30 |
| 2 | 28 | 25 | 38 | #40B66B | 25 |
| 3 | 75 | 8 | 40 | #627EEA | 28 |
| 4 | 88 | 35 | 36 | #2775CA | 22 |
| 5 | 15 | 55 | 42 | #4C82FB | 26 |
| 6 | 50 | 65 | 50 | #40B66B | 35 |
| 7 | 80 | 58 | 34 | #FF5F52 | 20 |
| 8 | 30 | 78 | 40 | #F09242 | 25 |
| 9 | 65 | 82 | 38 | #8B5CF6 | 24 |
| 10 | 5 | 42 | 30 | #FF007A | 18 |
| 11 | 92 | 72 | 36 | #627EEA | 22 |
| 12 | 45 | 40 | 32 | #F09242 | 20 |
| 13 | 70 | 42 | 28 | #8B5CF6 | 16 |
| 14 | 20 | 90 | 34 | #FC72FF | 22 |
| 15 | 55 | 92 | 30 | #2775CA | 18 |

The orbs are static (no animation). Their purpose is ambient texture, not interactivity. On mobile viewports below 768px, reduce the orb count to 8 (remove orbs 8–15) to conserve rendering performance.

---

## 6. Navigation Bar

### 6.1 Layout

The nav bar spans the full viewport width at the top of the page, with content constrained to `max-width: 1400px` and centered. It contains three groups: left (brand + nav links), center (search bar), and right (actions). Padding: `12px 20px`. The nav sits at `z-index: 10` to float above the orbs.

### 6.2 Left Group

The brand mark consists of a 24×24px pink circle (`#FC72FF`) containing a white shield icon (path-based, not emoji), followed by "IL Shield" in 17px Inter weight-600 color `pink`, followed by a 10×10px down-chevron in `pink`. The nav links "Trade | Explore | Pool | Protect" are 15px Inter weight-400 color `text2`, separated by 24px gaps. The active link ("Protect" when on protection screens) uses color `text1`. Links have no underline, border, or background — they are plain text, matching Uniswap's nav.

### 6.3 Center Group

The search bar is positioned absolutely at `left: 50%; transform: translateX(-50%)` to center it regardless of left/right group widths. It is a pill-shaped container (`border-radius: 20px`, `background: card`, `border: 1px solid cardBorder`) with 8px vertical and 16px horizontal padding, minimum width 280px. Contents: a 16×16px magnifying glass icon in `text3`, followed by placeholder text "Search tokens, pools, and wallets" in 14px Inter color `text3`, followed by a keyboard shortcut badge "/" in a small pill (`background: input`, `border-radius: 4px`, `padding: 2px 6px`, `font-size: 12px`, color `text3`).

### 6.4 Right Group

Three elements separated by 8px gaps. "Get the app" is an outlined pill (`border: 1px solid cardBorder`, `border-radius: 20px`, `padding: 8px 14px`, `font-size: 14px`, color `text2`). The three-dot menu is a 36×36px square with `border-radius: 12px` and `border: 1px solid cardBorder`, containing "···" in `text2`. "Connect" is a filled pill (`background: pink`, `border-radius: 20px`, `padding: 8px 16px`, `font-size: 14px`, `font-weight: 600`, color `#FFFFFF`).

---

## 7. Component Specifications

### 7.1 Token Pair Selector

A pill-shaped button containing two overlapping token logos and the pair name. The logos are 24×24px circles with the token brand color background and a single-character white label (Ξ for ETH, $ for USDC, ₿ for WBTC). The second logo overlaps the first by approximately 10px (`margin-left: -10px`) and has a 2px border matching the parent surface color to create the overlapping disc effect. The pair name ("ETH/USDC") follows in 16px Inter weight-600 color `text1`. A 12×12px down-chevron in `text2` appears last. The pill has `background: input`, `border-radius: 20px`, `padding: 6px 10px 6px 6px`, and no visible border.

### 7.2 Token Input Row

Used for the premium deposit input. An inner surface (`background: input`, `border-radius: 16px`, `padding: 12px 14px`) containing a small label at top ("Premium deposit" in 13px Inter color `text3`), then a row with the amount input on the left and a token selector pill on the right. The amount input is a bare `<input>` with `font-size: 28px`, `font-weight: 400`, `color: text1`, `font-family: Inter`, transparent background, no border, no outline. Placeholder "0" in `text3`. Below: a row with the dollar equivalent on the left ("$0" or "$150.00" in 13px Inter color `text3`) and the balance on the right ("Balance: 2,847.32" in 13px Inter color `text3`).

### 7.3 Arrow/Shield Divider

A 40×40px square element centered horizontally between the two card sections. `border-radius: 12px`, `background: card`, with a 4px ring of `bg` color (achieved via `border: 4px solid #131313`). Contains a 16×16px shield outline icon in `text2` (stroke only, no fill, `stroke-width: 2.5`). The divider overlaps the sections above and below by using `margin: -8px 0` and `position: relative; z-index: 2`. On hover, the icon color transitions to `pink`.

### 7.4 Coverage Tier Pills

Three pills in a horizontal row, each taking equal width within the coverage section. Each pill has `border-radius: 16px`, `padding: 6px 12px`, `border: none`. The selected pill has `background: pink` and `color: #FFFFFF`. Unselected pills have `background: input` and `color: text2`. Content: the percentage ("50%", "75%", "100%") in 14px Inter weight-600. Transition: `background 0.12s ease, color 0.12s ease`.

### 7.5 Duration Pills

Four pills in a horizontal row, each taking equal flex width. `border-radius: 12px`, `padding: 6px 0`, `border: none`. Selected: `background: pinkDim` (#FC72FF20), `color: pink`. Unselected: `background: transparent`, `color: text3`. Content: "7d", "30d", "90d", "180d" in 13px Inter weight-500.

### 7.6 Primary CTA Button

Full-width button at the bottom of the card. `border-radius: 20px`, `padding: 16px 0`, `border: none`, `font-size: 18px`, `font-weight: 600`, `font-family: Inter`.

States: Default (enabled): `background: pinkCta` (#311C31), `color: pinkCtaText` (#FC72FF). This is the muted dark-pink treatment matching Uniswap's "Get started" button in the screenshots. Disabled (no amount entered): `background: input` (#232323), `color: text3` (#5E5E5E), `cursor: default`. Pending (transaction in progress): `background: pinkCta`, `color: pink`, `opacity: 0.7`. The button text changes to "Confirming..." during the pending state.

### 7.7 Secondary Button

Used for "Top up" and other secondary actions. `border-radius: 20px`, `padding: 14px 0`, `border: none`, `background: input`, `color: text1`, `font-size: 16px`, `font-weight: 600`. On hover: `background: inputHover`.

### 7.8 Status Badge

A small pill indicating position or protection status. `border-radius: 10px`, `padding: 4px 10px`, `font-size: 13px`, `font-weight: 500`. Variants: "In range" uses `background: greenDim`, `color: green`. "Out of range" uses `background: redDim`, `color: red`. "Active" uses `background: greenDim`, `color: green`. "Warming" uses `background: amberDim`, `color: amber`. The warming badge may display the percentage instead of text (e.g., "62%").

### 7.9 P&L Card Trio

Three small cards in a horizontal `grid` with `grid-template-columns: 1fr 1fr 1fr` and `gap: 6px`. Each card has `border-radius: 16px`, `padding: 12px 10px`, `text-align: center`, and a tinted background matching its semantic color. Content: an 11px uppercase label in `text3` with `letter-spacing: 0.05em` at the top, and an 18px JetBrains Mono weight-600 value in the semantic color below. The three cards are "Current IL" (red background, red value), "Covered" (green background, green value), and "Exposure" (red or green depending on whether exposure remains).

### 7.10 Progress Bar

A thin horizontal bar used for coverage warming and premium balance. Container: `height: 4px`, `border-radius: 2px`, `background: input` (or `bg` for nested contexts). Fill: `border-radius: 2px`, width as percentage, `transition: width 0.3s ease`. Color: `green` for active coverage, `amber` for warming state, `pink` for premium balance (default), `amber` for low premium balance (below 20%).

### 7.11 Summary Row

Used for displaying key-value pairs (settlement details, streaming rates). A row with `display: flex; justify-content: space-between; padding: 4-5px 0`. Label on the left in 13-14px Inter color `text3`. Value on the right in 13-14px Inter (or JetBrains Mono for numbers) in `text1` or a semantic color. Rows are optionally separated by `border-bottom: 1px solid cardBorder`.

### 7.12 Settlement Hero

Centered composition for the settlement receipt screen. A 52×52px circle with `background: greenDim` containing a 24×24px shield-check icon in `green`. Below: the payout amount in 40px JetBrains Mono weight-500 color `green` (e.g., "+$335.34"). Below: "Deposited to your wallet" in 14px Inter color `text2`. Vertical spacing: 14px between icon and amount, 4px between amount and description.

---

## 8. Screen Specifications

### 8.1 Screen: Protect (Default / Unauthenticated)

This is the landing screen and the primary interaction surface. It maps directly to Uniswap's swap page.

Layout from top to bottom: Hero headline centered, 40px below the nav bar. Card centered, 28px below the headline. Tagline centered, 16px below the card.

Hero headline: "Protect anytime, anywhere." — 52px Inter weight-500, color `text1`, `letter-spacing: -0.02em`, `line-height: 1.1`, `text-align: center`.

Card contents from top to bottom: "Position" section (label + amount + pair selector + IL/fees sub-line), shield divider, "Coverage" section (label + covered amount + tier pills + duration pills), "Premium deposit" section (token input row), summary rows (monthly premium, streaming rate, activation delay, current IL at risk), primary CTA button.

Tagline: "Protect LP positions with **zero app fees** on 18+ networks including Ethereum, Unichain, and Base." — 14px Inter color `text2`, with "zero app fees" as a clickable span in color `pink`. `text-align: center`, `line-height: 1.5`.

### 8.2 Screen: Active Protection

This screen displays when the user has active protection on a position. The hero headline changes dynamically: "Position protected." when warming is complete (100%), "Warming up..." during the warming period.

Card contents from top to bottom: Position reference row (pair logos + "ETH/USDC" + fee tier + status badge), coverage progress bar with labels (tier + duration on left, percentage on right), P&L card trio (Current IL, Covered, Exposure), premium balance section (inner card with balance, progress bar, streaming rate, days remaining), action buttons row ("Top up" secondary button + "Settle claim" primary-styled button).

Below the card: "Settles automatically when you close your Uniswap position." in 14px Inter color `text2`, centered.

### 8.3 Screen: Settlement

This screen displays after a claim is settled. The hero headline: "Claim settled."

Card contents from top to bottom: Settlement hero (green circle + shield-check icon + payout amount + description), detail section (inner card with summary rows: Position, Entry, Exit, Measured IL, Coverage, Fee, Payout), primary CTA button labeled "Done" (returns to the Protect screen on click).

Below the card: "View transaction on **Etherscan**" in 14px Inter color `text2`, with "Etherscan" as a clickable span in color `pink`.

---

## 9. Interaction States and Transitions

### 9.1 Tier and Duration Selection

When the user clicks a tier or duration pill, the selected pill immediately transitions to the active style (background and text color change) with a 120ms ease transition. The coverage amount in the Coverage section updates instantly to reflect the new coverage tier. The monthly premium in the summary rows updates instantly. No loading state — the computation is client-side.

### 9.2 Premium Input

As the user types in the premium deposit field, the dollar equivalent below the input updates in real time. The "days of coverage" estimate in the summary or below the input updates in real time based on `depositAmount / (monthlyPremium / 30)`. The primary CTA button transitions from the disabled state ("Enter amount" on `input` background) to the enabled state ("Protect position" on `pinkCta` background) as soon as a non-zero amount is entered.

### 9.3 Protection Transaction

When the user clicks the CTA, the button text changes to "Confirming..." and the opacity reduces to 0.7. This represents the 1-approval + 1-transaction wallet interaction. After confirmation (simulated as 2.2 seconds in the prototype), the screen transitions to the Active Protection screen. The transition is a direct swap with no animation (matching Uniswap's page transition behavior).

### 9.4 Warming Period

On the Active Protection screen, the coverage progress bar fills from 0% to 100% over the warming period (48 hours to full coverage with a 7-day ramp). The status badge transitions from "Warming" (amber) with the current percentage to "Active" (green) when 100% is reached. The hero headline transitions from "Warming up..." to "Position protected." simultaneously. These transitions happen in real time based on block number progression.

### 9.5 Premium Streaming

The premium balance number decreases in real time (updates every few seconds in the UI, reflecting per-block on-chain deduction). The progress bar below the balance decreases proportionally. When the balance drops below 20% of the initial deposit, the progress bar color changes from `pink` to `amber` and the "days remaining" text color changes from `text3` to `amber`, providing a visual warning without a separate alert component.

### 9.6 Settlement

When the user clicks "Settle claim," the screen transitions directly to the Settlement screen showing the payout hero and details. No intermediate loading state in the prototype (in production, a transaction confirmation flow would appear here matching the protection transaction pattern). The "Done" button returns to the Protect screen with all state reset.

---

## 10. Responsive Behavior

### 10.1 Desktop (1024px+)

The layout described in Sections 6–8 applies without modification. The card is fixed at 480px width and centered. The nav bar expands to fill the viewport with the three groups distributing across the full width.

### 10.2 Tablet (768px–1023px)

The nav bar's center search bar is hidden. The left and right groups remain. The card remains at 480px width. Orb count remains at 15.

### 10.3 Mobile (below 768px)

The nav bar collapses to: brand mark on the left, "Connect" button on the right, with all other nav elements hidden behind a hamburger menu. The card width changes to `100% - 32px` (16px margin on each side), with `max-width: 480px`. The hero headline font size reduces to 36px. The orb count reduces to 8. The P&L card trio stacks vertically (single column) instead of the three-column grid. The token input row remains horizontally laid out (amount + token pill) as this pattern works well on mobile.

---

## 11. Accessibility

All interactive elements must have a minimum touch target of 44×44px on mobile. Color-coded states (green for positive, red for negative) must also include a text indicator (the "+"/"-" sign prefix on amounts) so that color-blind users can distinguish positive from negative values. All input fields must have associated labels (even if visually hidden via `sr-only` class). The card and all interactive elements must be keyboard-navigable with visible focus outlines (2px solid `pink`, `border-radius` matching the element). The contrast ratio between `text1` (#FFFFFF) and `card` (#1B1B1B) is 13.6:1 (exceeds WCAG AAA). The contrast ratio between `text2` (#9B9B9B) and `card` (#1B1B1B) is 5.7:1 (exceeds WCAG AA). The contrast ratio between `text3` (#5E5E5E) and `card` (#1B1B1B) is 2.9:1, which falls below WCAG AA for body text — `text3` must be used only for supplementary labels, never for essential information.

---

## 12. Asset Requirements

The following visual assets must be created or sourced for production implementation.

IL Shield brand mark: A 24×24px SVG of a shield icon within a pink circle, used in the nav bar. Must be clean enough to render at 16×16px in small contexts. Token logos: Source from Uniswap's token list CDN (https://assets.coingecko.com or similar). For the prototype, simple colored circles with single-character labels are sufficient. Shield-check icon: A 24×24px SVG used in the settlement hero. Stroke-only shield outline with a checkmark inside. Must render clearly at 16px and 28px sizes. Chevron icon: A 12×12px SVG down-arrow used in pills and selectors. Search icon: A 16×16px SVG magnifying glass for the nav search bar. These are standard Lucide icons and should use the same stroke-based style throughout.

---

## 13. Future Screens (Not Yet Designed)

The following screens are specified in the protocol architecture but not yet included in the visual design. They will follow the same design system.

"Earn" page: The underwriter-facing vault deposit interface with Senior and Junior tranche cards. This page uses the gold accent (`#B8860B`) more prominently to visually distinguish the yield side from the protection side. Two-column layout on desktop with full-width stacked cards on mobile.

"Analytics" page: Protocol health dashboard with combined ratio charts, vault utilization, and pool-level IL statistics. Uses the `input` surface for chart backgrounds with `green`/`red`/`pink` data series.

"Positions list" page: A list of all protected positions, each rendered as a compact card matching the Uniswap positions list pattern. Clicking a card opens the Active Protection screen for that position.

Embedded widget: A narrower (360px) variant of the Protect card designed for embedding in third-party LP management interfaces (Gamma Strategies, Oku, etc.). Strips the nav bar and hero headline, presenting only the card.

---

## 14. Implementation Notes

The prototype is implemented as a single React component (JSX) using inline styles for maximum portability. Production implementation should extract all color, spacing, and typography values into CSS custom properties or a Tailwind config. The component structure should separate the nav bar, background orbs, and each screen into independent components. State management (which screen is active, protection status, premium balance) should be handled by React state or a lightweight store (Zustand). The real-time premium streaming counter should use `requestAnimationFrame` or a `setInterval` at 1-second granularity, reading the on-chain premium balance via subgraph or RPC at 15-second intervals and interpolating between reads for smooth visual updates.

Wallet integration uses wagmi/viem with RainbowKit or ConnectKit for the connection modal. Transaction flows use wagmi's `useWriteContract` hook with optimistic UI updates (show "Confirming..." immediately, revert on failure). The premium deposit requires a standard ERC-20 approval transaction followed by the `register()` call, presented as a two-step flow ("Step 1: Approve USDC" → "Step 2: Activate Protection") with progress indicators.
