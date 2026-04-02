"use client";

const tokenColors: Record<string, string> = {
  ETH: "#627EEA",
  USDC: "#2775CA",
  WBTC: "#F09242",
};

const tokenSymbols: Record<string, string> = {
  ETH: "\u039E",
  USDC: "$",
  WBTC: "\u20BF",
};

interface Props {
  token0: string;
  token1: string;
  onClick?: () => void;
}

export function TokenPairSelector({ token0, token1, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-[20px] bg-input py-1.5 pl-1.5 pr-2.5"
    >
      <div className="flex items-center">
        <div
          className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ backgroundColor: tokenColors[token0] || "#8B5CF6" }}
        >
          {tokenSymbols[token0] || token0[0]}
        </div>
        <div
          className="-ml-2.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{
            backgroundColor: tokenColors[token1] || "#4C82FB",
            border: "2px solid var(--input)",
          }}
        >
          {tokenSymbols[token1] || token1[0]}
        </div>
      </div>
      <span className="text-base font-semibold text-text1">
        {token0}/{token1}
      </span>
      <svg width="12" height="12" viewBox="0 0 12 12" className="text-text2" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 4.5L6 7.5L9 4.5" />
      </svg>
    </button>
  );
}
