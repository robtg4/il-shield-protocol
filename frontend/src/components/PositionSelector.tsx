"use client";

import { useState, useRef, useEffect } from "react";
import type { UserPosition } from "@/hooks/useUserPositions";

export function PositionSelector({
  positions,
  selected,
  onSelect,
  isLoading,
}: {
  positions: UserPosition[];
  selected: bigint | null;
  onSelect: (tokenId: bigint) => void;
  isLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = positions.find((p) => p.tokenId === selected);

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-input p-3 animate-pulse">
        <div className="h-5 w-40 rounded bg-card" />
      </div>
    );
  }

  if (positions.length === 0) {
    return null;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-2xl bg-input px-3 py-2.5 text-left transition-colors hover:bg-input-hover"
      >
        <div className="flex items-center gap-2">
          {current ? (
            <>
              <div className="flex -space-x-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#627EEA] text-[10px] font-bold text-white">
                  {current.token0[0]}
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2775CA] text-[10px] font-bold text-white" style={{ border: "2px solid var(--input)" }}>
                  {current.token1[0]}
                </div>
              </div>
              <div>
                <div className="text-sm font-medium text-text1">
                  {current.token0}/{current.token1}
                </div>
                <div className="text-[12px] text-text3">
                  {current.feePct} fee · #{current.tokenId.toString()}
                </div>
              </div>
            </>
          ) : (
            <span className="text-sm text-text3">Select a position</span>
          )}
        </div>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text3)" strokeWidth="2" strokeLinecap="round"
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-2xl border border-card-border bg-card p-1.5 shadow-lg">
          {positions.map((pos) => (
            <button
              key={pos.tokenId.toString()}
              onClick={() => {
                onSelect(pos.tokenId);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition-colors ${
                pos.tokenId === selected
                  ? "bg-pink-dim text-pink"
                  : "hover:bg-input text-text1"
              }`}
            >
              <div className="flex -space-x-1">
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#627EEA] text-[9px] font-bold text-white">
                  {pos.token0[0]}
                </div>
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2775CA] text-[9px] font-bold text-white" style={{ border: "2px solid var(--card)" }}>
                  {pos.token1[0]}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{pos.token0}/{pos.token1}</div>
                <div className="text-[12px] text-text3">{pos.feePct} · ticks {pos.tickLower} → {pos.tickUpper}</div>
              </div>
              <span className="font-mono text-[12px] text-text3">#{pos.tokenId.toString()}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
