"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface LossHistogramProps {
  finalReturns: number[];
  varValue: number;
}

function buildHistogram(returns: number[], numBins = 24) {
  const min = Math.min(...returns);
  const max = Math.max(...returns);
  const binWidth = (max - min) / numBins || 0.01;
  const bins = new Array(numBins).fill(0);

  for (const r of returns) {
    let idx = Math.floor((r - min) / binWidth);
    if (idx >= numBins) idx = numBins - 1;
    if (idx < 0) idx = 0;
    bins[idx]++;
  }

  return bins.map((count, i) => {
    const binStart = min + i * binWidth;
    const binMid = binStart + binWidth / 2;
    return {
      returnPct: binMid * 100,
      count,
      isLoss: binMid < 0,
    };
  });
}

export function LossHistogram({ finalReturns, varValue }: LossHistogramProps) {
  const data = buildHistogram(finalReturns);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-border)" vertical={false} />
        <XAxis
          dataKey="returnPct"
          tickFormatter={(v: number) => `${v.toFixed(0)}%`}
          stroke="var(--text-muted)"
          fontSize={11}
          tickLine={false}
        />
        <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} width={32} />
        <Tooltip
          contentStyle={{
            background: "#EEF1FF",
            border: "1px solid var(--bg-border)",
            borderRadius: 8,
            fontSize: 12,
          }}
          labelFormatter={(v) => `수익률 구간: ${Number(v).toFixed(1)}%`}
          formatter={(value) => [`${value}회`, "시뮬레이션 횟수"]}
        />
        <ReferenceLine
          x={varValue * 100}
          stroke="var(--signal-danger)"
          strokeDasharray="4 4"
          label={{
            value: "VaR",
            position: "top",
            fill: "var(--signal-danger)",
            fontSize: 11,
          }}
        />
        <Bar dataKey="count" radius={[2, 2, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.isLoss ? "var(--signal-danger)" : "var(--signal-safe)"}
              fillOpacity={entry.isLoss ? 0.75 : 0.55}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
