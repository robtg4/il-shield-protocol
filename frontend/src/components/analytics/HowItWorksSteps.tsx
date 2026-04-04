"use client";

export function HowItWorksSteps() {
  return (
    <div className="rounded-2xl bg-input p-4">
      <div className="text-[13px] text-text3 font-medium mb-4">How it works</div>

      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-dim text-[12px] font-semibold text-pink">1</span>
          <div>
            <div className="text-sm text-text1 font-medium">You deposit a small premium</div>
            <div className="text-[12px] text-text3">Like insurance. Streams per-block.</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-dim text-[12px] font-semibold text-pink">2</span>
          <div>
            <div className="text-sm text-text1 font-medium">Keep LPing normally on Uniswap</div>
            <div className="text-[12px] text-text3">Nothing changes. Earn fees as usual.</div>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-pink-dim text-[12px] font-semibold text-pink">3</span>
          <div>
            <div className="text-sm text-text1 font-medium">Close your position anytime</div>
            <div className="text-[12px] text-text3">If ETH moved &rarr; we pay you back. If not &rarr; unused premium refunded.</div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-dim">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="text-[12px] text-green">Payout is automatic. USDC in your wallet. No claims process.</div>
      </div>
    </div>
  );
}
