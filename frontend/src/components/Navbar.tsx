"use client";

import { useState } from "react";
import { Search, Bell, ChevronDown, Moon, Sun } from "lucide-react";

export default function Navbar() {
  const [query, setQuery] = useState("");

  return (
    <header
      className="flex items-center justify-between px-6 h-16 flex-shrink-0"
      style={{
        background: "rgba(13,15,26,0.7)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Search ── */}
      <div className="relative w-80">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
          style={{ color: "rgba(255,255,255,0.3)" }}
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search anything…"
          className="w-full pl-9 pr-4 py-2 text-sm rounded-xl focus:outline-none focus:ring-2 placeholder-[rgba(255,255,255,0.2)] text-[rgba(255,255,255,0.8)]"
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.08)",
            transition: "border-color 0.2s",
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      </div>

      {/* ── Right cluster ── */}
      <div className="flex items-center gap-3">

        {/* Notifications */}
        <button
          className="relative p-2.5 rounded-xl transition-colors"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
          aria-label="Notifications"
        >
          <Bell size={17} style={{ color: "rgba(255,255,255,0.6)" }} />
          <span
            className="absolute -top-1 -right-1 flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-white"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
          >
            3
          </span>
        </button>

        {/* Divider */}
        <div className="w-px h-6" style={{ background: "rgba(255,255,255,0.08)" }} />

        {/* User pill */}
        <button
          className="flex items-center gap-2.5 rounded-xl px-3 py-2 transition-colors"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="flex items-center justify-center w-7 h-7 rounded-lg text-white text-xs font-bold"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
          >
            A
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[13px] font-semibold text-white leading-tight">Admin</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.4)" }}>Super Admin</p>
          </div>
          <ChevronDown size={13} style={{ color: "rgba(255,255,255,0.35)" }} />
        </button>
      </div>
    </header>
  );
}
