"use client";

export type ViewMode = "simple" | "technical";

export function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="flex bg-input rounded-xl p-0.5 text-sm">
      <button
        onClick={() => onChange("simple")}
        className={`px-4 py-1.5 rounded-[10px] font-medium transition-all ${
          mode === "simple" ? "bg-pink-dim text-pink" : "text-text2"
        }`}
      >
        Simple
      </button>
      <button
        onClick={() => onChange("technical")}
        className={`px-4 py-1.5 rounded-[10px] font-medium transition-all ${
          mode === "technical" ? "bg-pink-dim text-pink" : "text-text2"
        }`}
      >
        Technical
      </button>
    </div>
  );
}
