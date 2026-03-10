"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const SQM_TO_SQFT = 10.7639;

interface WeeklyTrendRow {
  label: string;
  txnMedianPsf: number;
  txnAvgPsf: number;
  txnCount: number;
  changePct: number | null;
  listingAvgPsf?: number;
}

interface Props {
  data: WeeklyTrendRow[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <div className="font-semibold text-gray-700 mb-2">{label}</div>
      {payload.map((entry) => (
        <div key={entry.name} className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-semibold">{entry.value.toLocaleString()} AED/sqft</span>
          <span className="text-gray-400">
            ({Math.round(entry.value * SQM_TO_SQFT).toLocaleString()} AED/sqm)
          </span>
        </div>
      ))}
    </div>
  );
}

export function PriceTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        No weekly data available for the selected filters
      </div>
    );
  }

  const hasListings = data.some((d) => d.listingAvgPsf && d.listingAvgPsf > 0);

  return (
    <div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            angle={-40}
            textAnchor="end"
            height={55}
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`}
            label={{
              value: "AED/sqft",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 10, fill: "#9ca3af" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Line
            type="monotone"
            dataKey="txnMedianPsf"
            name="Transaction Median PSF"
            stroke="#16a34a"
            strokeWidth={2.5}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
          />
          {hasListings && (
            <Line
              type="monotone"
              dataKey="listingAvgPsf"
              name="Listing Avg PSF"
              stroke="#2563eb"
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      {/* WoW annotations below chart */}
      <div className="flex flex-wrap gap-1.5 mt-3">
        {data.map((d) =>
          d.changePct !== null ? (
            <span
              key={d.label}
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: d.changePct > 2 ? "#fef2f2" : d.changePct < -2 ? "#eff6ff" : "#f0fdf4",
                color: d.changePct > 2 ? "#ef4444" : d.changePct < -2 ? "#2563eb" : "#16a34a",
              }}
            >
              {d.label}: {d.changePct > 0 ? "+" : ""}
              {d.changePct.toFixed(1)}%
            </span>
          ) : null
        )}
      </div>
    </div>
  );
}
