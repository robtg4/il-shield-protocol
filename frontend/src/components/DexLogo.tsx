"use client";

const LOGOS: Record<string, { bg: string; letter: string }> = {
  "uniswap-v4": { bg: "#FF007A", letter: "U" },
  "uniswap-v3": { bg: "#FF007A", letter: "U" },
  "pancakeswap-v3": { bg: "#1FC7D4", letter: "P" },
  "sushiswap-v3": { bg: "#FA52A0", letter: "S" },
  "aerodrome": { bg: "#0052FF", letter: "A" },
};

export function DexLogo({ dexId, size = 20 }: { dexId: string; size?: number }) {
  const config = LOGOS[dexId] || { bg: "#666", letter: "?" };

  return (
    <div
      className="flex items-center justify-center rounded-full text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: config.bg,
        fontSize: size * 0.45,
      }}
    >
      {config.letter}
    </div>
  );
}
