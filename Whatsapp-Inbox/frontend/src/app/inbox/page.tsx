"use client";

import { useEffect, useState } from "react";
import { useInboxStore } from "@/features/inbox/store/inbox-store";
import { ConversationList } from "@/features/inbox/components/ConversationList";
import { ChatWindow } from "@/features/inbox/components/ChatWindow";
import { CustomerPanel } from "@/features/inbox/components/CustomerPanel";
import { useConversation, useMarkConversationRead } from "@/features/inbox/api/use-conversations";
import { MessageSquareDashed } from "lucide-react";
import { cn } from "@/shared/lib/utils";

export default function InboxPage() {
  const { activeConversationId, setActiveConversation } = useInboxStore();
  const { data: conversation } = useConversation(activeConversationId);
  const { mutate: markConversationRead } = useMarkConversationRead();

  useEffect(() => {
    if (activeConversationId) {
      markConversationRead(activeConversationId);
    }
  }, [activeConversationId, markConversationRead]);

  return (
    <div className="h-screen flex overflow-hidden bg-background">
      {/* LEFT — Conversation List (fixed width) */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 flex-shrink-0 h-full",
          activeConversationId ? "hidden md:flex md:flex-col" : "flex flex-col"
        )}
      >
        <ConversationList />
      </div>

      {/* CENTER — Chat Window */}
      <div
        className={cn(
          "flex-1 h-full relative",
          !activeConversationId ? "hidden md:flex" : "flex flex-col"
        )}
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

      {/* RIGHT — Customer Panel */}
      {activeConversationId && conversation && (
        <div className="hidden xl:flex xl:flex-col w-72 h-full border-l border-border bg-background">
          <CustomerPanel conversation={conversation} />
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8">
      <div className="h-20 w-20 rounded-2xl bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
        <MessageSquareDashed className="h-10 w-10 text-brand-400" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Select a conversation</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Choose a conversation from the left to start chatting
        </p>
      </div>
    </div>
  );
}
