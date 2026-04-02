"use client";

export function ShieldDivider() {
  return (
    <div className="relative z-[2] mx-auto -my-2 flex h-10 w-10 items-center justify-center rounded-xl bg-card"
      style={{ border: "4px solid var(--bg)" }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        className="text-text2 transition-colors hover:text-pink"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    </div>
  );
}
