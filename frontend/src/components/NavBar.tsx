"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const navLinks = ["Pool", "Protect"];

function ConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <button
        onClick={() => disconnect()}
        className="rounded-[20px] border border-card-border bg-card px-4 py-2 text-sm font-semibold text-text1 transition-colors hover:bg-input"
      >
        {truncated}
      </button>
    );
  }

  return (
    <button
      onClick={() => {
        const connector = connectors[0];
        if (connector) connect({ connector });
      }}
      className="rounded-[20px] bg-pink px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90"
    >
      Connect
    </button>
  );
}

export function NavBar() {
  return (
    <nav className="relative z-10 w-full px-5 py-3">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between">
        {/* Left: Brand + Links */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-pink">
              <ShieldIcon size={14} />
            </div>
            <span className="text-[17px] font-semibold text-pink">IL Shield</span>
          </div>
          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <button
                key={link}
                className={`text-[15px] transition-colors ${
                  link === "Protect" ? "text-text1" : "text-text2 hover:text-text1"
                }`}
              >
                {link}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button className="hidden rounded-xl border border-card-border p-2 text-text2 sm:block">
            ···
          </button>
          <ConnectButton />
        </div>
      </div>
    </nav>
  );
}
