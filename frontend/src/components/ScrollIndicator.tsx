"use client";

export function ScrollIndicator() {
  const handleClick = () => {
    window.scrollTo({ top: window.innerHeight, behavior: "smooth" });
  };

  return (
    <button
      onClick={handleClick}
      className="mt-10 flex flex-col items-center gap-2 text-text3 transition-colors hover:text-text2"
    >
      <span className="text-xs tracking-wide">Scroll to learn more</span>
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="animate-bounce"
      >
        <path d="M4 6l4 4 4-4" />
      </svg>
    </button>
  );
}
