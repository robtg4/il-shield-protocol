/** Historical scenario data and comparison helpers */

/** Historical probability of ETH moving ±X% in 30 days (backtested 2020-2025) */
export const HISTORICAL_MOVE_PROB: Record<number, number> = {
  5: 0.89,
  8: 0.67,
  10: 0.58,
  15: 0.42,
  20: 0.31,
  30: 0.18,
  50: 0.07,
};

/** Get the closest historical probability for a given move */
export function getHistoricalProb(movePct: number): number {
  const keys = Object.keys(HISTORICAL_MOVE_PROB).map(Number).sort((a, b) => a - b);
  let closest = keys[0];
  for (const k of keys) {
    if (Math.abs(k - movePct) < Math.abs(closest - movePct)) closest = k;
  }
  return HISTORICAL_MOVE_PROB[closest] ?? 0.5;
}

/** Format USD amount for display */
export function formatUSD(amount: number, decimals: number = 0): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : amount > 0 ? "+" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: decimals })}`;
  if (abs >= 1) return `${sign}$${abs.toFixed(decimals || 2)}`;
  return `${sign}$${abs.toFixed(decimals || 2)}`;
}

/** Get a relatable cost comparison for a monthly amount */
export function getCostComparison(monthlyCost: number): string {
  if (monthlyCost < 5) return "less than a coffee";
  if (monthlyCost < 20) return "less than a lunch";
  if (monthlyCost < 50) return "less than Netflix";
  if (monthlyCost < 100) return "less than a gym membership";
  if (monthlyCost < 200) return "less than car insurance";
  return "a small fraction of your position";
}
