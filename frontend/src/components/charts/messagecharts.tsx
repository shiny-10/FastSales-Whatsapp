"use client";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";

import { Line } from "react-chartjs-2";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type MessageSummary = {
  sent: number;
  delivered: number;
  read: number;
  failed: number;
};

export default function Messagecharts({ summary }: { summary: MessageSummary }) {
  const data = {
    labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
    datasets: [
      {
        label: "Sent",
        data: [summary.sent, summary.sent, summary.sent, summary.sent],
        borderColor: "#22c55e",
        backgroundColor: "#22c55e",
        tension: 0.4,
      },
      {
        label: "Delivered",
        data: [summary.delivered, summary.delivered, summary.delivered, summary.delivered],
        borderColor: "#2563eb",
        backgroundColor: "#2563eb",
        tension: 0.4,
      },
      {
        label: "Read",
        data: [summary.read, summary.read, summary.read, summary.read],
        borderColor: "#9333ea",
        backgroundColor: "#9333ea",
        tension: 0.4,
      },
      {
        label: "Failed",
        data: [summary.failed, summary.failed, summary.failed, summary.failed],
        borderColor: "#ef4444",
        backgroundColor: "#ef4444",
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top" as const,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: "#e5e7eb",
        },
      },
      x: {
        grid: {
          display: false,
        },
      },
    },
  };

  return (
    <div className="w-full h-80">
      <Line data={data} options={options} />
    </div>
  );
}
