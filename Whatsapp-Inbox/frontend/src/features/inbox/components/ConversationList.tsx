"use client";

import { useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { MessageSquare, Archive } from "lucide-react";
import { useConversations } from "@/features/inbox/api/use-conversations";
import { useInboxStore } from "@/features/inbox/store/inbox-store";
import { ConversationCard } from "./ConversationCard";
import { ConversationSkeleton } from "./ConversationSkeleton";
import { SearchBar } from "./SearchBar";
import { NewContactModal } from "./NewContactModal";
import { ScrollArea } from "@/shared/components/scroll-area";
import { cn } from "@/shared/lib/utils";
import type { ConversationStatus } from "@/shared/types";

const TABS: Array<{ label: string; status: ConversationStatus | null; archived?: boolean }> = [
  { label: "All", status: null },
  { label: "Open", status: "OPEN" },
  { label: "Pending", status: "PENDING" },
  { label: "Resolved", status: "RESOLVED" },
  { label: "Closed", status: "CLOSED" },
  { label: "Archived", status: null, archived: true },
];

export function ConversationList() {
  const {
    activeConversationId,
    setActiveConversation,
    setConversations,
    searchQuery,
    statusFilter,
    setStatusFilter,
    archivedFilter,
    setArchivedFilter,
  } = useInboxStore();

  const { data, isLoading } = useConversations({
    search: searchQuery || undefined,
    status: (statusFilter as ConversationStatus) || undefined,
    archived: archivedFilter ?? undefined,
    page_size: 50,
  });

  useEffect(() => {
    if (data?.items) setConversations(data.items);
  }, [data]);

  const conversations = data?.items ?? [];

  const activeTab = archivedFilter ? "Archived" : (statusFilter ?? "All");

  const handleTabClick = (tab: typeof TABS[number]) => {
    if (tab.archived) {
      setStatusFilter(null);
      setArchivedFilter(true);
    } else {
      setArchivedFilter(null);
      setStatusFilter(tab.status);
    }
  };

  return (
    <div className="flex flex-col h-full border-r border-border bg-background">
      {/* Header */}
      <div className="px-4 pt-5 pb-3 border-b border-border space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-base">Conversations</h2>
          <NewContactModal onCreated={(conversationId) => setActiveConversation(conversationId)} />
        </div>
        <SearchBar />
        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none -mx-1 px-1 pb-0.5">
          {TABS.map((tab) => {
            const isActive = activeTab === (tab.archived ? "Archived" : (tab.status ?? "All"));
            return (
              <button
                key={tab.label}
                type="button"
                onClick={() => handleTabClick(tab)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap",
                  isActive
                    ? "bg-brand-600 text-white"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {tab.archived ? <span className="flex items-center gap-1"><Archive className="h-3 w-3" />{tab.label}</span> : tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="py-2 space-y-0.5">
          {isLoading ? (
            <ConversationSkeleton />
          ) : conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">No conversations found</p>
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
        </div>
      </ScrollArea>

      {/* Footer count */}
      {data && (
        <div className="px-4 py-2 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {data.total} conversation{data.total !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
