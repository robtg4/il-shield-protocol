"use client";

import { ConnectKitButton } from "connectkit";

function ShieldIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}

const navLinks = ["Trade", "Explore", "Pool", "Protect"];

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
            <svg width="10" height="10" viewBox="0 0 10 10" className="text-pink" fill="currentColor">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
            </svg>
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

        {/* Center: Search */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 lg:block">
          <div className="flex min-w-[280px] items-center gap-2 rounded-[20px] border border-card-border bg-card px-4 py-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text3)" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <span className="text-sm text-text3">Search tokens, pools, and wallets</span>
            <span className="ml-auto rounded bg-input px-1.5 py-0.5 text-xs text-text3">/</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
          <button className="hidden rounded-[20px] border border-card-border px-3.5 py-2 text-sm text-text2 transition-colors hover:text-text1 sm:block">
            Get the app
          </button>
          <button className="hidden rounded-xl border border-card-border p-2 text-text2 sm:block">
            ···
          </button>
          <ConnectKitButton.Custom>
            {({ isConnected, show, truncatedAddress }) => (
              <button
                onClick={show}
                className={`rounded-[20px] px-4 py-2 text-sm font-semibold transition-colors ${
                  isConnected
                    ? "border border-card-border bg-card text-text1"
                    : "bg-pink text-white"
                }`}
              >
                {isConnected ? truncatedAddress : "Connect"}
              </button>
            )}
          </ConnectKitButton.Custom>
        </div>
      </div>
    </nav>
  );
}
