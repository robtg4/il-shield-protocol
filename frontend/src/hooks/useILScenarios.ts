"use client";

import { useMemo } from "react";
import { computeIL, computePayout, findBreakEven } from "@/lib/ilmath";

interface ScenarioResult {
  move: number;
  il: number;
  payout50: number;
  payout75: number;
  payout100: number;
}

export function useILScenarios(positionValueUSD: number, monthlyPremium: number) {
  return useMemo(() => {
    const moves = [5, 10, 20, 30, 50];

    const scenarios: ScenarioResult[] = moves.map((move) => {
      const il = computeIL(positionValueUSD, move);
      return {
        move,
        il,
        payout50: computePayout(il, 0),
        payout75: computePayout(il, 1),
        payout100: computePayout(il, 2),
      };
    });

    const breakEven = findBreakEven(positionValueUSD, monthlyPremium);

    return { scenarios, breakEven };
  }, [positionValueUSD, monthlyPremium]);
}
