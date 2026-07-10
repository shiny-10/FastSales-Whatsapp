"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCheck, Check, Clock, XCircle, CornerUpLeft, Copy, Star, Trash2, Forward, Plus } from "lucide-react";
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
}

function DeliveryIcon({ status }: { status: string }) {
  switch (status) {
    case "PENDING":   return <Clock className="h-3 w-3 text-gray-400" />;
    case "SENT":      return <Check className="h-3 w-3 text-gray-400" />;
    case "DELIVERED": return <CheckCheck className="h-3 w-3 text-gray-400" />;
    case "READ":      return <CheckCheck className="h-3 w-3 text-blue-500" />;
    case "FAILED":    return <XCircle className="h-3 w-3 text-red-400" />;
    default:          return null;
  }
}

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export function MessageBubble({ message, highlight, isCurrentMatch, allMessages = [], onReply }: MessageBubbleProps) {
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
    ? allMessages.find((m) => m.id === message.reply_to_message_id)
    : null;

  // Find current user's existing reaction on this message
  const myReaction = message.reactions.find(
    (r) => r.customer_phone === (user.id || user.email)
  )?.emoji ?? null;

  const handleReaction = (emoji: string) => {
    // Same emoji = remove (send empty), different = replace
    const finalEmoji = myReaction === emoji ? "" : emoji;
    sendReaction(
      { messageId: message.id, emoji: finalEmoji, customer_phone: user.id || user.email },
      { onSuccess: (reaction) => addReaction(reaction) }
    );
    setContextOpen(false);
    setShowFullPicker(false);
  };

  const handleFullEmojiClick = (emojiData: EmojiClickData) => {
    handleReaction(emojiData.emoji);
  };

  const openContext = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = bubbleRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Position context menu below the bubble, aligned to bubble side
    setContextPos({
      x: isAgent ? rect.right - 200 : rect.left,
      y: rect.bottom + 6,
    });
    setContextOpen(true);
    setShowFullPicker(false);
  };

  // Close on outside click
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

  // Group reactions for the badge
  const groupedReactions = (() => {
    const map = new Map<string, number>();
    for (const r of message.reactions) {
      map.set(r.emoji, (map.get(r.emoji) ?? 0) + 1);
    }
    return Array.from(map.entries()); // [emoji, count]
  })();

  return (
    <>
      {/* Backdrop */}
      {contextOpen && (
        <div className="fixed inset-0 z-40" onClick={() => { setContextOpen(false); setShowFullPicker(false); }} />
      )}

      <motion.div
        initial={{ opacity: 0, y: 6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn("flex group", isAgent ? "justify-end" : "justify-start")}
      >
        <div className={cn("max-w-[72%] relative", isCurrentMatch && "ring-2 ring-brand-400 rounded-2xl")}>

          {/* Bubble */}
          <div
            ref={bubbleRef}
            onContextMenu={openContext}
            onClick={openContext}
            className={cn(
              "relative px-3 py-2 shadow-sm cursor-pointer select-none",
              isAgent
                ? "bg-[#d9fdd3] dark:bg-[#005c4b] text-gray-800 dark:text-gray-100 rounded-tl-2xl rounded-tr-2xl rounded-bl-2xl"
                : "bg-white dark:bg-[#202c33] text-gray-800 dark:text-gray-100 rounded-tl-2xl rounded-tr-2xl rounded-br-2xl",
              highlight && !isCurrentMatch && "ring-1 ring-yellow-400"
            )}
          >
            {/* Bubble tail */}
            <span className={cn("absolute bottom-0 w-3 h-3 overflow-hidden", isAgent ? "-right-2" : "-left-2")}>
              <svg viewBox="0 0 10 10" className={cn("w-3 h-3", isAgent ? "fill-[#d9fdd3] dark:fill-[#005c4b]" : "fill-white dark:fill-[#202c33]")}>
                {isAgent ? <path d="M10 10 L0 10 L10 0 Z" /> : <path d="M0 10 L10 10 L0 0 Z" />}
              </svg>
            </span>

            {/* Forwarded */}
            {(message as any).is_forwarded && (
              <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-1 italic">
                <Forward className="h-3 w-3" /> Forwarded
              </div>
            )}

            {/* Reply preview */}
            {replySource && (
              <div className={cn(
                "mb-2 pl-2 border-l-4 rounded text-xs py-1 pr-2",
                isAgent ? "border-green-400 bg-green-900/20" : "border-brand-400 bg-brand-50 dark:bg-brand-900/20"
              )}>
                <p className="font-semibold text-brand-600 dark:text-brand-400 text-[10px] mb-0.5">
                  {replySource.sender_type === "AGENT" ? "You" : "Customer"}
                </p>
                <p className="truncate text-gray-500 dark:text-gray-400">{replySource.content ?? "📎 Media"}</p>
              </div>
            )}

            {/* Media */}
            {message.media_files.length > 0 && (
              <div className="mb-1">
                <MediaViewer mediaFiles={message.media_files} messageType={message.message_type} />
              </div>
            )}

            {/* Text */}
            {message.is_deleted ? (
              <span className="italic text-sm opacity-50 flex items-center gap-1">
                <XCircle className="h-3.5 w-3.5" /> This message was deleted
              </span>
            ) : (
              message.content && (
                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed pr-10">
                  {message.content}
                </p>
              )
            )}

            {/* Caption */}
            {message.caption && <p className="text-xs mt-1 opacity-70">{message.caption}</p>}

            {/* Time + delivery */}
            <div className="flex items-center gap-1 justify-end mt-0.5 -mb-0.5">
              {starred && <Star className="h-2.5 w-2.5 fill-yellow-400 text-yellow-400" />}
              <span className="text-[10px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                {formatMessageTime(message.created_at)}
              </span>
              {isAgent && <DeliveryIcon status={message.status} />}
            </div>
          </div>

          {/* ── Reaction badges — overlapping bubble bottom ── */}
          {groupedReactions.length > 0 && (
            <div className={cn(
              "absolute -bottom-3 flex items-center gap-0.5 z-10",
              isAgent ? "right-2" : "left-2"
            )}>
              {groupedReactions.map(([emoji, count]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleReaction(emoji); }}
                  className={cn(
                    "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs shadow-md border transition-all",
                    myReaction === emoji
                      ? "bg-blue-100 dark:bg-blue-900/40 border-blue-400 dark:border-blue-500"
                      : "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-50"
                  )}
                >
                  <span>{emoji}</span>
                  {count > 1 && <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">{count}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      </motion.div>

      {/* ── WhatsApp-style context menu with reactions on top ── */}
      <AnimatePresence>
        {contextOpen && (
          <motion.div
            ref={contextRef}
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="fixed z-50 rounded-2xl bg-white dark:bg-[#233138] shadow-2xl overflow-hidden"
            style={{
              top: Math.min(contextPos.y, window.innerHeight - 320),
              left: Math.max(8, Math.min(contextPos.x, window.innerWidth - 216)),
              width: 208,
            }}
          >
            {/* Reaction row — top of context menu like WhatsApp */}
            {!showFullPicker ? (
              <>
                <div className="flex items-center justify-between px-2 py-2.5 border-b border-gray-100 dark:border-gray-700">
                  {QUICK_REACTIONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleReaction(emoji)}
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full text-xl transition-all hover:scale-125",
                        myReaction === emoji && "bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400 scale-110"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                  {/* + button opens full emoji picker */}
                  <button
                    type="button"
                    onClick={() => setShowFullPicker(true)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                {/* Action items */}
                <div className="py-1">
                  {[
                    { icon: CornerUpLeft, label: "Reply",   action: () => { onReply?.(message); setContextOpen(false); } },
                    { icon: Copy,         label: "Copy",    action: handleCopy },
                    { icon: Star,         label: starred ? "Unstar" : "Star", action: () => { setStarred((s) => !s); setContextOpen(false); } },
                    { icon: Forward,      label: "Forward", action: () => setContextOpen(false) },
                    { icon: Trash2,       label: "Delete",  action: () => setContextOpen(false), danger: true },
                  ].map(({ icon: Icon, label, action, danger }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={action}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50",
                        danger ? "text-red-500" : "text-gray-700 dark:text-gray-200"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              /* Full emoji picker */
              <div>
                <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                  <button
                    type="button"
                    onClick={() => setShowFullPicker(false)}
                    className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  >
                    ← Back
                  </button>
                  <span className="text-xs text-gray-400">Choose reaction</span>
                </div>
                <EmojiPicker
                  onEmojiClick={handleFullEmojiClick}
                  theme={"auto" as Theme}
                  height={320}
                  width={208}
                  searchDisabled={false}
                  skinTonesDisabled
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
