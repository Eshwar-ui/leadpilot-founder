"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { RevenuePoint } from "@/lib/api";
import { formatLakhs } from "@/lib/utils";

function shortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export function RevenueChart({ data, targetPerDay }: { data: RevenuePoint[]; targetPerDay: number | null }) {
  // Index the series by array position, not the calendar "day" number — a 90D
  // (or even 30D, month-boundary-crossing) range repeats day-of-month values
  // (e.g. two "1"s), and recharts' category axis matches ticks/tooltips by
  // value, so a duplicate would resolve to the wrong point.
  const indexed = data.map((p, i) => ({ ...p, i }));
  const tickEvery = Math.max(1, Math.ceil(indexed.length / 7));
  const ticks = indexed.filter((p) => p.i % tickEvery === 0 || p.i === indexed.length - 1).map((p) => p.i);

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={indexed} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f6ef2" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4f6ef2" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eef0f4" />
        <XAxis
          dataKey="i"
          type="number"
          domain={["dataMin", "dataMax"]}
          ticks={ticks}
          tickFormatter={(i) => String(data[i]?.day ?? "")}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={{ stroke: "#eef0f4" }}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(v) => formatLakhs(v).replace("₹", "₹")}
          tick={{ fontSize: 11, fill: "#94a3b8" }}
          axisLine={false}
          tickLine={false}
          width={50}
        />
        <Tooltip
          formatter={((value: number) => [formatLakhs(value), "Revenue"]) as never}
          labelFormatter={((_label: number, payload: Array<{ payload: RevenuePoint }>) => {
            const point = payload?.[0]?.payload;
            return point ? shortDate(point.date) : "";
          }) as never}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        {targetPerDay != null && (
          <ReferenceLine y={targetPerDay} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />
        )}
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#4f6ef2"
          strokeWidth={2.5}
          fill="url(#revenueFill)"
          dot={{ r: 2.5, fill: "#4f6ef2", strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
