"use client";
import { motion } from "framer-motion";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Archive, MoreVertical, Trash2, Pin, Star, CheckCheck, Check, Clock } from "lucide-react";
import { cn, formatMessageTime, truncate } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ContactAvatar } from "./ContactAvatar";
import { useArchiveConversation, useDeleteConversation } from "@/hooks/use-conversations";
import { useInboxStore } from "@/store/inbox-store";
import type { Conversation } from "@/lib/types";

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

/** Mini delivery icon for conversation list preview */
function PreviewTick({ status }: { status?: string }) {
  if (!status) return null;
  switch (status) {
    case "PENDING":
      return <Clock className="h-3 w-3 shrink-0" style={{ color: "#b0b3c6" }} />;
    case "SENT":
      return <Check className="h-3 w-3 shrink-0" style={{ color: "#b0b3c6" }} />;
    case "DELIVERED":
      return <CheckCheck className="h-3 w-3 shrink-0" style={{ color: "#b0b3c6" }} />;
    case "READ":
      return <CheckCheck className="h-3 w-3 shrink-0" style={{ color: "#53bdeb" }} />;
    default:
      return null;
  }
}

interface ConversationCardProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export function ConversationCard({ conversation, isActive, onClick }: ConversationCardProps) {
  const { setActiveConversation } = useInboxStore();
  const { mutateAsync: archiveConv } = useArchiveConversation();
  const { mutateAsync: deleteConv } = useDeleteConversation();

  const handleArchive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await archiveConv({ id: conversation.id, archive: !conversation.is_archived });
  };
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Delete this conversation?")) return;
    await deleteConv(conversation.id);
    setActiveConversation(null);
  };

  const hasUnread = conversation.unread_count > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="relative flex items-center gap-3 px-5 py-3.5 cursor-pointer group transition-colors"
      style={{
        background: isActive ? "#f0eeff" : "transparent",
        borderLeft: isActive ? "3px solid #7c3aed" : "3px solid transparent",
      }}
      onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = "#fafafa"; }}
      onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = "transparent"; }}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <ContactAvatar
          name={conversation.customer_name}
          phone={conversation.customer_phone}
          className="h-11 w-11"
        />
        {/* Online dot — shown when unread */}
        {hasUnread && (
          <span
            className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white"
            style={{ background: "#22c55e" }}
          />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-[14px] font-semibold truncate"
            style={{ color: "#1a1d23" }}
          >
            {conversation.customer_name || conversation.customer_phone}
          </span>
          <span
            className="text-[11px] shrink-0 whitespace-nowrap"
            style={{ color: hasUnread ? "#7c3aed" : "#b0b3c6" }}
          >
            {conversation.last_message_at
              ? (() => {
                  const d = new Date(conversation.last_message_at);
                  if (isToday(d)) return format(d, "h:mm a");
                  if (isYesterday(d)) return "Yesterday";
                  return format(d, "dd/MM/yyyy");
                })()
              : ""}
          </span>
        </div>

        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            {/* Delivery tick before the preview — only for agent's last message */}
            {conversation.last_message_sender === "AGENT" && (
              <PreviewTick status={conversation.last_message_status} />
            )}
            <p
              className="text-[12.5px] truncate"
              style={{ color: hasUnread ? "#4b4f6b" : "#9498b0", fontWeight: hasUnread ? 500 : 400 }}
            >
              {conversation.last_message_preview
                ? truncate(conversation.last_message_preview, 34)
                : <span className="italic" style={{ color: "#c0c3d6" }}>No messages yet</span>}
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Pin / Star icons (hover only) */}
            <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
              <button
                type="button"
                onClick={e => e.stopPropagation()}
                className="p-1 rounded transition-colors"
                style={{ color: "#c0c3d6" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#7c3aed")}
                onMouseLeave={e => (e.currentTarget.style.color = "#c0c3d6")}
              >
                <Pin className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={e => e.stopPropagation()}
                className="p-1 rounded transition-colors"
                style={{ color: "#c0c3d6" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#f59e0b")}
                onMouseLeave={e => (e.currentTarget.style.color = "#c0c3d6")}
              >
                <Star className="w-3 h-3" />
              </button>
            </div>

            {/* Unread badge */}
            {hasUnread && (
              <span
                className="flex items-center justify-center min-w-[20px] h-5 rounded-full text-white text-[10px] font-bold px-1.5"
                style={{ background: "#7c3aed" }}
              >
                {conversation.unread_count > 99 ? "99+" : conversation.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Context menu (hover) */}
      <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              onClick={e => e.stopPropagation()}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
              style={{ background: "#f0eeff", color: "#7c3aed" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e5e0ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f0eeff")}
            >
              <MoreVertical className="w-3.5 h-3.5" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={4}
              className="z-50 min-w-[160px] rounded-xl p-1 text-sm shadow-xl"
              style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
            >
              <DropdownMenu.Item
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer outline-none text-sm transition-colors"
                style={{ color: "#4b4f6b" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onSelect={e => { e.preventDefault(); handleArchive(e as any); }}
              >
                <Archive className="h-4 w-4" style={{ color: "#9498b0" }} />
                {conversation.is_archived ? "Unarchive" : "Archive chat"}
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-pointer outline-none text-sm transition-colors"
                style={{ color: "#ef4444" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fff5f5")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                onSelect={e => { e.preventDefault(); handleDelete(e as any); }}
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
