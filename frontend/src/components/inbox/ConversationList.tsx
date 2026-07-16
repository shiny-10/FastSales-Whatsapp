"use client";
import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageSquareDashed, Plus, SlidersHorizontal } from "lucide-react";
import { useConversations } from "@/hooks/use-conversations";
import { useInboxStore } from "@/store/inbox-store";
import { ConversationCard } from "./ConversationCard";
import { ConversationSkeleton } from "./ConversationSkeleton";
import { NewContactModal } from "./NewContactModal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import type { ConversationStatus } from "@/lib/types";

const TABS: Array<{ label: string; status: ConversationStatus | null; archived?: boolean; badge?: number }> = [
  { label: "All Messages", status: null },
  { label: "Unread",       status: "OPEN" },
  { label: "Waiting",      status: "PENDING" },
  { label: "Assigned",     status: "RESOLVED" },
  { label: "Archived",     status: null, archived: true },
];

export function ConversationList() {
  const {
    activeConversationId, setActiveConversation,
    setConversations, searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    archivedFilter, setArchivedFilter,
  } = useInboxStore();

  const { connected } = useSocket();

  const { data, isLoading } = useConversations({
    search: searchQuery || undefined,
    status: (statusFilter as ConversationStatus) || undefined,
    archived: archivedFilter ?? undefined,
    page_size: 50,
  });

  useEffect(() => {
    if (data?.items) setConversations(data.items);
  }, [data, setConversations]);

  const conversations = data?.items ?? [];
  const activeTabKey = archivedFilter ? "Archived" : statusFilter ?? "All Messages";

  const handleTabClick = (tab: (typeof TABS)[number]) => {
    if (tab.archived) { setStatusFilter(null); setArchivedFilter(true); }
    else { setArchivedFilter(null); setStatusFilter(tab.status); }
  };

  return (
    <div className="flex flex-col h-full" style={{ background: "#ffffff" }}>

      {/* ── Header ── */}
      <div
        className="px-5 pt-5 pb-3 flex-shrink-0"
        style={{ borderBottom: "1px solid #f0f1f5" }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold" style={{ color: "#1a1d23" }}>Messages</h2>
            {/* Live dot */}
            <span
              title={connected ? "Live" : "Connecting…"}
              className={cn(
                "inline-block w-2 h-2 rounded-full transition-colors",
                connected ? "bg-emerald-500" : "bg-amber-400 animate-pulse"
              )}
            />
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ background: "#f5f6fa", color: "#8b8fa8" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#ebebf5")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f5f6fa")}
              title="Filter"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
            <NewContactModal onCreated={(id) => setActiveConversation(id)} />
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none" style={{ color: "#b0b3c6" }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search something..."
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl focus:outline-none transition-all"
            style={{
              background: "#f5f6fa",
              border: "1.5px solid #f0f1f5",
              color: "#1a1d23",
              fontSize: "13px",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "#7c3aed44")}
            onBlur={e => (e.currentTarget.style.borderColor = "#f0f1f5")}
          />
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none">
          {TABS.map((tab) => {
            const key = tab.archived ? "Archived" : (tab.status ?? "All Messages");
            const isActive = activeTabKey === key;
            const count = tab.label === "All Messages" ? data?.total : undefined;
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleTabClick(tab)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
                style={{
                  background: isActive ? "#7c3aed" : "transparent",
                  color: isActive ? "#ffffff" : "#8b8fa8",
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#f5f6fa"; }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
              >
                {tab.label}
                {count !== undefined && count > 0 && (
                  <span
                    className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full text-[10px] font-bold px-1"
                    style={{
                      background: isActive ? "rgba(255,255,255,0.25)" : "#7c3aed",
                      color: isActive ? "#ffffff" : "#ffffff",
                    }}
                  >
                    {count > 99 ? "99+" : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── List ── */}
      <ScrollArea className="flex-1 overflow-y-auto">
        {isLoading ? (
          <ConversationSkeleton />
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <MessageSquareDashed className="h-10 w-10" style={{ color: "#e0e2eb" }} />
            <p className="text-sm" style={{ color: "#b0b3c6" }}>No conversations found</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {conversations.map((conv) => (
              <ConversationCard
                key={conv.id}
                conversation={conv}
                isActive={activeConversationId === conv.id}
                onClick={() => setActiveConversation(conv.id)}
              />
            ))}
          </AnimatePresence>
        )}
      </ScrollArea>

      {/* ── Footer ── */}
      {data && data.total > 0 && (
        <div className="px-5 py-2 flex-shrink-0" style={{ borderTop: "1px solid #f0f1f5" }}>
          <p className="text-[11px]" style={{ color: "#b0b3c6" }}>
            {data.total} conversation{data.total !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
