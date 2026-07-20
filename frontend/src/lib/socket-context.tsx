"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useInboxStore } from "@/store/inbox-store";
import type { Message, Reaction } from "./types";

// Build the WebSocket base URL from the API URL env var.
// http://localhost:8000  →  ws://localhost:8000
// https://example.com   →  wss://example.com
function buildWsBase(): string {
  const raw = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000";
  return raw
    .replace(/^https:\/\//, "wss://")
    .replace(/^http:\/\//, "ws://")
    .replace(/\/$/, "");
}

const WS_BASE = buildWsBase();
const ORG_ID = "1"; // hardcoded until auth is wired

const MIN_RETRY_MS = 2_000;
const MAX_RETRY_MS = 30_000;

interface SocketContextValue {
  connected: boolean;
  emitTyping: (conversationId: string) => void;
  joinConversation: (conversationId: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  connected: false,
  emitTyping: () => {},
  joinConversation: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const wsRef = useRef<WebSocket | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryDelay = useRef(MIN_RETRY_MS);
  const unmounted = useRef(false);

  const [connected, setConnected] = useState(false);
  const queryClient = useQueryClient();
  const { addMessage, updateMessageStatus, addReaction, setTyping, addNotification } = useInboxStore();

  const connect = useCallback(() => {
    if (unmounted.current) return;

    // Don't open a second socket if one is already open/connecting
    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const url = `${WS_BASE}/ws/${ORG_ID}`;
    console.log(`[WS] Connecting → ${url}`);

    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn("[WS] Could not create WebSocket:", err);
      scheduleRetry();
      return;
    }

    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[WS] ✅ Connected");
      setConnected(true);
      retryDelay.current = MIN_RETRY_MS; // reset backoff
    };

    ws.onclose = (ev) => {
      console.log(`[WS] ❌ Closed (code=${ev.code})`);
      setConnected(false);
      wsRef.current = null;
      scheduleRetry();
    };

    ws.onerror = () => {
      // onerror fires before onclose — just log, onclose handles retry
      console.warn(`[WS] Error on ${url} — will retry in ${retryDelay.current / 1000}s`);
    };

    ws.onmessage = (event) => {
      let data: Record<string, any>;
      try {
        data = JSON.parse(event.data as string);
      } catch {
        return;
      }

      const type = ((data.type as string) || "").toLowerCase();

      if (type === "new_message") {
        const raw = data.message as Message;
        if (!raw) return;
        const message: Message = {
          ...raw,
          reactions: raw.reactions ?? [],
          media_files: raw.media_files ?? [],
        };
        addMessage(message);

        // Optimistically bump unread_count for conversations the user isn't
        // currently viewing so the badge updates instantly (like real WhatsApp).
        const { activeConversationId, updateConversation, conversations } = useInboxStore.getState();
        const convId = String(message.conversation_id);
        if (message.sender_type === "CUSTOMER" && convId !== activeConversationId) {
          updateConversation(convId, {
            unread_count: (useInboxStore.getState().conversations.find(c => c.id === convId)?.unread_count ?? 0) + 1,
            last_message_preview: message.content ?? undefined,
            last_message_sender: message.sender_type,
            last_message_at: message.created_at,
          });

          // Push a notification for the bell icon
          const conv = conversations.find(c => c.id === convId);
          addNotification({
            id: String(message.id),
            conversationId: convId,
            customerName: conv?.customer_name ?? conv?.customer_phone ?? "Unknown",
            customerPhone: conv?.customer_phone ?? "",
            preview: message.content
              ? message.content.slice(0, 80)
              : `[${message.message_type?.toLowerCase() ?? "message"}]`,
            receivedAt: message.created_at,
            read: false,
          });
        }
        queryClient.refetchQueries({ queryKey: ["conversations"] });
        queryClient.refetchQueries({ queryKey: ["messages", String(message.conversation_id)] });
        return;
      }

      if (type === "message_status") {
        const convId = String(data.conversation_id ?? "");
        const metaId: string = data.meta_message_id ?? "";
        const dbId: string = String(data.message_id ?? "");

        // Update store messages (real-time ones added via addMessage)
        updateMessageStatus(metaId || dbId, data.status as any);

        // Update React Query infinite-query cache for this conversation
        if (convId) {
          queryClient.setQueryData(["messages", convId], (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                items: page.items.map((m: Message) => {
                  const matchesMeta = metaId && m.meta_message_id === metaId;
                  const matchesDb   = dbId   && String(m.id) === dbId;
                  return matchesMeta || matchesDb ? { ...m, status: data.status } : m;
                }),
              })),
            };
          });
        }
        return;
      }

      if (type === "new_reaction") {
        const reaction = data.reaction as Reaction;
        if (reaction) {
          addReaction(reaction);
          queryClient.invalidateQueries({ queryKey: ["messages"] });
        }
        return;
      }

      if (type === "message_deleted") {
        // Soft-delete: flip is_deleted=true in store + query cache
        const convId = String(data.conversation_id ?? "");
        const msgId  = String(data.message_id ?? "");
        if (!msgId) return;

        // Update store messages (those added via addMessage)
        const { messages: storeMessages } = useInboxStore.getState();
        const updatedMessages: Record<string, any[]> = {};
        let changed = false;
        for (const cid in storeMessages) {
          updatedMessages[cid] = storeMessages[cid].map((m) => {
            if (String(m.id) === msgId) { changed = true; return { ...m, is_deleted: true, content: undefined }; }
            return m;
          });
        }
        if (changed) useInboxStore.setState({ messages: updatedMessages });

        // Update React Query infinite-query cache
        if (convId) {
          queryClient.setQueryData(["messages", convId], (old: any) => {
            if (!old?.pages) return old;
            return {
              ...old,
              pages: old.pages.map((page: any) => ({
                ...page,
                items: page.items.map((m: Message) =>
                  String(m.id) === msgId ? { ...m, is_deleted: true, content: undefined } : m
                ),
              })),
            };
          });
        }
        return;
      }

      if (type === "conversation_update") {
        // Real-time conversation status change (e.g. PENDING ↔ OPEN)
        const convId = String(data.conversation_id ?? "");
        if (convId) {
          const updates: Record<string, any> = {};
          if (data.status !== undefined) updates.status = data.status;
          if (Object.keys(updates).length > 0) {
            useInboxStore.getState().updateConversation(convId, updates);
          }
          // Also refetch so the Waiting/All tabs get accurate counts
          queryClient.refetchQueries({ queryKey: ["conversations"] });
        }
        return;
      }

      if (type === "typing") {
        const convId = String(data.conversation_id ?? "");
        setTyping(convId, true);
        setTimeout(() => setTyping(convId, false), 3000);
        return;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function scheduleRetry() {
    if (unmounted.current) return;
    if (retryTimer.current) clearTimeout(retryTimer.current);
    retryTimer.current = setTimeout(() => {
      // Exponential backoff, capped at MAX_RETRY_MS
      retryDelay.current = Math.min(retryDelay.current * 1.5, MAX_RETRY_MS);
      connect();
    }, retryDelay.current);
  }

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close(1000, "component unmount");
      wsRef.current = null;
    };
  }, [connect]);

  const emitTyping = useCallback((conversationId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "typing", conversation_id: conversationId }));
    }
  }, []);

  const joinConversation = useCallback((_id: string) => {}, []);

  return (
    <SocketContext.Provider value={{ connected, emitTyping, joinConversation }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
