import { create } from "zustand";
import type { Conversation, Message, MessageStatus, Reaction } from "@/lib/types";

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
      const existing = state.messages[message.conversation_id] ?? [];
      // Normalise id to string to avoid "9" vs 9 duplicate key issues
      const msgId = String(message.id);
      const convId = String(message.conversation_id);
      const hasDuplicate = existing.some((m) => String(m.id) === msgId);
      return {
        messages: {
          ...state.messages,
          [convId]: hasDuplicate
            ? existing.map((m) => (String(m.id) === msgId ? message : m))
            : [...existing, message],
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
}));
