"use client";

interface Props {
  value: string;
  onChange: (val: string) => void;
  balance: string;
}

export function PremiumInput({ value, onChange, balance }: Props) {
  const dollarValue = value ? `$${parseFloat(value).toFixed(2)}` : "$0";

  return (
    <div className="rounded-2xl bg-input p-3">
      <div className="mb-1 text-[13px] text-text3">Premium deposit</div>
      <div className="flex items-center justify-between">
        <input
          type="text"
          inputMode="decimal"
          placeholder="0"
          value={value}
          onChange={(e) => {
            const v = e.target.value;
            if (/^\d*\.?\d*$/.test(v)) onChange(v);
          }}
          className="w-0 flex-1 bg-transparent text-[28px] text-text1 outline-none placeholder:text-text3"
        />
        <div className="flex items-center gap-1.5 rounded-[20px] bg-card py-1.5 pl-1.5 pr-2.5">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2775CA] text-xs font-bold text-white">
            $
          </div>
          <span className="text-base font-semibold text-text1">USDC</span>
        </div>
      </div>
      <div className="mt-1 flex items-center justify-between text-[13px] text-text3">
        <span>{dollarValue}</span>
        <span>Balance: {balance}</span>
      </div>
    </div>
  );
}
