"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCheck, Check, Clock, XCircle, CornerUpLeft,
  Copy, Star, Trash2, Forward, Plus,
} from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { cn, formatMessageTime } from "@/lib/utils";
import { MediaViewer } from "./MediaViewer";
import { useSendReaction } from "@/hooks/use-messages";
import { useInboxStore } from "@/store/inbox-store";
import { useAuthStore } from "@/store/auth-store";
import type { Message } from "@/lib/types";

interface MessageBubbleProps {
  message: Message;
  highlight?: boolean;
  isCurrentMatch?: boolean;
  allMessages?: Message[];
  onReply?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  selected?: boolean;
  onSelect?: (messageId: string, selected: boolean) => void;
  selectionMode?: boolean;
}

/** Delivery status ticks — grey single/double, blue double on READ */
export function DeliveryIcon({ status }: { status: string }) {
  switch (status) {
    case "PENDING":
      return <Clock className="h-3 w-3" style={{ color: "rgba(255,255,255,0.6)" }} />;
    case "SENT":
      return <Check className="h-3 w-3" style={{ color: "rgba(255,255,255,0.7)" }} />;
    case "DELIVERED":
      return <CheckCheck className="h-3 w-3" style={{ color: "rgba(255,255,255,0.7)" }} />;
    case "READ":
      // Blue ticks — same as real WhatsApp
      return (
        <CheckCheck
          className="h-3.5 w-3.5"
          style={{ color: "#53bdeb", filter: "drop-shadow(0 0 2px rgba(83,189,235,0.5))" }}
        />
      );
    case "FAILED":
      return <XCircle className="h-3 w-3" style={{ color: "#ff6b6b" }} />;
    default:
      return null;
  }
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({
  message,
  highlight,
  isCurrentMatch,
  allMessages = [],
  onReply,
  onDelete,
  selected = false,
  onSelect,
  selectionMode = false,
}: MessageBubbleProps) {
  const isAgent = message.sender_type === "AGENT";
  const [contextOpen, setContextOpen] = useState(false);
  const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
  const [showFullPicker, setShowFullPicker] = useState(false);
  const [starred, setStarred] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  const { mutate: sendReaction } = useSendReaction();
  const { addReaction } = useInboxStore();
  const { user } = useAuthStore();

  const replySource = message.reply_to_message_id
    ? allMessages.find((m) => String(m.id) === String(message.reply_to_message_id))
    : null;

  const myReaction = (message.reactions ?? []).find(
    (r) => r.customer_phone === (user.id || user.email)
  )?.emoji ?? null;

  const handleReaction = (emoji: string) => {
    const finalEmoji = myReaction === emoji ? "" : emoji;
    sendReaction(
      { messageId: message.id, emoji: finalEmoji, customer_phone: user.id || user.email },
      { onSuccess: (reaction) => addReaction(reaction) }
    );
    setContextOpen(false);
    setShowFullPicker(false);
  };

  const openContext = (e: React.MouseEvent) => {
    if (selectionMode) {
      // In selection mode, click toggles selection
      onSelect?.(String(message.id), !selected);
      return;
    }
    e.preventDefault();
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    setContextPos({
      x: isAgent ? rect.right - 208 : rect.left,
      y: Math.min(rect.bottom + 6, window.innerHeight - 330),
    });
    setContextOpen(true);
    setShowFullPicker(false);
  };

  const handleBubbleClick = (e: React.MouseEvent) => {
    if (selectionMode) {
      e.preventDefault();
      onSelect?.(String(message.id), !selected);
    }
  };

  useEffect(() => {
    if (!contextOpen) return;
    const handler = (e: MouseEvent) => {
      if (contextRef.current && !contextRef.current.contains(e.target as Node)) {
        setContextOpen(false);
        setShowFullPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [contextOpen]);

  const handleCopy = () => {
    if (message.content) navigator.clipboard.writeText(message.content);
    setContextOpen(false);
  };

  const handleDelete = () => {
    setContextOpen(false);
    onDelete?.(String(message.id));
  };

  const handleSelectFromMenu = () => {
    setContextOpen(false);
    onSelect?.(String(message.id), true);
  };

  const groupedReactions = (() => {
    const map = new Map<string, number>();
    for (const r of (message.reactions ?? [])) {
      map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    }
    return Array.from(map.entries());
  })();

  return (
    <>
      {contextOpen && (
        <div className="fixed inset-0 z-40" onClick={() => { setContextOpen(false); setShowFullPicker(false); }} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 4, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "flex items-end gap-2 group px-2 py-0.5 rounded-xl transition-colors",
          isAgent ? "justify-end" : "justify-start",
          selectionMode && "cursor-pointer",
          selected && "bg-violet-50",
        )}
        onClick={selectionMode ? handleBubbleClick : undefined}
      >
        {/* Selection checkbox (left side for agent, right side for customer) */}
        {selectionMode && (
          <div
            className={cn("flex-shrink-0", isAgent ? "order-first" : "order-last")}
            onClick={e => { e.stopPropagation(); onSelect?.(String(message.id), !selected); }}
          >
            <div
              className="w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all"
              style={{
                borderColor: selected ? "#7c3aed" : "#c0c3d6",
                background: selected ? "#7c3aed" : "transparent",
              }}
            >
              {selected && (
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </div>
        )}

        <div className={cn("max-w-[72%] relative", isCurrentMatch && "ring-2 ring-violet-300 rounded-2xl")}>
          {/* Bubble */}
          <div
            ref={bubbleRef}
            onContextMenu={openContext}
            onClick={selectionMode ? handleBubbleClick : openContext}
            className={cn(
              "relative px-4 py-2.5 cursor-pointer select-none",
              isAgent ? "rounded-2xl rounded-br-sm" : "rounded-2xl rounded-bl-sm",
              highlight && !isCurrentMatch && "ring-2 ring-yellow-300"
            )}
            style={{
              background: isAgent
                ? "linear-gradient(135deg, #7c3aed, #4f46e5)"
                : "#ffffff",
              boxShadow: isAgent
                ? "0 2px 12px rgba(124,58,237,0.25)"
                : "0 1px 4px rgba(0,0,0,0.08)",
            }}
          >
            {/* Tail */}
            <span className={cn("absolute bottom-0 w-3 h-3 overflow-hidden", isAgent ? "-right-1.5" : "-left-1.5")}>
              <svg viewBox="0 0 10 10" className="w-3 h-3" style={{ fill: isAgent ? "#4f46e5" : "#ffffff" }}>
                {isAgent ? <path d="M10 10 L0 10 L10 0 Z" /> : <path d="M0 10 L10 10 L0 0 Z" />}
              </svg>
            </span>

            {/* Forwarded label */}
            {(message as any).is_forwarded && (
              <div className="flex items-center gap-1 text-[10px] mb-1 italic" style={{ color: isAgent ? "rgba(255,255,255,0.6)" : "#9498b0" }}>
                <Forward className="h-3 w-3" /> Forwarded
              </div>
            )}

            {/* Reply preview */}
            {replySource && (
              <div className="mb-2 pl-3 rounded-lg text-xs py-1.5 pr-2"
                style={{ borderLeft: `3px solid ${isAgent ? "rgba(255,255,255,0.5)" : "#7c3aed"}`, background: isAgent ? "rgba(255,255,255,0.15)" : "#f0eeff" }}>
                <p className="font-semibold mb-0.5" style={{ color: isAgent ? "rgba(255,255,255,0.85)" : "#7c3aed", fontSize: "11px" }}>
                  {replySource.sender_type === "AGENT" ? "You" : "Customer"}
                </p>
                <p className="truncate" style={{ color: isAgent ? "rgba(255,255,255,0.65)" : "#6b7280" }}>
                  {replySource.content ?? "📎 Media"}
                </p>
              </div>
            )}

            {/* Media */}
            {(message.media_files ?? []).length > 0 && (
              <div className="mb-1">
                <MediaViewer mediaFiles={message.media_files} messageType={message.message_type} />
              </div>
            )}

            {/* Text */}
            {message.is_deleted ? (
              <span className="italic text-sm flex items-center gap-1" style={{ color: isAgent ? "rgba(255,255,255,0.5)" : "#b0b3c6" }}>
                <XCircle className="h-3.5 w-3.5" /> This message was deleted
              </span>
            ) : (
              message.content && (
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed pr-10"
                  style={{ color: isAgent ? "#ffffff" : "#1a1d23" }}>
                  {message.content}
                </p>
              )
            )}

            {/* Caption */}
            {message.caption && (
              <p className="text-xs mt-1" style={{ color: isAgent ? "rgba(255,255,255,0.7)" : "#9498b0" }}>
                {message.caption}
              </p>
            )}

            {/* Time + ticks */}
            <div className="flex items-center gap-1 justify-end mt-1">
              {starred && <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />}
              <span className="text-[10px] whitespace-nowrap"
                style={{ color: isAgent ? "rgba(255,255,255,0.55)" : "#b0b3c6" }}>
                {formatMessageTime(message.created_at)}
              </span>
              {/* Only show delivery ticks for agent messages */}
              {isAgent && !message.is_deleted && <DeliveryIcon status={message.status} />}
            </div>
          </div>

          {/* Reaction badges */}
          {groupedReactions.length > 0 && (
            <div className={cn("absolute -bottom-3 flex items-center gap-0.5 z-10", isAgent ? "right-2" : "left-2")}>
              {groupedReactions.map(([emoji, count]) => (
                <button key={emoji} type="button"
                  onClick={e => { e.stopPropagation(); handleReaction(emoji); }}
                  className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs transition-all"
                  style={{
                    background: myReaction === emoji ? "#f0eeff" : "#ffffff",
                    border: myReaction === emoji ? "1.5px solid #7c3aed" : "1.5px solid #e8eaf0",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  }}>
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-[10px] font-medium" style={{ color: "#9498b0" }}>{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* Context menu */}
      <AnimatePresence>
        {contextOpen && (
          <motion.div
            ref={contextRef}
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="fixed z-50 rounded-2xl shadow-2xl overflow-hidden"
            style={{
              background: "#ffffff",
              border: "1px solid #e8eaf0",
              top: contextPos.y,
              left: Math.max(8, Math.min(contextPos.x, window.innerWidth - 216)),
              width: 208,
            }}
          >
            {!showFullPicker ? (
              <>
                {/* Quick reactions */}
                <div className="flex items-center justify-between px-2 py-2.5" style={{ borderBottom: "1px solid #f0f1f5" }}>
                  {QUICK_REACTIONS.map((emoji) => (
                    <button key={emoji} type="button" onClick={() => handleReaction(emoji)}
                      className={cn("flex h-9 w-9 items-center justify-center rounded-full text-xl transition-all hover:scale-125",
                        myReaction === emoji && "ring-2 ring-violet-400 scale-110")}
                      style={{ background: myReaction === emoji ? "#f0eeff" : "transparent" }}>
                      {emoji}
                    </button>
                  ))}
                  <button type="button" onClick={() => setShowFullPicker(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full transition-colors"
                    style={{ background: "#f5f6fa", color: "#9498b0" }}>
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Actions */}
                <div className="py-1">
                  {[
                    { icon: CornerUpLeft, label: "Reply",    action: () => { onReply?.(message); setContextOpen(false); }, danger: false },
                    { icon: Copy,         label: "Copy",     action: handleCopy,              danger: false },
                    { icon: Star,         label: starred ? "Unstar" : "Star", action: () => { setStarred(s => !s); setContextOpen(false); }, danger: false },
                    { icon: Forward,      label: "Select",   action: handleSelectFromMenu,    danger: false },
                    { icon: Trash2,       label: "Delete",   action: handleDelete,            danger: true },
                  ].map(({ icon: Icon, label, action, danger }) => (
                    <button key={label} type="button" onClick={action}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors"
                      style={{ color: danger ? "#ef4444" : "#4b4f6b" }}
                      onMouseEnter={e => (e.currentTarget.style.background = danger ? "#fff5f5" : "#f5f6fa")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div>
                <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: "1px solid #f0f1f5" }}>
                  <button type="button" onClick={() => setShowFullPicker(false)}
                    className="text-xs transition-colors" style={{ color: "#9498b0" }}
                    onMouseEnter={e => (e.currentTarget.style.color = "#4b4f6b")}
                    onMouseLeave={e => (e.currentTarget.style.color = "#9498b0")}>
                    ← Back
                  </button>
                  <span className="text-xs" style={{ color: "#b0b3c6" }}>Choose reaction</span>
                </div>
                <EmojiPicker
                  onEmojiClick={(d: EmojiClickData) => handleReaction(d.emoji)}
                  theme={"light" as Theme}
                  height={320} width={208}
                  searchDisabled={false} skinTonesDisabled
                  previewConfig={{ showPreview: false }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
