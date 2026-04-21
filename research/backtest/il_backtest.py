#!/usr/bin/env python3
"""
IL Shield Historical Backtest Engine
=====================================
Simulates IL Shield protection over 5+ years of ETH/USD data.
Computes IL, premiums, payouts, and net P&L at each coverage tier.

Usage: python3 il_backtest.py
"""

import csv
import json
import math
import os
import sys
from dataclasses import dataclass, asdict
from typing import List

DATA_FILE = os.path.join(os.path.dirname(__file__), "data", "eth_usd_daily.csv")
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "data", "backtest_results.json")

# ── Protocol Parameters ──
VOL_FLOOR = 0.70            # 70% annualized
RISK_LOADING_BASE = 1.40
RISK_LOADING_SLOPE = 0.80
VOL_THRESHOLD = 0.50
C_LEVEL = 1.0               # Actuarially neutral (no stress surcharge)
FEE_RATE = 0.003            # 0.30%
SETTLEMENT_FEE = 0.02       # 2%
BLOCKS_PER_YEAR = 2_628_000
BLOCKS_PER_DAY = 7200
TICK_RANGE_PCT = 0.20       # ±20% concentrated range
POSITION_VALUE = 10_000     # $10K starting position

# Coverage tiers
TIERS = {0: 0.50, 1: 0.75, 2: 1.00}


def load_prices() -> List[tuple]:
    """Load (date, price) pairs from CSV."""
    prices = []
    with open(DATA_FILE) as f:
        reader = csv.DictReader(f)
        for row in reader:
            prices.append((row["date"], float(row["price"])))
    return prices


def compute_il_pct(price_ratio: float) -> float:
    """Full-range IL as percentage: IL = 1 - 2*sqrt(r)/(1+r)."""
    if price_ratio <= 0:
        return 1.0
    r = price_ratio
    return 1.0 - (2.0 * math.sqrt(r)) / (1.0 + r)


def concentration_factor(tick_range_pct: float) -> float:
    """Approximate concentration factor for a ±X% range."""
    # C(R) ≈ 1 / (2 * range_pct) for narrow ranges
    if tick_range_pct <= 0:
        return 1.0
    return min(1.0 / (2.0 * tick_range_pct), 25.0)


def compute_premium_rate(sigma: float, conc_factor: float, tier_mult: float) -> float:
    """Compute premium rate per block (annualized fraction)."""
    gross_il = (sigma ** 2 / 8.0) * conc_factor / BLOCKS_PER_YEAR
    fee_income = 0  # Conservative: no fee offset (matching our oracle config)
    net_il = max(0, gross_il - fee_income)

    risk_loading = RISK_LOADING_BASE + max(0, (sigma - VOL_THRESHOLD) * RISK_LOADING_SLOPE)
    rate = net_il * risk_loading * tier_mult * C_LEVEL
    return rate


def compute_realized_vol(prices: List[float], window: int = 30) -> float:
    """30-day realized volatility (annualized)."""
    if len(prices) < 2:
        return VOL_FLOOR
    returns = [math.log(prices[i] / prices[i-1]) for i in range(1, len(prices)) if prices[i-1] > 0]
    if len(returns) < 5:
        return VOL_FLOOR
    variance = sum(r ** 2 for r in returns[-window:]) / min(window, len(returns))
    vol = math.sqrt(variance * 365)
    return max(vol, VOL_FLOOR)


@dataclass
class EpochResult:
    start_date: str
    end_date: str
    entry_price: float
    exit_price: float
    price_change_pct: float
    il_pct_full_range: float
    il_pct_concentrated: float
    il_usd: float
    realized_vol: float
    premium_paid: dict  # tier -> USD
    payout: dict        # tier -> USD
    net_pnl: dict       # tier -> USD


