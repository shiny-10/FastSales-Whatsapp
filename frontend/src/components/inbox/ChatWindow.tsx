"use client";

import {
  useEffect, useRef, useState, useCallback, KeyboardEvent, useMemo,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send, MoreVertical, ArrowLeft, Search, X,
  ChevronUp, ChevronDown, Pencil, Smile, ArrowDown, CornerUpLeft, FileText, Trash2,
} from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useInboxStore } from "@/store/inbox-store";
import { useMessages, useSendTextMessage, useDeleteMessage, useDeleteMessages } from "@/hooks/use-messages";
import { useConversation, useUpdateConversation } from "@/hooks/use-conversations";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { MessageSkeleton } from "./MessageSkeleton";
import { DateSeparator } from "./DateSeparator";
import { ContactAvatar } from "./ContactAvatar";
import { AssignAgentModal } from "./AssignAgentModal";
import { useSocket } from "@/lib/socket-context";
import { cn, formatLastSeen, isSameDay, formatDateSeparator } from "@/lib/utils";
import { MediaUploadButton } from "./MediaUploadButton";
import { VoiceRecorder, VoiceMicButton } from "./VoiceRecorder";
import { FilePreview } from "./FilePreview";
import { CannedResponses } from "./CannedResponses";
import { TemplateModal } from "./TemplateModal";
import type { Message } from "@/lib/types";

type MediaCategory = "image" | "video" | "audio" | "document";
const ACCEPT_MAP: Record<MediaCategory, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/3gpp",
  audio: "audio/mpeg,audio/ogg,audio/opus,audio/aac",
  document: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
};

interface ChatWindowProps {
  conversationId: string;
  onBack?: () => void;
  onContactClick?: () => void;
}

