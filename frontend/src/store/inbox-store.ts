import { create } from "zustand";
import type { Conversation, Message, MessageStatus, Reaction } from "@/lib/types";

export interface InboxNotification {
  id: string;
  conversationId: string;
  customerName: string;
  customerPhone: string;
  preview: string;
  receivedAt: string;
  read: boolean;
}

interface InboxState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  setConversations: (conversations: Conversation[]) => void;
  setActiveConversation: (id: string | null) => void;
  updateConversation: (id: string, updates: Partial<Conversation>) => void;
  upsertConversation: (conversation: Conversation) => void;

  // Messages by conversationId
  messages: Record<string, Message[]>;
  setMessages: (conversationId: string, messages: Message[]) => void;
  addMessage: (message: Message) => void;
  prependMessages: (conversationId: string, messages: Message[]) => void;
  updateMessageStatus: (messageRef: string, status: MessageStatus) => void;

  // Reactions
  addReaction: (reaction: Reaction) => void;

  // Typing indicators
  typingMap: Record<string, boolean>;
  setTyping: (conversationId: string, isTyping: boolean) => void;

  // UI
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  statusFilter: string | null;
  setStatusFilter: (s: string | null) => void;
  archivedFilter: boolean | null;
  setArchivedFilter: (archived: boolean | null) => void;
  unreadFilter: boolean | null;
  setUnreadFilter: (unread: boolean | null) => void;
  assignedFilter: boolean | null;
  setAssignedFilter: (assigned: boolean | null) => void;

  // "Delete for me" — local-only hidden message IDs (not synced to server)
  hiddenMessageIds: Set<string>;
  hideMessageLocally: (messageId: string) => void;

  // Notifications — inbox messages from customers
  notifications: InboxNotification[];
  addNotification: (n: InboxNotification) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
}

export const useInboxStore = create<InboxState>()((set, get) => ({
  conversations: [],
  activeConversationId: null,
  setConversations: (conversations) => set({ conversations }),
  setActiveConversation: (id) => set({ activeConversationId: id }),
  updateConversation: (id, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  upsertConversation: (conversation) =>
    set((state) => {
      const exists = state.conversations.find((c) => c.id === conversation.id);
      if (exists) {
        return {
          conversations: state.conversations.map((c) =>
            c.id === conversation.id ? { ...c, ...conversation } : c
          ),
        };
      }
      return { conversations: [conversation, ...state.conversations] };
    }),

  messages: {},
  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),
  addMessage: (message) =>
    set((state) => {
      const convId = String(message.conversation_id);
      const existing = state.messages[convId] ?? [];
      // Normalise id to string to avoid "9" vs 9 duplicate key issues
      const msgId = String(message.id);
      const messageMetaId = message.meta_message_id ? String(message.meta_message_id) : null;
      const existingIndex = existing.findIndex(
        (m) =>
          String(m.id) === msgId ||
          (messageMetaId && m.meta_message_id && String(m.meta_message_id) === messageMetaId)
      );

      if (existingIndex >= 0) {
        const updated = [...existing];
        updated[existingIndex] = { ...updated[existingIndex], ...message };
        return {
          messages: {
            ...state.messages,
            [convId]: updated,
          },
        };
      }

      return {
        messages: {
          ...state.messages,
          [convId]: [...existing, message],
        },
      };
    }),
  prependMessages: (conversationId, messages) =>
    set((state) => {
      const existing = state.messages[conversationId] ?? [];
      return {
        messages: {
          ...state.messages,
          [conversationId]: [...messages, ...existing],
        },
      };
    }),
  updateMessageStatus: (messageRef, status) =>
    set((state) => {
      const ref = String(messageRef);
      const updatedMessages = { ...state.messages };
      for (const convId in updatedMessages) {
        updatedMessages[convId] = updatedMessages[convId].map((m) =>
          m.meta_message_id === ref ||
          String(m.id) === ref ||
          m.meta_message_id === messageRef
            ? { ...m, status }
            : m
        );
      }
      return { messages: updatedMessages };
    }),

  addReaction: (reaction) =>
    set((state) => {
      const reactionMsgId = String(reaction.message_id);
      const updatedMessages = { ...state.messages };
      for (const convId in updatedMessages) {
        updatedMessages[convId] = updatedMessages[convId].map((m) => {
          if (String(m.id) === reactionMsgId) {
            const existingIdx = (m.reactions ?? []).findIndex(
              (r) => r.customer_phone === reaction.customer_phone
            );
            const reactions =
              existingIdx >= 0
                ? (m.reactions ?? []).map((r, i) => (i === existingIdx ? reaction : r))
                : [...(m.reactions ?? []), reaction];
            return { ...m, reactions };
          }
          return m;
        });
      }
      return { messages: updatedMessages };
    }),

  typingMap: {},
  setTyping: (conversationId, isTyping) =>
    set((state) => ({
      typingMap: { ...state.typingMap, [conversationId]: isTyping },
    })),

  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  statusFilter: null,
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  archivedFilter: null,
  setArchivedFilter: (archivedFilter) => set({ archivedFilter }),
  unreadFilter: null,
  setUnreadFilter: (unreadFilter) => set({ unreadFilter }),
  assignedFilter: null,
  setAssignedFilter: (assignedFilter) => set({ assignedFilter }),

  // "Delete for me" — local-only, persisted to localStorage
  hiddenMessageIds: (() => {
    if (typeof window === "undefined") return new Set<string>();
    try {
      const raw = localStorage.getItem("hidden_message_ids");
      return new Set<string>(raw ? JSON.parse(raw) : []);
    } catch { return new Set<string>(); }
  })(),
  hideMessageLocally: (messageId: string) =>
    set((state) => {
      const next = new Set(state.hiddenMessageIds);
      next.add(String(messageId));
      try { localStorage.setItem("hidden_message_ids", JSON.stringify([...next])); } catch {}
      return { hiddenMessageIds: next };
    }),

  // Notifications
  notifications: [],
  addNotification: (n) =>
    set((state) => ({
      // Keep max 50, newest first, deduplicate by id
      notifications: [n, ...state.notifications.filter((x) => x.id !== n.id)].slice(0, 50),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),
  clearNotifications: () => set({ notifications: [] }),
}));
