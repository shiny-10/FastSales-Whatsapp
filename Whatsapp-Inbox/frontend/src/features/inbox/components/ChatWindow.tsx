"use client";

import {
  useEffect, useRef, useState, useCallback, KeyboardEvent, useMemo,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  Send, MoreVertical, ArrowLeft, Search, X,
  ChevronUp, ChevronDown, Pencil, Check, Smile, ArrowDown, CornerUpLeft, FileText, Mic,
} from "lucide-react";
import EmojiPicker, { EmojiClickData, Theme } from "emoji-picker-react";
import { useInboxStore } from "@/features/inbox/store/inbox-store";
import { useMessages, useSendTextMessage } from "@/features/inbox/api/use-messages";
import { useConversation, useUpdateConversation } from "@/features/inbox/api/use-conversations";
import { MessageBubble } from "./MessageBubble";
import { TypingIndicator } from "./TypingIndicator";
import { MessageSkeleton } from "./MessageSkeleton";
import { DateSeparator } from "./DateSeparator";
import { Button } from "@/shared/components/button";
import { ContactAvatar } from "./ContactAvatar";
import { StatusBadge } from "./StatusBadge";
import { AssignAgentModal } from "./AssignAgentModal";
import { useSocket } from "@/shared/hooks/socket-context";
import { cn, formatLastSeen, isSameDay, formatDateSeparator } from "@/shared/lib/utils";
import { MediaUploadButton } from "./MediaUploadButton";
import { VoiceRecorder, VoiceMicButton } from "./VoiceRecorder";
import { FilePreview } from "./FilePreview";
import { CannedResponses } from "./CannedResponses";
import { TemplateModal } from "./TemplateModal";
import type { Message } from "@/shared/types";

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
}

