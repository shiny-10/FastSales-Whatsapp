"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { MessageSquare, Settings, ChevronRight, Radio, Bot, MessageCircleReply, ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "@/shared/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { Avatar, AvatarFallback } from "@/shared/components/avatar";
import { ThemeToggle } from "@/shared/components/theme-toggle";
import { getInitials } from "@/shared/lib/utils";
import { useSocket } from "@/shared/hooks/socket-context";
import { useInboxStore } from "@/features/inbox/store/inbox-store";

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const { connected } = useSocket();
  const conversations = useInboxStore((s) => s.conversations);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count ?? 0), 0);

  const [settingsOpen, setSettingsOpen] = useState(() => pathname.startsWith("/settings"));

  const settingsLinks = [
    { href: "/settings/whatsapp", icon: Settings, label: "WhatsApp" },
    { href: "/settings/broadcasts", icon: Radio, label: "Broadcasts" },
    { href: "/settings/auto-replies", icon: MessageCircleReply, label: "Auto Replies" },
    { href: "/settings/chatbot", icon: Bot, label: "Chatbot" },
  ];

  return (
    <aside className="flex flex-col w-16 lg:w-56 h-screen bg-gray-950 text-white shrink-0 py-4">
      {/* Logo */}
      <div className="px-3 lg:px-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-600 flex items-center justify-center shrink-0">
            <MessageSquare className="h-4.5 w-4.5 text-white" />
          </div>
          <span className="hidden lg:block font-bold text-sm tracking-tight">
            WA Inbox
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 space-y-1">
        {/* Inbox */}
        <Link href="/inbox">
          <motion.div
            whileHover={{ x: 2 }}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              pathname.startsWith("/inbox") ? "bg-brand-600 text-white" : "text-gray-400 hover:bg-white/10 hover:text-white"
            )}
          >
            <div className="relative shrink-0">
              <MessageSquare className="h-4.5 w-4.5" />
              {totalUnread > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {totalUnread > 99 ? "99+" : totalUnread}
                </span>
              )}
            </div>
            <span className="hidden lg:block flex-1">Inbox</span>
            {pathname.startsWith("/inbox") && <ChevronRight className="hidden lg:block h-3.5 w-3.5 ml-auto opacity-60" />}
          </motion.div>
        </Link>

        {/* Settings group */}
        <button
          type="button"
          onClick={() => setSettingsOpen((v) => !v)}
          className={cn(
            "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
            pathname.startsWith("/settings") ? "text-white" : "text-gray-400 hover:bg-white/10 hover:text-white"
          )}
        >
          <Settings className="h-4.5 w-4.5 shrink-0" />
          <span className="hidden lg:block flex-1 text-left">Settings</span>
          <ChevronDown className={cn("hidden lg:block h-3.5 w-3.5 transition-transform", settingsOpen && "rotate-180")} />
        </button>

        {settingsOpen && (
          <div className="hidden lg:block pl-4 space-y-0.5">
            {settingsLinks.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link key={href} href={href}>
                  <motion.div
                    whileHover={{ x: 2 }}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                      active ? "bg-brand-600/80 text-white" : "text-gray-400 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    {label}
                  </motion.div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Mobile: show settings icons directly */}
        <div className="lg:hidden space-y-0.5">
          {settingsLinks.map(({ href, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link key={href} href={href}>
                <div className={cn(
                  "flex items-center justify-center rounded-xl p-2.5 transition-colors",
                  active ? "bg-brand-600 text-white" : "text-gray-400 hover:bg-white/10 hover:text-white"
                )}>
                  <Icon className="h-4 w-4" />
                </div>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Connection indicator */}
      <div className="px-3 mb-2">
        <div className="flex items-center gap-2 px-2 py-1.5">
          <span
            className={cn(
              "h-2 w-2 rounded-full shrink-0",
              connected ? "bg-green-400 animate-pulse" : "bg-gray-500"
            )}
          />
          <span className="hidden lg:block text-xs text-gray-500">
            {connected ? "Realtime active" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* User */}
      <div className="px-2 pt-2 border-t border-white/10">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          <Avatar className="h-7 w-7 shrink-0">
            <AvatarFallback className="text-xs bg-brand-700 text-white">
              {getInitials(user?.name)}
            </AvatarFallback>
          </Avatar>
          <div className="hidden lg:flex flex-col flex-1 min-w-0">
            <span className="text-xs font-medium truncate">{user?.name}</span>
            <span className="text-[10px] text-gray-500 capitalize">{user?.role?.toLowerCase()}</span>
          </div>
          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}