def run_backtest(prices: List[tuple], epoch_days: int = 30) -> dict:
    """Run the full backtest simulation."""
    dates = [p[0] for p in prices]
    price_vals = [p[1] for p in prices]

    conc = concentration_factor(TICK_RANGE_PCT)
    epochs: List[EpochResult] = []

    total_premium = {0: 0, 1: 0, 2: 0}
    total_payout = {0: 0, 1: 0, 2: 0}
    total_il = 0

    i = 0
    while i + epoch_days < len(prices):
        entry_price = price_vals[i]
        exit_price = price_vals[i + epoch_days]
        price_ratio = exit_price / entry_price if entry_price > 0 else 1.0

        # IL computation
        il_pct_full = compute_il_pct(price_ratio)
        il_pct_conc = min(il_pct_full * math.sqrt(conc), 1.0)
        il_usd = POSITION_VALUE * il_pct_conc

        # Realized vol for this window
        window_prices = price_vals[max(0, i-30):i+epoch_days]
        realized_vol = compute_realized_vol(window_prices)

        # Premium and payout per tier
        premium_paid = {}
        payout = {}
        net_pnl = {}

        for tier, mult in TIERS.items():
            # Premium for this epoch — rate is fractional (% per block per $ of position)
            rate_per_block = compute_premium_rate(realized_vol, conc, mult)
            epoch_blocks = epoch_days * BLOCKS_PER_DAY
            # Premium = rate × blocks × position_value gives absolute USD cost
            # But rate already includes concentration, so don't double-count
            premium = rate_per_block * epoch_blocks * POSITION_VALUE
            # Sanity cap: premium can't exceed the expected IL for this tier
            premium = min(premium, il_usd * mult * 1.5)  # Max 1.5x IL as premium
            premium_paid[tier] = round(premium, 4)

            # Payout: IL * tier * (1 - settlement fee)
            raw_payout = il_usd * mult * (1 - SETTLEMENT_FEE)
            payout[tier] = round(raw_payout, 4)

            # Net P&L from protection
            net_pnl[tier] = round(payout[tier] - premium_paid[tier], 4)

            total_premium[tier] += premium_paid[tier]
            total_payout[tier] += payout[tier]

        total_il += il_usd

        epochs.append(EpochResult(
            start_date=dates[i],
            end_date=dates[i + epoch_days],
            entry_price=entry_price,
            exit_price=exit_price,
            price_change_pct=round((price_ratio - 1) * 100, 2),
            il_pct_full_range=round(il_pct_full * 100, 4),
            il_pct_concentrated=round(il_pct_conc * 100, 4),
            il_usd=round(il_usd, 2),
            realized_vol=round(realized_vol * 100, 1),
            premium_paid=premium_paid,
            payout=payout,
            net_pnl=net_pnl,
        ))

        i += epoch_days  # Non-overlapping epochs

    # Summary statistics
    n_epochs = len(epochs)
    years = n_epochs * epoch_days / 365.25

    summary = {
        "total_epochs": n_epochs,
        "years": round(years, 1),
        "position_value": POSITION_VALUE,
        "epoch_days": epoch_days,
        "tick_range_pct": TICK_RANGE_PCT,
        "total_il_usd": round(total_il, 2),
        "avg_il_per_epoch": round(total_il / max(n_epochs, 1), 2),
    }

    for tier, mult in TIERS.items():
        tier_label = f"tier_{int(mult*100)}"
        combined_ratio = total_payout[tier] / max(total_premium[tier], 0.01)
        annual_premium = total_premium[tier] / max(years, 0.01)
        annual_payout = total_payout[tier] / max(years, 0.01)
        annual_net = (total_payout[tier] - total_premium[tier]) / max(years, 0.01)

        # LP returns: base fee yield + net protection benefit
        base_fee_yield = FEE_RATE * 365 / 30 * 0.5  # rough: fees * utilization
        annual_return_unhedged = base_fee_yield - (total_il / max(years, 0.01) / POSITION_VALUE)
        annual_return_hedged = annual_return_unhedged + annual_net / POSITION_VALUE

        summary[f"{tier_label}_total_premium"] = round(total_premium[tier], 2)
        summary[f"{tier_label}_total_payout"] = round(total_payout[tier], 2)
        summary[f"{tier_label}_total_net"] = round(total_payout[tier] - total_premium[tier], 2)
        summary[f"{tier_label}_combined_ratio"] = round(combined_ratio, 3)
        summary[f"{tier_label}_annual_premium"] = round(annual_premium, 2)
        summary[f"{tier_label}_annual_payout"] = round(annual_payout, 2)
        summary[f"{tier_label}_annual_net_benefit"] = round(annual_net, 2)
        summary[f"{tier_label}_annual_return_unhedged_pct"] = round(annual_return_unhedged * 100, 2)
        summary[f"{tier_label}_annual_return_hedged_pct"] = round(annual_return_hedged * 100, 2)

    # Stress period analysis
    stress_periods = [
        ("COVID Crash", "2020-03-01", "2020-03-31"),
        ("May 2021 Crash", "2021-05-10", "2021-06-10"),
        ("LUNA Collapse", "2022-05-01", "2022-05-31"),
        ("FTX Collapse", "2022-11-01", "2022-11-30"),
        ("Bear Bottom", "2022-06-01", "2022-06-30"),
        ("Yen Carry Trade", "2024-08-01", "2024-08-31"),
    ]

    stress_results = []
    for name, start, end in stress_periods:
        period_epochs = [e for e in epochs if start <= e.start_date <= end or start <= e.end_date <= end]
        if period_epochs:
            max_il = max(e.il_usd for e in period_epochs)
            avg_il = sum(e.il_usd for e in period_epochs) / len(period_epochs)
            max_price_drop = min(e.price_change_pct for e in period_epochs)
            stress_results.append({
                "event": name,
                "period": f"{start} to {end}",
                "max_il_usd": round(max_il, 2),
                "avg_il_usd": round(avg_il, 2),
                "max_price_drop_pct": round(max_price_drop, 2),
                "payout_100_tier": round(max_il * 1.0 * 0.98, 2),
            })

    results = {
        "summary": summary,
        "stress_tests": stress_results,
        "epochs": [asdict(e) for e in epochs],
    }

    return results


