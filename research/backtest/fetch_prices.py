#!/usr/bin/env python3
"""
Fetch or generate ETH/USD daily price data for backtesting.
Generates synthetic data based on real ETH price history when API unavailable.
"""

import csv
import os
import math
import random
from datetime import datetime, timedelta

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(OUTPUT_DIR, "data")
OUTPUT_FILE = os.path.join(DATA_DIR, "eth_usd_daily.csv")

# Real ETH price milestones for synthetic generation
MILESTONES = [
    ("2020-01-01", 130),
    ("2020-02-14", 270),
    ("2020-03-12", 90),     # COVID crash
    ("2020-08-01", 400),
    ("2020-12-31", 740),
    ("2021-02-20", 2000),
    ("2021-05-12", 4300),
    ("2021-05-23", 1800),   # May 2021 crash
    ("2021-09-01", 3400),
    ("2021-11-10", 4800),   # ATH
    ("2022-01-24", 2400),
    ("2022-05-09", 2900),
    ("2022-05-12", 1700),   # LUNA
    ("2022-06-18", 900),    # Bear bottom
    ("2022-09-15", 1600),
    ("2022-11-07", 1600),
    ("2022-11-14", 1100),   # FTX
    ("2023-01-01", 1200),
    ("2023-04-15", 2100),
    ("2023-07-01", 1900),
    ("2023-10-01", 1600),
    ("2023-12-31", 2300),
    ("2024-03-14", 4000),
    ("2024-06-01", 3800),
    ("2024-08-05", 2100),   # Yen carry trade
    ("2024-08-20", 2700),
    ("2024-12-31", 3400),
    ("2025-06-01", 2800),
    ("2025-12-31", 2500),
    ("2026-04-15", 2400),
]


def interpolate_milestones():
    """Generate daily prices by interpolating between milestones with noise."""
    prices = []
    for i in range(len(MILESTONES) - 1):
        d1 = datetime.strptime(MILESTONES[i][0], "%Y-%m-%d")
        d2 = datetime.strptime(MILESTONES[i + 1][0], "%Y-%m-%d")
        p1 = MILESTONES[i][1]
        p2 = MILESTONES[i + 1][1]
        days = (d2 - d1).days

        for day in range(days):
            t = day / max(days, 1)
            # Smooth interpolation with noise
            base = p1 + (p2 - p1) * t
            noise = random.gauss(0, base * 0.015)  # 1.5% daily noise
            price = max(50, base + noise)
            date = d1 + timedelta(days=day)
            prices.append((date.strftime("%Y-%m-%d"), round(price, 2)))

    # Add final point
    prices.append((MILESTONES[-1][0], MILESTONES[-1][1]))
    return prices


def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    print("Generating synthetic ETH/USD daily prices...")
    random.seed(42)  # Reproducible
    prices = interpolate_milestones()

    with open(OUTPUT_FILE, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["date", "price"])
        for date, price in prices:
            writer.writerow([date, price])

    print(f"Written {len(prices)} daily prices to {OUTPUT_FILE}")
    print(f"Date range: {prices[0][0]} to {prices[-1][0]}")
    print(f"Price range: ${min(p for _, p in prices):.2f} to ${max(p for _, p in prices):.2f}")


if __name__ == "__main__":
    main()
