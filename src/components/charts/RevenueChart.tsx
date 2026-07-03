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
import { revenueSeries } from "@/lib/mock-data";
import { formatLakhs } from "@/lib/utils";

export function RevenueChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={revenueSeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4f6ef2" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#4f6ef2" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#eef0f4" />
        <XAxis
          dataKey="day"
          tickFormatter={(d) => (d === 1 ? "1 Jun" : String(d))}
          ticks={[1, 5, 10, 15, 20, 25, 30]}
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
          labelFormatter={(d) => `Day ${d}`}
          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }}
        />
        <ReferenceLine y={100000} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1.5} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#4f6ef2"
          strokeWidth={2.5}
          fill="url(#revenueFill)"
          dot={{ r: 2.5, fill: "#4f6ef2", strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
