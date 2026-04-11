"use client";

export function TxProgressOverlay({
  step,
  message,
}: {
  step: "approve" | "register" | "settle" | "cancel";
  message: string;
}) {
  const labels: Record<string, { title: string; sub: string }> = {
    approve: { title: "Approving USDC", sub: "Waiting for wallet confirmation..." },
    register: { title: "Activating Protection", sub: "Registering your position on-chain..." },
    settle: { title: "Settling Claim", sub: "Computing IL and processing payout..." },
    cancel: { title: "Cancelling Protection", sub: "Processing refund..." },
  };

  const { title, sub } = labels[step] || { title: "Processing", sub: message };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-5 rounded-3xl border border-card-border bg-card p-8 text-center max-w-[340px] mx-4">
        {/* Animated shield spinner */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-16 w-16 animate-ping rounded-full bg-pink/20" />
          <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-pink-dim">
            <svg
              width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="var(--pink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="animate-pulse"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>
        </div>

        <div>
          <div className="text-lg font-semibold text-text1 mb-1">{title}</div>
          <div className="text-sm text-text3">{sub}</div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2 w-2 rounded-full bg-pink"
              style={{
                animation: `pulseDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                opacity: 0.3,
              }}
            />
          ))}
        </div>

        <div className="text-[12px] text-text3">
          {message || "Please confirm in your wallet"}
        </div>
      </div>
    </div>
  );
}
