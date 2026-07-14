"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Settings, Radio, MessageSquareReply, Bot } from "lucide-react";

export default function WhatsAppSettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  const tabs = [
    { href: "/whatsapp/settings", icon: Settings, label: "Configuration" },
    { href: "/whatsapp/settings/broadcasts", icon: Radio, label: "Broadcasts" },
    { href: "/whatsapp/settings/auto-replies", icon: MessageSquareReply, label: "Auto Replies" },
    { href: "/whatsapp/settings/chatbot", icon: Bot, label: "Chatbot" },
  ];

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold">WhatsApp Settings</h1>
          <p className="text-gray-500 mt-2">Manage your credentials, broadcasts, chatbot rules, and auto-responders.</p>
        </div>

        {/* Settings Navigation Tabs */}
        <div className="flex border-b border-slate-200 gap-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = pathname === tab.href;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 pb-4 text-sm font-medium border-b-2 transition-all ${
                  active
                    ? "border-emerald-600 text-emerald-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
