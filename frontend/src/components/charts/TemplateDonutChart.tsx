"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TemplateOverview = {
  approved: number;
  pending: number;
  rejected: number;
  disabled: number;
};

const COLORS = ["#22c55e", "#f59e0b", "#ef4444", "#94a3b8"];

export default function TemplateDonutChart({ data }: { data: TemplateOverview }) {
  const chartData = [
    { name: "Approved", value: data.approved },
    { name: "Pending", value: data.pending },
    { name: "Rejected", value: data.rejected },
    { name: "Disabled", value: data.disabled },
  ];

  return (
    <div className="flex items-center justify-between h-[330px]">
      <div className="w-[60%] h-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              innerRadius={70}
              outerRadius={110}
              paddingAngle={3}
            >
              {chartData.map((entry, index) => (
                <Cell key={`${entry.name}-${index}`} fill={COLORS[index]} />
              ))}
            </Pie>

            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="w-[40%] space-y-5 pr-4">
        <div className="flex justify-between">
          <span className="text-green-600 font-medium">● Approved</span>
          <span>{data.approved}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-yellow-500 font-medium">● Pending</span>
          <span>{data.pending}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-red-500 font-medium">● Rejected</span>
          <span>{data.rejected}</span>
        </div>

        <div className="flex justify-between">
          <span className="text-gray-500 font-medium">● Disabled</span>
          <span>{data.disabled}</span>
        </div>
      </div>
    </div>
  );
}