def main():
    if not os.path.exists(DATA_FILE):
        print(f"Price data not found at {DATA_FILE}. Run fetch_prices.py first.")
        sys.exit(1)

    prices = load_prices()
    print(f"Loaded {len(prices)} daily prices")

    results = run_backtest(prices)

    with open(OUTPUT_FILE, "w") as f:
        json.dump(results, f, indent=2)

    print(f"\nResults written to {OUTPUT_FILE}")
    print(f"\n=== BACKTEST SUMMARY ({results['summary']['years']} years) ===")
    print(f"Total epochs: {results['summary']['total_epochs']}")
    print(f"Total IL: ${results['summary']['total_il_usd']:,.2f}")
    print(f"Avg IL/epoch: ${results['summary']['avg_il_per_epoch']:,.2f}")

    for tier in [50, 75, 100]:
        t = f"tier_{tier}"
        print(f"\n--- {tier}% Coverage ---")
        print(f"  Premium paid: ${results['summary'][f'{t}_total_premium']:,.2f}")
        print(f"  Payout received: ${results['summary'][f'{t}_total_payout']:,.2f}")
        print(f"  Net benefit: ${results['summary'][f'{t}_total_net']:,.2f}")
        print(f"  Combined ratio: {results['summary'][f'{t}_combined_ratio']:.2f}x")
        print(f"  Annual return (unhedged): {results['summary'][f'{t}_annual_return_unhedged_pct']:.1f}%")
        print(f"  Annual return (hedged): {results['summary'][f'{t}_annual_return_hedged_pct']:.1f}%")

    print(f"\n=== STRESS TESTS ===")
    for s in results["stress_tests"]:
        print(f"  {s['event']}: max IL ${s['max_il_usd']:,.2f}, max drop {s['max_price_drop_pct']:.1f}%, payout (100%): ${s['payout_100_tier']:,.2f}")


if __name__ == "__main__":
    main()
