"use client";

import { useChainId } from "wagmi";
import { DexLogo } from "./DexLogo";
import { getDexesForChain, DEX_REGISTRY } from "@/config/dex-registry";

export function SupportedDexRow() {
  const chainId = useChainId();
  // Show chain-specific DEXs if connected, otherwise show all
  const dexes = chainId ? getDexesForChain(chainId) : DEX_REGISTRY;
  const displayed = dexes.length > 0 ? dexes : DEX_REGISTRY;

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="text-[13px] text-text3">Protect LP positions on</span>
      <div className="flex items-center gap-5">
        {displayed.map((dex) => (
          <div key={dex.id} className="flex flex-col items-center gap-1.5">
            <DexLogo dexId={dex.id} size={32} />
            <span className="text-[11px] text-text3">{dex.shortName}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
