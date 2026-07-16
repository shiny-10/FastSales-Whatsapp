"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Users,
  FileText,
  Megaphone,
  MessageCircle,
  BarChart3,
  Zap,
  Settings,
} from "lucide-react";

const menus = [
  { title: "Dashboard",     href: "/",              icon: LayoutDashboard },
  { title: "Organizations", href: "/organizations", icon: Building2 },
  { title: "Contacts",      href: "/contacts",      icon: Users },
  { title: "Templates",     href: "/templates",     icon: FileText },
  { title: "Campaigns",     href: "/campaigns",     icon: Megaphone },
  { title: "WhatsApp",      href: "/whatsapp",      icon: MessageCircle },
  { title: "Reports",       href: "/reports",       icon: BarChart3 },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col h-screen flex-shrink-0 overflow-hidden"
      style={{
        width: "var(--sidebar-w, 240px)",
        background: "linear-gradient(180deg, #0f1229 0%, #0d0f1a 100%)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
      }}
    >
      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-5">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
          >
            <Zap size={18} className="text-white" />
          </div>
          <div>
            <p className="font-bold text-[15px] text-white leading-tight">FastSales</p>
            <p className="text-[11px]" style={{ color: "rgba(255,255,255,0.38)" }}>WhatsApp CRM</p>
          </div>
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="mx-5 mb-4" style={{ height: 1, background: "rgba(255,255,255,0.06)" }} />

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto scrollbar-none">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
          Main Menu
        </p>

        {menus.map((m) => {
          const Icon = m.icon;
          const isWhatsApp = m.href === "/whatsapp";
          const active =
            m.href === "/"
              ? pathname === "/"
              : pathname === m.href || pathname.startsWith(m.href + "/");

          return (
            <Link
              key={m.title}
              href={m.href}
              className={`nav-item ${active ? "active" : ""}`}
            >
              <span
                className="icon-pill"
                style={{
                  background: active
                    ? "rgba(124,58,237,0.25)"
                    : isWhatsApp
                    ? "rgba(37,211,102,0.15)"
                    : "rgba(255,255,255,0.05)",
                }}
              >
                <Icon
                  size={16}
                  style={{
                    color: active
                      ? "#a78bfa"
                      : isWhatsApp
                      ? "#25d366"
                      : "rgba(255,255,255,0.5)",
                  }}
                />
              </span>
              <span>{m.title}</span>
              {isWhatsApp && (
                <span
                  className="ml-auto flex items-center justify-center text-[10px] font-bold rounded-full px-1.5 py-0.5 min-w-[20px]"
                  style={{ background: "#25d366", color: "#fff" }}
                >
                  Live
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom card ── */}
      <div className="p-3 mt-2">
        <div
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(124,58,237,0.22) 0%, rgba(79,70,229,0.14) 100%)",
            border: "1px solid rgba(124,58,237,0.25)",
          }}
        >
          <div className="flex items-center gap-2 mb-3">
            <span
              className="flex items-center justify-center w-7 h-7 rounded-full"
              style={{ background: "rgba(37,211,102,0.2)" }}
            >
              <MessageCircle size={13} style={{ color: "#25d366" }} />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-white leading-none">WhatsApp</p>
              <p className="text-[11px] mt-0.5" style={{ color: "#25d366" }}>● Connected</p>
            </div>
          </div>
          <Link
            href="/whatsapp/settings"
            className="flex items-center justify-center w-full rounded-xl py-2 text-[13px] font-semibold transition-all"
            style={{ background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
          >
            <Settings size={13} className="mr-1.5" />
            Settings
          </Link>
        </div>
      </div>
    </aside>
  );
}
