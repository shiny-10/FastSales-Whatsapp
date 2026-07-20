"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Settings, Bot } from "lucide-react";

const tabs = [
  { href: "/whatsapp/settings",         icon: Settings, label: "Configuration" },
  { href: "/whatsapp/settings/chatbot", icon: Bot,      label: "Chatbot"       },
];

export default function WhatsAppSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="p-6 space-y-5 animate-fade-up">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>WhatsApp Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>
          Manage your WhatsApp credentials and chatbot auto-reply rules.
        </p>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-1 p-1.5 rounded-2xl w-fit"
        style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
      >
        {tabs.map(({ href, icon: Icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all"
              style={{
                background: active ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "transparent",
                color: active ? "#fff" : "#9390b5",
                boxShadow: active ? "0 4px 14px rgba(124,58,237,0.3)" : "none",
              }}
            >
              <Icon size={14} />
              {label}
            </Link>
          );
        })}
      </div>

      {/* Content card */}
      <div
        className="rounded-2xl p-6"
        style={{ background: "#ffffff", border: "1px solid #ece9f8", boxShadow: "0 1px 6px rgba(100,80,200,0.07)" }}
      >
        {children}
      </div>
    </div>
  );
}
