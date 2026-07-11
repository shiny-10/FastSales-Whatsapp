"use client";

import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { cn } from "@/shared/lib/utils";

interface CannedResponse {
  id: string;
  shortcut: string;
  content: string;
}

interface CannedResponsesProps {
  query: string; // text after "/"
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function CannedResponses({ query, onSelect, onClose }: CannedResponsesProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  const { data = [] } = useQuery<CannedResponse[]>({
    queryKey: ["canned-responses", query],
    queryFn: async () => {
      const { data } = await api.get("/api/canned-responses", { params: query ? { q: query } : {} });
      return data;
    },
    staleTime: 10_000,
  });

  useEffect(() => { setActiveIdx(0); }, [data]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, data.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === "Enter" && data[activeIdx]) { e.preventDefault(); onSelect(data[activeIdx].content); }
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [data, activeIdx, onSelect, onClose]);

  if (!data.length) return null;

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white dark:bg-[#233138] rounded-2xl shadow-2xl border border-border overflow-hidden z-50 max-h-56 overflow-y-auto">
      <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wide border-b border-border">
        Canned Responses
      </div>
      {data.map((item, idx) => (
        <button
          key={item.id}
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(item.content); }}
          className={cn(
            "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
            idx === activeIdx ? "bg-brand-50 dark:bg-brand-900/20" : "hover:bg-gray-50 dark:hover:bg-gray-700/40"
          )}
        >
          <span className="text-xs font-mono font-semibold text-brand-600 dark:text-brand-400 shrink-0 mt-0.5">
            /{item.shortcut}
          </span>
          <span className="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">{item.content}</span>
        </button>
      ))}
    </div>
  );
}
