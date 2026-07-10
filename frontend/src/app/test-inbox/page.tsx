"use client";

import { useEffect } from "react";
import { useInboxStore } from "@/store/inbox-store";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { useConversation, useMarkConversationRead } from "@/hooks/use-conversations";

export default function TestInbox() {
  const { activeConversationId, setActiveConversation } = useInboxStore();

  const { data: conversation } = useConversation(activeConversationId);

  const { mutate: markConversationRead } = useMarkConversationRead();

  useEffect(() => {
    if (activeConversationId) {
      markConversationRead(activeConversationId);
    }
  }, [activeConversationId, markConversationRead]);

  return (
    <div className="h-screen flex">

      <div className="w-80 border-r">
        <ConversationList />
      </div>

      <div className="flex-1">
        {activeConversationId && (
          <ChatWindow
            conversationId={activeConversationId}
            onBack={() => setActiveConversation(null)}
          />
        )}
      </div>

      {activeConversationId && conversation && (
        <div className="w-72 border-l">
          <CustomerPanel conversation={conversation} />
        </div>
      )}

    </div>
  );
}