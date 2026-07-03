export function Sparkline({ trend, className }: { trend: "up" | "down"; className?: string }) {
  const up = "0,24 10,20 20,22 30,14 40,16 50,8 60,10 70,4 80,6 90,2 100,4";
  const down = "0,4 10,6 20,4 30,10 40,8 50,14 60,12 70,18 80,16 90,22 100,24";
  return (
    <svg viewBox="0 0 100 28" className={className ?? "h-6 w-20"} preserveAspectRatio="none">
      <polyline
        points={trend === "up" ? up : down}
        fill="none"
        stroke={trend === "up" ? "#22c55e" : "#ef4444"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
