"use client";

import { useEffect } from "react";
import { useInboxStore } from "@/store/inbox-store";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { useConversation, useMarkConversationRead } from "@/hooks/use-conversations";
import { MessageSquareDashed } from "lucide-react";
import { cn } from "@/lib/utils";

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
    <div className="flex overflow-hidden bg-background h-full">
      {/* LEFT — Conversation List */}
      <div
        className={cn(
          "w-full md:w-80 lg:w-96 flex-shrink-0 h-full border-r border-border",
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

      {/* RIGHT — Customer Detail Panel */}
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
      <div className="h-20 w-20 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
        <MessageSquareDashed className="h-10 w-10 text-emerald-400" />
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
