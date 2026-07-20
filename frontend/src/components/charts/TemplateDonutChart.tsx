"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";

type TemplateOverview = {
  approved: number;
  pending: number;
  rejected: number;
  disabled: number;
};

const SLICES = [
  { key: "approved", label: "Approved", color: "#10b981" },
  { key: "pending",  label: "Pending",  color: "#f59e0b" },
  { key: "rejected", label: "Rejected", color: "#f43f5e" },
  { key: "disabled", label: "Disabled", color: "#94a3b8" },
];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const { name, value, fill } = payload[0].payload;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid #ece9f8",
      borderRadius: "10px",
      padding: "8px 14px",
      boxShadow: "0 4px 16px rgba(100,80,200,0.12)",
      fontSize: "12px",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: 8, height: 8, borderRadius: "50%", background: fill, display: "inline-block" }} />
        <span style={{ color: "#4b4880", fontWeight: 600 }}>{name}</span>
        <span style={{ fontWeight: 700, color: "#1a1040", marginLeft: 4 }}>{value}</span>
      </div>
    </div>
  );
}

export default function TemplateDonutChart({ data }: { data: TemplateOverview }) {
  const chartData = SLICES.map(s => ({
    name:  s.label,
    value: data[s.key as keyof TemplateOverview],
    fill:  s.color,
  }));

  // Give zero-value slices a tiny sliver so the pie always renders
  const displayData = chartData.map(d => ({ ...d, value: d.value === 0 ? 0.1 : d.value }));

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%", gap: "8px" }}>

      {/* Simple Pie chart — left */}
      <div style={{ flex: "0 0 50%", height: "240px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomTooltip />} cursor={false} />
            <Pie
              data={displayData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              strokeWidth={2}
              stroke="#fff"
              paddingAngle={2}
            >
              {displayData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend — right, matches uploaded picture style */}
      <div style={{
        flex: "0 0 50%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: "22px",
        paddingLeft: "12px",
      }}>
        {SLICES.map(s => (
          <div
            key={s.key}
            style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            {/* Dot + Label */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{
                width: 13,
                height: 13,
                borderRadius: "50%",
                background: s.color,
                display: "inline-block",
                flexShrink: 0,
              }} />
              <span style={{
                fontSize: "15px",
                fontWeight: 600,
                color: s.color,
              }}>
                {s.label}
              </span>
            </div>
            {/* Count */}
            <span style={{
              fontSize: "16px",
              fontWeight: 700,
              color: "#1a1040",
            }}>
              {data[s.key as keyof TemplateOverview]}
            </span>
          </div>
        ))}
      </div>

    </div>
  );
}
