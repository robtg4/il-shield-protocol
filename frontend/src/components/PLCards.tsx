interface Props {
  il: string;
  covered: string;
  exposure: string;
  exposurePositive?: boolean;
}

export function PLCards({ il, covered, exposure, exposurePositive }: Props) {
  return (
    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
      <div className="rounded-2xl bg-red-dim p-3 text-center">
        <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-text3">
          Current IL
        </div>
        <div className="mt-1 font-mono text-lg font-semibold text-red">
          {il}
        </div>
      </div>
      <div className="rounded-2xl bg-green-dim p-3 text-center">
        <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-text3">
          Covered
        </div>
        <div className="mt-1 font-mono text-lg font-semibold text-green">
          {covered}
        </div>
      </div>
      <div
        className={`rounded-2xl p-3 text-center ${
          exposurePositive ? "bg-green-dim" : "bg-red-dim"
        }`}
      >
        <div className="text-[12px] font-medium uppercase tracking-[0.05em] text-text3">
          Exposure
        </div>
        <div
          className={`mt-1 font-mono text-lg font-semibold ${
            exposurePositive ? "text-green" : "text-red"
          }`}
        >
          {exposure}
        </div>
      </div>
    </div>
  );
}
