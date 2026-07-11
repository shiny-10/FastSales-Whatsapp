"use client";

import { motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, MoreVertical, Trash2 } from "lucide-react";
import type { MouseEvent } from "react";
import { cn, getInitials, truncate, formatMessageTime } from "@/shared/lib/utils";
import { ContactAvatar } from "./ContactAvatar";
import { StatusBadge } from "./StatusBadge";
import { useArchiveConversation, useDeleteConversation } from "@/features/inbox/api/use-conversations";
import { useInboxStore } from "@/features/inbox/store/inbox-store";
import type { Conversation } from "@/shared/types";

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationCard({
  conversation,
  isActive,
  onClick,
}: ConversationCardProps) {
  const { setActiveConversation } = useInboxStore();
  const { mutateAsync: archiveConv } = useArchiveConversation();
  const { mutateAsync: deleteConv } = useDeleteConversation();

  const handleArchive = async () => {
    await archiveConv({ id: conversation.id, archive: !conversation.is_archived });
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) {
      return;
    }
    await deleteConv(conversation.id);
    setActiveConversation(null);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={cn(
        "w-full cursor-pointer text-left px-4 py-3 flex gap-3 items-start transition-colors rounded-xl mx-1",
        isActive
          ? "bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700"
          : "hover:bg-muted/50"
      )}
    >
      {/* Avatar */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className="flex h-10 w-10 shrink-0 rounded-full p-0.5"
        aria-label="Open conversation"
      >
        <ContactAvatar name={conversation.customer_name} phone={conversation.customer_phone} className="h-10 w-10" />
      </button>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate">
            {conversation.customer_name || conversation.customer_phone}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            {conversation.last_message_at
              ? formatMessageTime(conversation.last_message_at)
              : ""}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {conversation.last_message_preview
              ? truncate(conversation.last_message_preview, 40)
              : "No messages yet"}
          </p>
          <div className="flex items-center gap-1.5 shrink-0">
            {conversation.is_archived && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Archived
              </span>
            )}
            {conversation.unread_count > 0 && (
              <span className="flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-brand-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            )}
            <StatusBadge status={conversation.status} className="text-[10px] px-1.5 py-0" />
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              onClick={(event) => event.stopPropagation()}
              className="rounded-full border border-border bg-background p-2 text-muted-foreground hover:bg-accent"
              aria-label="Conversation actions"
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              className="z-50 min-w-[160px] rounded-xl border border-border bg-popover p-1 shadow-lg"
            >
              <DropdownMenu.Item
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-accent"
                onSelect={(event) => {
                  event.preventDefault();
                  handleArchive();
                }}
              >
                <Archive className="h-4 w-4" />
                {conversation.is_archived ? "Unarchive chat" : "Archive chat"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-destructive/10 text-destructive"
                onSelect={(event) => {
                  event.preventDefault();
                  handleDelete();
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete chat
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </div>
    </motion.div>
  );
}
