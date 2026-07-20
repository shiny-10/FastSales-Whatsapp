"use client";

import React from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  gradient?: string;
  glowClass?: string;
  trend?: "up" | "down";
}

export default function StatsCard({
  title,
  value,
  change,
  icon,
  gradient = "linear-gradient(135deg,#7c3aed,#4f46e5)",
  trend = "up",
}: StatsCardProps) {
  return (
    <div
      className="rounded-2xl p-5 flex items-center justify-between"
      style={{
        background: "#ffffff",
        border: "1px solid #ece9f8",
        boxShadow: "0 1px 6px rgba(100,80,200,0.07)",
      }}
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: "#9390b5" }}>
          {title}
        </p>
        <p className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "#1a1040" }}>
          {typeof value === "number" ? value.toLocaleString() : value}
        </p>
        {change && (
          <p className="text-[11px] mt-2 font-medium" style={{ color: trend === "up" ? "#10b981" : "#f43f5e" }}>
            {trend === "up" ? "↑" : "↓"} {change}
          </p>
        )}
      </div>
      {/* Icon — light tinted background, icon color matches gradient */}
      <div
        className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0"
        style={{
          background: gradient.includes("06b6d4") ? "rgba(6,182,212,0.10)"
            : gradient.includes("10b981") ? "rgba(16,185,129,0.10)"
            : gradient.includes("f43f5e") ? "rgba(244,63,94,0.10)"
            : "rgba(124,58,237,0.10)",
        }}
      >
        <span style={{
          color: gradient.includes("06b6d4") ? "#06b6d4"
            : gradient.includes("10b981") ? "#10b981"
            : gradient.includes("f43f5e") ? "#f43f5e"
            : "#7c3aed",
        }}>
          {icon}
        </span>
      </div>
    </div>
  );
}
