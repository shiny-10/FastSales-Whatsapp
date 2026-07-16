"use client";

import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

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
  glowClass = "ring-violet",
  trend = "up",
}: StatsCardProps) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-5 hover-lift ${glowClass}`}
      style={{
        background: "linear-gradient(145deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.015) 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {/* Background glow blob */}
      <div
        className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20 blur-2xl pointer-events-none"
        style={{ background: gradient }}
      />

      <div className="relative flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "rgba(255,255,255,0.4)" }}>
            {title}
          </p>
          <p className="text-3xl font-bold text-white leading-none tabular-nums">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {change && (
            <div className="flex items-center gap-1.5 mt-3">
              {trend === "up" ? (
                <TrendingUp size={13} style={{ color: "#10b981" }} />
              ) : (
                <TrendingDown size={13} style={{ color: "#f43f5e" }} />
              )}
              <span
                className="text-xs font-medium"
                style={{ color: trend === "up" ? "#10b981" : "#f43f5e" }}
              >
                {change}
              </span>
            </div>
          )}
        </div>

        {/* Icon pill */}
        <div
          className="flex items-center justify-center w-11 h-11 rounded-xl text-white flex-shrink-0"
          style={{ background: gradient, boxShadow: "0 8px 24px rgba(0,0,0,0.3)" }}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
