"use client";
import React from "react";

export const ChartContainer = ({ children }: any) => (
  <div style={{ width: "100%", height: "100%" }}>{children}</div>
);

export const ChartTooltipContent = ({ hideLabel = false, payload = {} }: any) => {
  return (
    <div style={{ background: "#fff", border: "1px solid #ece9f8", borderRadius: 8, padding: 8 }}>
      {!hideLabel && <div style={{ fontWeight: 600 }}>{payload?.label}</div>}
      <div>{payload?.value}</div>
    </div>
  );
};

export const ChartTooltip = ({ content, ...props }: any) => (
  // Recharts will provide its own content prop; we just forward it
  <>{content}</>
);

export default ChartContainer;
