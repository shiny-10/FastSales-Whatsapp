"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Settings, Radio, MessageSquareReply, Bot } from "lucide-react";

const glass = {
  background: "linear-gradient(145deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.015) 100%)",
  border: "1px solid rgba(255,255,255,0.08)",
};

const tabs = [
  { href: "/whatsapp/settings",              icon: Settings,           label: "Configuration" },
  { href: "/whatsapp/settings/broadcasts",   icon: Radio,              label: "Broadcasts" },
  { href: "/whatsapp/settings/auto-replies", icon: MessageSquareReply, label: "Auto Replies" },
  { href: "/whatsapp/settings/chatbot",      icon: Bot,                label: "Chatbot" },
];

export default function WhatsAppSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen p-6 animate-fade-up">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">WhatsApp Settings</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>
            Manage your credentials, broadcasts, chatbot rules, and auto-responders.
          </p>
        </div>

        {/* Tab bar */}
        <div
          className="flex gap-1 p-1.5 rounded-2xl"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          {tabs.map(({ href, icon: Icon, label }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{
                  background: active
                    ? "linear-gradient(135deg,#7c3aed,#4f46e5)"
                    : "transparent",
                  color: active ? "#fff" : "rgba(255,255,255,0.45)",
                  boxShadow: active ? "0 4px 14px rgba(124,58,237,0.4)" : "none",
                }}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Content */}
        <div className="rounded-2xl p-6" style={glass}>
          {children}
        </div>

      </div>
    </div>
  );
}
