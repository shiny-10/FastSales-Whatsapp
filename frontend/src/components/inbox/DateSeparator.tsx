"use client";

export function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center my-4">
      <span
        className="text-xs font-medium px-3 py-1 rounded-full"
        style={{
          background: "rgba(255,255,255,0.9)",
          color: "#9498b0",
          boxShadow: "0 1px 4px rgba(0,0,0,0.07)",
        }}
      >
        {label}
      </span>
    </div>
  );
}
