"use client";

import { WagmiProvider, createConfig, http } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected, walletConnect, coinbaseWallet, safe } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type Chain } from "viem";
import { type ReactNode, useState } from "react";

const unichainSepolia: Chain = {
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://sepolia.unichain.org"] },
  },
  blockExplorers: {
    default: { name: "Uniscan", url: "https://sepolia.uniscan.xyz" },
  },
  testnet: true,
};

const wcProjectId = process.env.NEXT_PUBLIC_WC_PROJECT_ID || "";

const config = createConfig({
  chains: [unichainSepolia, sepolia, mainnet],
  connectors: [
    injected(),
    coinbaseWallet({ appName: "IL Shield Protocol" }),
    safe(),
    ...(wcProjectId
      ? [walletConnect({ projectId: wcProjectId })]
      : []),
  ],
  transports: {
    [unichainSepolia.id]: http(),
    [sepolia.id]: http(),
    [mainnet.id]: http(),
  },
});

export { config };

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
