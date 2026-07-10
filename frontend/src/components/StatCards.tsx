"use client";

import React from "react";
import { TrendingUp } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ReactNode;
  color?: string;
}

export default function StatsCard({
  title,
  value,
  change,
  icon,
  color = "bg-green-500",
}: StatsCardProps) {
  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 hover:shadow-lg transition-all duration-300">

      <div className="flex items-start justify-between">

        <div>

          <p className="text-sm text-gray-500 font-medium">
            {title}
          </p>

          <h2 className="text-4xl font-bold mt-2 text-gray-800">
            {value}
          </h2>

          {change && (
            <div className="flex items-center gap-1 mt-3">

              <TrendingUp
                size={15}
                className="text-green-500"
              />

              <span className="text-green-600 text-sm font-medium">
                {change}
              </span>

            </div>
          )}

        </div>

        <div
          className={`${color} h-16 w-16 rounded-full flex items-center justify-center text-white shadow-lg`}
        >
          {icon}
        </div>

      </div>

    </div>
  );
}