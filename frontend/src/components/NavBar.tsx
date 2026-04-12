"use client";

import { useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId } from "wagmi";
import Link from "next/link";

const CHAIN_NAMES: Record<number, string> = {
  11155111: "Sepolia",
  1301: "Unichain Sepolia",
  1: "Ethereum",
};

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const navLinks = [
  { label: "Protect", href: "/" },
  { label: "Positions", href: "/positions" },
  { label: "Vaults", href: "/vaults" },
  { label: "About", href: "/about" },
  { label: "Research", href: "/research" },
];

const CONNECTOR_LABELS: Record<string, string> = {
  injected: "Browser Wallet",
  metaMask: "MetaMask",
  walletConnect: "WalletConnect",
  coinbaseWalletSDK: "Coinbase Wallet",
  safe: "Safe",
};

function connectorLabel(id: string, name: string): string {
  return CONNECTOR_LABELS[id] || name;
}

function ChainBadge() {
  const chainId = useChainId();
  const { isConnected } = useAccount();
  if (!isConnected) return null;
  const name = CHAIN_NAMES[chainId] || `Chain ${chainId}`;
  return (
    <div className="hidden items-center gap-1.5 rounded-[20px] border border-card-border bg-card px-3 py-2.5 text-xs text-text2 sm:flex">
      <div className="h-2 w-2 rounded-full bg-green" />
      {name}
    </div>
  );
}

function ConnectorModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { connect, connectors, isPending } = useConnect();

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modal */}
      <div className="fixed inset-x-4 top-1/2 z-50 mx-auto max-w-[360px] -translate-y-1/2 rounded-3xl border border-card-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-text1">Connect wallet</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-input text-text3 transition-colors hover:bg-input-hover"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="space-y-2">
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                onClose();
              }}
              disabled={isPending}
              className="flex w-full items-center gap-3 rounded-2xl bg-input px-4 py-3.5 text-left text-sm font-medium text-text1 transition-colors hover:bg-input-hover active:scale-[0.98]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-card text-[12px] font-bold text-text2">
                {connectorLabel(connector.id, connector.name)[0]}
              </div>
              <span>{connectorLabel(connector.id, connector.name)}</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-center text-[12px] text-text3">
          By connecting, you agree to the IL Shield terms of service.
        </p>
      </div>
    </>
  );
}

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const [showModal, setShowModal] = useState(false);

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-[20px] border border-card-border bg-card px-4 py-2.5 text-sm font-semibold text-text1 transition-colors hover:bg-input"
      >
        {truncated}
      </button>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="rounded-[20px] bg-pink px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
      >
        Connect
      </button>
      <ConnectorModal open={showModal} onClose={() => setShowModal(false)} />
    </>
  );
}

export function NavBar() {
  return (
    <nav className="relative z-10 w-full px-4 py-3 sm:px-5">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        {/* Left: Brand + Links */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-pink sm:h-6 sm:w-6">
              <ShieldIcon size={14} />
            </div>
            <span className="text-[17px] font-semibold text-pink">IL Shield</span>
          </Link>
          <div className="flex items-center gap-4 sm:gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] text-text2 transition-colors hover:text-text1 sm:text-[15px]"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <ChainBadge />
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
