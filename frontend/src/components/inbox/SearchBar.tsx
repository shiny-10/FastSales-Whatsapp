"use client";
import { Search, X } from "lucide-react";
import { useInboxStore } from "@/store/inbox-store";

export function SearchBar() {
  const { searchQuery, setSearchQuery } = useInboxStore();

  return (
    <div className="relative">
      <Search
        className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
        style={{ color: "#b0b3c6" }}
      />
      <input
        type="text"
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        placeholder="Search conversations…"
        className="w-full pl-9 pr-8 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
        style={{
          background: "#f5f6fa",
          border: "1.5px solid #f0f1f5",
          color: "#1a1d23",
          fontSize: "13px",
        }}
        onFocus={e => (e.currentTarget.style.borderColor = "#7c3aed44")}
        onBlur={e => (e.currentTarget.style.borderColor = "#f0f1f5")}
      />
      {searchQuery && (
        <button
          type="button"
          onClick={() => setSearchQuery("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 rounded-full transition-colors"
          style={{ background: "#e0e2eb", color: "#9498b0" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#d0d2e0")}
          onMouseLeave={e => (e.currentTarget.style.background = "#e0e2eb")}
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
