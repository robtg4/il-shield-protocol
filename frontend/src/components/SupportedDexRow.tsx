"use client";

import { DexLogo } from "./DexLogo";
import { DEX_REGISTRY } from "@/config/dex-registry";

export function SupportedDexRow() {
  // Always show ALL supported DEXs — this is informational, not functional
  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-[13px] text-text3">Protect LP positions on</span>
      <div className="flex items-center gap-5 flex-wrap justify-center">
        {DEX_REGISTRY.map((dex) => {
          const hasAnyAdapter = Object.values(dex.adapters).some(
            (a) => a !== "0x0000000000000000000000000000000000000000"
          );
          return (
            <div key={dex.id} className="flex flex-col items-center gap-1.5">
              <div className={hasAnyAdapter ? "" : "opacity-40"}>
                <DexLogo dexId={dex.id} size={32} />
              </div>
              <span className="text-[12px] text-text3">{dex.shortName}</span>
              {!hasAnyAdapter && (
                <span className="text-[10px] text-text3 -mt-1">soon</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
