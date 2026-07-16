"use client";
import { useEffect } from "react";
import { useInboxStore } from "@/store/inbox-store";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { useConversation, useMarkConversationRead } from "@/hooks/use-conversations";
import { MessageSquareDashed, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export default function InboxPage() {
  const { activeConversationId, setActiveConversation } = useInboxStore();
  const { data: conversation } = useConversation(activeConversationId);
  const { mutate: markConversationRead } = useMarkConversationRead();

  useEffect(() => {
    if (activeConversationId) markConversationRead(activeConversationId);
  }, [activeConversationId, markConversationRead]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: "#f5f6fa" }}>

      {/* ── LEFT: Conversation list ── */}
      <div
        className={cn(
          "flex flex-col h-full flex-shrink-0",
          activeConversationId ? "hidden md:flex" : "flex w-full md:w-[340px]"
        )}
        style={{
          width: "340px",
          minWidth: "340px",
          background: "#ffffff",
          borderRight: "1px solid #e8eaf0",
        }}
      >
        <ConversationList />
      </div>

      {/* ── CENTER: Chat window ── */}
      <div
        className={cn(
          "flex flex-col flex-1 h-full relative overflow-hidden",
          !activeConversationId ? "hidden md:flex" : "flex"
        )}
        style={{ background: "#f5f6fa" }}
      >
        {activeConversationId ? (
          <ChatWindow
            conversationId={activeConversationId}
            onBack={() => setActiveConversation(null)}
          />
        ) : (
          <EmptyState />
        )}
      </div>

      {/* ── RIGHT: Customer panel (xl only) ── */}
      {activeConversationId && conversation && (
        <div
          className="hidden xl:flex xl:flex-col h-full flex-shrink-0"
          style={{ width: "280px", background: "#ffffff", borderLeft: "1px solid #e8eaf0" }}
        >
          <CustomerPanel conversation={conversation} />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-6 select-none"
      style={{ background: "#f5f6fa" }}
    >
      <div
        className="flex items-center justify-center w-20 h-20 rounded-2xl"
        style={{ background: "linear-gradient(135deg,#7c3aed22,#4f46e511)", border: "1.5px solid #7c3aed33" }}
      >
        <MessageSquareDashed className="w-10 h-10" style={{ color: "#7c3aed" }} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold" style={{ color: "#1a1d23" }}>
          Select a conversation
        </h2>
        <p className="text-sm mt-2 max-w-xs" style={{ color: "#8b8fa8" }}>
          Choose a conversation from the list to start chatting with your customers.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#b0b3c6" }}>
        <Lock className="w-3 h-3" />
        End-to-end encrypted
      </div>
    </div>
  );
}
