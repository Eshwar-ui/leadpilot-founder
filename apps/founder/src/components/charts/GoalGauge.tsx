export function GoalGauge({ pct }: { pct: number }) {
  const r = 80;
  const cx = 100;
  const cy = 100;
  const semiLength = Math.PI * r;
  const progress = (Math.min(100, Math.max(0, pct)) / 100) * semiLength;

  return (
    <svg viewBox="0 0 200 115" className="w-full">
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#eef0f4"
        strokeWidth={14}
        strokeLinecap="round"
      />
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#4f6ef2"
        strokeWidth={14}
        strokeLinecap="round"
        strokeDasharray={`${progress} ${semiLength}`}
      />
    </svg>
  );
}