export function ChatWindow({ conversationId, onBack }: ChatWindowProps) {
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

  const { data: conversation } = useConversation(conversationId);
  const { data: messagesData, fetchNextPage, hasNextPage, isLoading: msgsLoading } = useMessages(conversationId);
  const { mutateAsync: sendText } = useSendTextMessage();

  const isTyping = typingMap[conversationId] ?? false;

  const allMessages: Message[] = useMemo(() => {
    const pages = messagesData?.pages ?? [];
    const flat = pages.flatMap((p) => p.items);
    const storeConvMsgs = storeMessages[conversationId] ?? [];
    const merged = [...flat, ...storeConvMsgs];
    const deduped = Array.from(new Map(merged.map((m) => [m.id, m])).values());
    return deduped.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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

  useEffect(() => { scrollToBottom("instant"); }, [conversationId]);
  useEffect(() => { if (!showScrollBtn) scrollToBottom(); }, [allMessages.length, isTyping]);
  useEffect(() => { if (currentMatch) document.getElementById(`msg-${currentMatch.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }); }, [currentMatch]);
  useEffect(() => { setSearchIndex(0); }, [searchQuery]);
  useEffect(() => { if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50); else setSearchQuery(""); }, [searchOpen]);
  useEffect(() => { if (conversation) setNameValue(conversation.customer_name ?? ""); }, [conversation?.customer_name]);
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
    } catch (e) {
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-[#f0f2f5] dark:bg-[#202c33] border-b border-border shadow-sm z-10">
        {onBack && (
          <Button size="icon" variant="ghost" onClick={onBack} className="shrink-0 md:hidden">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <ContactAvatar name={conversation.customer_name} phone={conversation.customer_phone} className="h-9 w-9 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 group">
            {editingName ? (
              <>
                <input
                  ref={nameInputRef}
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameSave}
                  className="font-semibold text-sm bg-transparent border-b-2 border-brand-400 focus:outline-none w-40"
                  placeholder="Enter name"
                />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleNameSave(); }} className="text-green-500"><Check className="h-3.5 w-3.5" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setNameValue(conversation.customer_name ?? ""); setEditingName(false); }} className="text-muted-foreground"><X className="h-3.5 w-3.5" /></button>
              </>
            ) : (
              <>
                <span className="font-semibold text-sm truncate cursor-pointer hover:underline" onClick={() => { setNameValue(conversation.customer_name ?? ""); setEditingName(true); }}>
                  {conversation.customer_name || conversation.customer_phone}
                </span>
                <button type="button" onClick={() => { setNameValue(conversation.customer_name ?? ""); setEditingName(true); }} className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground">
                  <Pencil className="h-3 w-3" />
                </button>
                <StatusBadge status={conversation.status} className="hidden sm:flex" />
              </>
            )}
          </div>
          {/* Last seen — feature 11 */}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {conversation.last_message_at ? `last seen ${formatLastSeen(conversation.last_message_at)}` : conversation.customer_phone}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <AssignAgentModal conversationId={conversationId} currentAgentId={conversation.assigned_agent_id}>
            <Button size="sm" variant="ghost" className="text-xs text-gray-600 dark:text-gray-300">
              {conversation.assigned_agent_id ? "Reassign" : "Assign"}
            </Button>
          </AssignAgentModal>
          <Button size="icon" variant="ghost" onClick={() => setSearchOpen((v) => !v)}>
            <Search className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search bar */}
      {searchOpen && (
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-background">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input ref={searchInputRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search messages…" className="flex-1 bg-transparent text-sm focus:outline-none placeholder:text-muted-foreground" />
          {searchQuery && <span className="text-xs text-muted-foreground shrink-0">{searchMatches.length === 0 ? "No results" : `${searchIndex + 1} / ${searchMatches.length}`}</span>}
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={searchMatches.length === 0} onClick={() => setSearchIndex((i) => (i - 1 + searchMatches.length) % searchMatches.length)}><ChevronUp className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" disabled={searchMatches.length === 0} onClick={() => setSearchIndex((i) => (i + 1) % searchMatches.length)}><ChevronDown className="h-3.5 w-3.5" /></Button>
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setSearchOpen(false)}><X className="h-3.5 w-3.5" /></Button>
        </div>
      )}

      {/* Load more */}
      {hasNextPage && (
        <div className="text-center py-1.5 bg-transparent">
          <Button size="sm" variant="ghost" onClick={() => fetchNextPage()} className="text-xs text-muted-foreground">Load older messages</Button>
        </div>
      )}

      {/* Messages area — feature 1 (background) */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-4 wa-chat-bg"
      >
        {msgsLoading ? (
          <MessageSkeleton />
        ) : allMessages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-gray-500 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          allMessages.map((msg, idx) => {
            const prev = allMessages[idx - 1];
            const showSeparator = !prev || !isSameDay(prev.created_at, msg.created_at);
            return (
              <div key={msg.id} id={`msg-${msg.id}`}>
                {/* Feature 2 — date separator */}
                {showSeparator && <DateSeparator label={formatDateSeparator(msg.created_at)} />}
                <MessageBubble
                  message={msg}
                  allMessages={allMessages}
                  highlight={!!searchQuery && !!msg.content?.toLowerCase().includes(searchQuery.toLowerCase())}
                  isCurrentMatch={currentMatch?.id === msg.id}
                  onReply={setReplyTo}
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

      {/* Scroll to bottom button — feature 10 */}
      <AnimatePresence>
        {showScrollBtn && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-6 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-gray-700 shadow-lg border border-border hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowDown className="h-4 w-4 text-gray-600 dark:text-gray-300" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* File preview modal */}
      {filePreview && (
        <FilePreview
          file={filePreview.file}
          mediaType={filePreview.type}
          conversationId={conversationId}
          onSent={(msg) => { handleMediaSent(msg); setFilePreview(null); }}
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

      {/* Hidden file input for preview-before-send */}
      <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />

      {/* Composer */}
      <div className="bg-[#f0f2f5] dark:bg-[#202c33] px-3 py-2 space-y-1.5">
        {/* Reply preview */}
        {replyTo && (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-700 rounded-xl px-3 py-2 border-l-4 border-brand-500">
            <CornerUpLeft className="h-4 w-4 text-brand-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                {replyTo.sender_type === "AGENT" ? "You" : "Customer"}
              </p>
              <p className="text-xs text-gray-500 truncate">{replyTo.content ?? "📎 Media"}</p>
            </div>
            <button type="button" onClick={() => setReplyTo(null)} className="text-gray-400 hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {showVoice ? (
          <VoiceRecorder
            conversationId={conversationId}
            onSent={(msg) => { handleMediaSent(msg); setShowVoice(false); }}
            onCancel={() => setShowVoice(false)}
          />
        ) : (
          <div className="flex items-end gap-2">
            {/* Emoji picker */}
            <div className="relative">
              <Button size="icon" variant="ghost" type="button" onClick={() => setShowEmojiPicker((v) => !v)} className="h-9 w-9 text-gray-500 hover:text-gray-700 dark:text-gray-400">
                <Smile className="h-5 w-5" />
              </Button>
              {showEmojiPicker && (
                <div className="absolute bottom-12 left-0 z-50">
                  <EmojiPicker onEmojiClick={handleEmojiClick} theme={"auto" as Theme} height={350} width={300} searchDisabled={false} skinTonesDisabled previewConfig={{ showPreview: false }} />
                </div>
              )}
            </div>

            {/* Attachment — now opens file preview */}
            <MediaUploadButton conversationId={conversationId} onSent={handleMediaSent} onPreview={triggerFilePicker} />

            {/* Template button */}
            <Button size="icon" variant="ghost" type="button" onClick={() => setShowTemplateModal(true)} className="h-9 w-9 text-gray-500 hover:text-gray-700 dark:text-gray-400" title="Send template">
              <FileText className="h-4 w-4" />
            </Button>

            {/* Text input + canned responses */}
            <div className="flex-1 flex items-end bg-white dark:bg-[#2a3942] rounded-2xl px-3 py-2 shadow-sm relative">
              {cannedQuery !== null && (
                <CannedResponses
                  query={cannedQuery}
                  onSelect={handleCannedSelect}
                  onClose={() => setCannedQuery(null)}
                />
              )}
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => handleTextChange(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message or / for quick replies"
                rows={1}
                className="flex-1 bg-transparent text-sm resize-none focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500 py-0.5 max-h-32 leading-relaxed"
                style={{ minHeight: "24px" }}
              />
            </div>

            {/* Send or mic */}
            {text.trim() ? (
              <Button type="button" size="icon" onClick={handleSend} disabled={isSending} className="h-9 w-9 shrink-0 rounded-full bg-[#00a884] hover:bg-[#00956f] text-white border-0">
                <Send className="h-4 w-4" />
              </Button>
            ) : (
              <VoiceMicButton onClick={() => setShowVoice(true)} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