export function ChatWindow({ conversationId, onBack, onContactClick }: ChatWindowProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchIndex, setSearchIndex] = useState(0);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [filePreview, setFilePreview] = useState<{ file: File; type: MediaCategory } | null>(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [cannedQuery, setCannedQuery] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { mutateAsync: updateConv } = useUpdateConversation();
  const { typingMap, messages: storeMessages, addMessage } = useInboxStore();
  const { emitTyping, joinConversation } = useSocket();
  const queryClient = useQueryClient();

  // ── Multi-select state ──────────────────────────────────────────────────────
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const { data: conversation } = useConversation(conversationId);
  const { data: messagesData, fetchNextPage, hasNextPage, isLoading: msgsLoading } = useMessages(conversationId);
  const { mutateAsync: sendText } = useSendTextMessage();
  const { mutateAsync: deleteMessage } = useDeleteMessage();
  const { mutateAsync: deleteMessages } = useDeleteMessages();

  const isTyping = typingMap[conversationId] ?? false;

  const allMessages: Message[] = useMemo(() => {
    const pages = messagesData?.pages ?? [];
    const flat = pages.flatMap((p) => p.items);
    const storeConvMsgs = storeMessages[conversationId] ?? [];
    const merged = [...flat, ...storeConvMsgs];
    // Normalise id to string so "9" and 9 are treated as the same key
    const deduped = Array.from(
      new Map(merged.map((m) => [String(m.id), m])).values()
    );
    return deduped.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }, [messagesData, storeMessages, conversationId]);

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allMessages
      .map((m, i) => ({ index: i, id: m.id, match: !!m.content?.toLowerCase().includes(q) }))
      .filter((m) => m.match);
  }, [searchQuery, allMessages]);

  const currentMatch = searchMatches[searchIndex];

  // Scroll to bottom
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Show/hide scroll-to-bottom button
  const handleScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { scrollToBottom("instant"); }, [conversationId]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (!showScrollBtn) scrollToBottom(); }, [allMessages.length, isTyping]);
  useEffect(() => { if (currentMatch) document.getElementById(`msg-${currentMatch.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [currentMatch]);
  useEffect(() => { setTimeout(() => setSearchIndex(0), 0); }, [searchQuery]);
  useEffect(() => { if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50); else setTimeout(() => setSearchQuery(""), 0); }, [searchOpen]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (conversation) setTimeout(() => setNameValue(conversation.customer_name ?? ""), 0); }, [conversation?.customer_name]);
  useEffect(() => { if (editingName) nameInputRef.current?.focus(); }, [editingName]);
  useEffect(() => { joinConversation(conversationId); }, [conversationId, joinConversation]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 128)}px`;
  }, [text]);

  const handleNameSave = async () => {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (trimmed === (conversation?.customer_name ?? "")) return;
    await updateConv({ id: conversationId, customer_name: trimmed || undefined });
  };

  const handleNameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleNameSave();
    if (e.key === "Escape") { setNameValue(conversation?.customer_name ?? ""); setEditingName(false); }
  };

  const handleSend = async () => {
    if (!text.trim() || isSending) return;
    setIsSending(true);
    try {
      const msg = await sendText({
        conversation_id: conversationId,
        content: text.trim(),
        ...(replyTo ? { reply_to_message_id: replyTo.id } : {}),
      });
      addMessage(msg);
      setText("");
      setReplyTo(null);
      scrollToBottom();
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.message ||
        "Failed to send message. Check your WhatsApp connection.";
      alert(`⚠️ ${detail}`);
      console.error("sendText failed", e);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleTyping = useCallback(() => { emitTyping(conversationId); }, [conversationId, emitTyping]);

  const handleMediaSent = useCallback((message: Message) => {
    addMessage(message);
    queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }, [addMessage, conversationId, queryClient]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setText((prev) => prev + emojiData.emoji);
    setShowEmojiPicker(false);
    textareaRef.current?.focus();
  };

  // Canned responses: detect "/" prefix
  const handleTextChange = (val: string) => {
    setText(val);
    handleTyping();
    if (val.startsWith("/")) {
      setCannedQuery(val.slice(1));
    } else {
      setCannedQuery(null);
    }
  };

  const handleCannedSelect = (content: string) => {
    setText(content);
    setCannedQuery(null);
    textareaRef.current?.focus();
  };

  // ── Message delete (single) ─────────────────────────────────────────────────
  const handleDeleteMessage = useCallback(async (messageId: string) => {
    if (!window.confirm("Delete this message?")) return;
    // Optimistic remove from cache immediately
    queryClient.setQueryData(["messages", conversationId], (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          items: page.items.filter((m: any) => String(m.id) !== messageId),
        })),
      };
    });
    // Persist to backend
    try {
      await deleteMessage(messageId);
    } catch {
      // On failure, refetch to restore accurate state
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  }, [conversationId, queryClient, deleteMessage]);

  // ── Multi-select ────────────────────────────────────────────────────────────
  const handleSelectMessage = useCallback((messageId: string, sel: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (sel) next.add(messageId); else next.delete(messageId);
      return next;
    });
    if (!selectionMode) setSelectionMode(true);
  }, [selectionMode]);

  const handleDeleteSelected = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} message${selectedIds.size > 1 ? "s" : ""}?`)) return;
    const ids = Array.from(selectedIds);
    // Optimistic remove
    queryClient.setQueryData(["messages", conversationId], (old: any) => {
      if (!old?.pages) return old;
      return {
        ...old,
        pages: old.pages.map((page: any) => ({
          ...page,
          items: page.items.filter((m: any) => !selectedIds.has(String(m.id))),
        })),
      };
    });
    setSelectedIds(new Set());
    setSelectionMode(false);
    // Persist to backend
    try {
      await deleteMessages(ids);
    } catch {
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
    }
  }, [selectedIds, conversationId, queryClient, deleteMessages]);

  const handleCancelSelection = useCallback(() => {
    setSelectedIds(new Set());
    setSelectionMode(false);
  }, []);

  // File picker for preview-before-send
  const triggerFilePicker = (type: MediaCategory) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = ACCEPT_MAP[type];
      (fileInputRef.current as any)._pendingType = type;
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const type = (e.target as any)._pendingType as MediaCategory;
    if (file && type) setFilePreview({ file, type });
    e.target.value = "";
  };

  if (!conversation) {
    return <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="flex flex-col h-full" style={{ background: "#f5f6fa" }}>

      {/* ── Header ── */}
      <div
        className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
        style={{ background: "#ffffff", borderBottom: "1px solid #f0f1f5" }}
      >
        {onBack && (
          <button type="button" onClick={onBack} className="shrink-0 md:hidden p-1.5 rounded-lg transition-colors" style={{ color: "#9498b0" }}>
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={onContactClick}
          className="shrink-0 rounded-full focus:outline-none"
          title="View contact info"
        >
          <ContactAvatar name={conversation.customer_name} phone={conversation.customer_phone} className="h-10 w-10" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 group">
            {editingName ? (
              <input
                ref={nameInputRef}
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameSave}
                className="font-semibold text-sm focus:outline-none border-b-2 bg-transparent"
                style={{ borderColor: "#7c3aed", color: "#1a1d23", width: "160px" }}
                placeholder="Enter name"
              />
            ) : (
              <>
                <span
                  className="font-semibold text-[14px] cursor-pointer hover:underline"
                  style={{ color: "#1a1d23" }}
                  onClick={onContactClick}
                  title="View contact info"
                >
                  {conversation.customer_name || conversation.customer_phone}
                </span>
                <button
                  type="button"
                  onClick={() => { setNameValue(conversation.customer_name ?? ""); setEditingName(true); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ color: "#b0b3c6" }}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              </>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: "#b0b3c6" }}>
            {conversation.last_message_at ? `last seen ${formatLastSeen(conversation.last_message_at)}` : conversation.customer_phone}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <AssignAgentModal conversationId={conversationId} currentAgentId={conversation.assigned_agent_id}>
            <button
              type="button"
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: "#f0eeff", color: "#7c3aed" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#e5e0ff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f0eeff")}
            >
              {conversation.assigned_agent_id ? "Reassign" : "Assign"}
            </button>
          </AssignAgentModal>
          {[
            { icon: Search, action: () => setSearchOpen(v => !v) },
            { icon: MoreVertical, action: () => {} },
          ].map(({ icon: Icon, action }, i) => (
            <button
              key={i}
              type="button"
              onClick={action}
              className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
              style={{ color: "#9498b0" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div
          className="flex items-center gap-2 px-4 py-2 flex-shrink-0"
          style={{ background: "#ffffff", borderBottom: "1px solid #f0f1f5" }}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "#b0b3c6" }} />
          <input
            ref={searchInputRef}
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search messages…"
            className="flex-1 text-sm focus:outline-none bg-transparent"
            style={{ color: "#1a1d23" }}
          />
          {searchQuery && (
            <span className="text-xs shrink-0" style={{ color: "#9498b0" }}>
              {searchMatches.length === 0 ? "No results" : `${searchIndex + 1}/${searchMatches.length}`}
            </span>
          )}
          <button type="button" disabled={searchMatches.length === 0} onClick={() => setSearchIndex(i => (i - 1 + searchMatches.length) % searchMatches.length)} style={{ color: "#b0b3c6" }}><ChevronUp className="h-3.5 w-3.5" /></button>
          <button type="button" disabled={searchMatches.length === 0} onClick={() => setSearchIndex(i => (i + 1) % searchMatches.length)} style={{ color: "#b0b3c6" }}><ChevronDown className="h-3.5 w-3.5" /></button>
          <button type="button" onClick={() => setSearchOpen(false)} style={{ color: "#b0b3c6" }}><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="text-center py-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: "#f0eeff", color: "#7c3aed" }}
          >
            Load older messages
          </button>
        </div>
      )}

      {/* ── Messages area ── */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-1"
        style={{ background: "#f5f6fa" }}
      >
        {msgsLoading ? (
          <MessageSkeleton />
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm" style={{ color: "#b0b3c6" }}>
            No messages yet. Start the conversation!
          </div>
        ) : (
          allMessages.map((msg, idx) => {
            const prev = allMessages[idx - 1];
            const showSeparator = !prev || !isSameDay(prev.created_at, msg.created_at);
            return (
              <div key={String(msg.id)} id={`msg-${msg.id}`}>
                {showSeparator && <DateSeparator label={formatDateSeparator(msg.created_at)} />}
                <MessageBubble
                  message={msg}
                  allMessages={allMessages}
                  highlight={!!searchQuery && !!msg.content?.toLowerCase().includes(searchQuery.toLowerCase())}
                  isCurrentMatch={currentMatch?.id === msg.id}
                  onReply={setReplyTo}
                  onDelete={handleDeleteMessage}
                  selected={selectedIds.has(String(msg.id))}
                  onSelect={handleSelectMessage}
                  selectionMode={selectionMode}
                />
              </div>
            );
          })
        )}
        <AnimatePresence>
          {isTyping && <TypingIndicator />}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-6 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-colors"
            style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
          >
            <ArrowDown className="h-4 w-4" style={{ color: "#7c3aed" }} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* File preview */}
      {filePreview && (
        <FilePreview
          file={filePreview.file}
          mediaType={filePreview.type}
          conversationId={conversationId}
          onSent={msg => { handleMediaSent(msg); setFilePreview(null); }}
          onCancel={() => setFilePreview(null)}
        />
      )}

      {/* Template modal */}
      {showTemplateModal && (
        <TemplateModal
          conversationId={conversationId}
          onSent={handleMediaSent}
          onClose={() => setShowTemplateModal(false)}
        />
      )}

      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      {/* ── Composer or Selection Toolbar ── */}
      {selectionMode ? (
        /* ── Selection toolbar ── */
        <div
          className="px-4 py-3 flex items-center justify-between flex-shrink-0"
          style={{ background: "#ffffff", borderTop: "1px solid #f0f1f5" }}
        >
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCancelSelection}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors"
              style={{ background: "#f5f6fa", color: "#4b4f6b", border: "1px solid #e8eaf0" }}
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
            <span className="text-sm font-medium" style={{ color: "#7c3aed" }}>
              {selectedIds.size} selected
            </span>
          </div>
          <button
            type="button"
            onClick={handleDeleteSelected}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-40"
            style={{
              background: selectedIds.size > 0
                ? "linear-gradient(135deg,#ef4444,#dc2626)"
                : "#e8eaf0",
              color: selectedIds.size > 0 ? "#fff" : "#b0b3c6",
              boxShadow: selectedIds.size > 0 ? "0 4px 12px rgba(239,68,68,0.3)" : "none",
            }}
          >
            <Trash2 className="h-4 w-4" />
            Delete {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
          </button>
        </div>
      ) : (
        /* ── Composer ── */
        <div
          className="px-4 py-3 flex-shrink-0"
          style={{ background: "#ffffff", borderTop: "1px solid #f0f1f5" }}
        >
        {/* Reply preview */}
        {replyTo && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 mb-2"
            style={{ background: "#f0eeff", borderLeft: "3px solid #7c3aed" }}
          >
            <CornerUpLeft className="h-4 w-4 shrink-0" style={{ color: "#7c3aed" }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold" style={{ color: "#7c3aed" }}>
                {replyTo.sender_type === "AGENT" ? "You" : "Customer"}
              </p>
              <p className="text-xs truncate" style={{ color: "#6b7080" }}>{replyTo.content ?? "📎 Media"}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} style={{ color: "#b0b3c6" }}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {showVoice ? (
          <VoiceRecorder
            conversationId={conversationId}
            onSent={msg => { handleMediaSent(msg); setShowVoice(false); }}
            onCancel={() => setShowVoice(false)}
          />
        ) : (
          <div className="flex items-end gap-2">
            {/* Emoji */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(v => !v)}
                className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
                style={{ color: "#b0b3c6" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                <Smile className="h-5 w-5" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-50 shadow-2xl rounded-2xl overflow-hidden">
                  <EmojiPicker onEmojiClick={handleEmojiClick} theme={"light" as Theme} height={350} width={300} searchDisabled={false} skinTonesDisabled previewConfig={{ showPreview: false }} />
                </div>
              )}
            </div>

            {/* Attachment */}
            <MediaUploadButton conversationId={conversationId} onSent={handleMediaSent} onPreview={triggerFilePicker} />

            {/* Template */}
            <button
              type="button"
              onClick={() => setShowTemplateModal(true)}
              className="flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
              style={{ color: "#b0b3c6" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              title="Send template"
            >
              <FileText className="h-4 w-4" />
            </button>

            {/* Input */}
            <div
              className="flex-1 flex items-end rounded-2xl px-4 py-2.5 relative"
              style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0" }}
            >
              {cannedQuery !== null && (
                <CannedResponses query={cannedQuery} onSelect={handleCannedSelect} onClose={() => setCannedQuery(null)} />
              )}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={e => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message or / for quick replies"
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none max-h-32 leading-relaxed"
                style={{ color: "#1a1d23", minHeight: "22px" }}
              />
            </div>

            {/* Send / Mic */}
            {text.trim() ? (
              <button
                type="button"
                onClick={handleSend}
                disabled={isSending}
                className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all disabled:opacity-60"
                style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#ffffff", boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}
              >
                <Send className="h-4 w-4" />
              </button>
            ) : (
              <VoiceMicButton onClick={() => setShowVoice(true)} />
            )}
          </div>
        )}
      </div>
      )}
    </div>
  );
}
