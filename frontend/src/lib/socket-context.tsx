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
  const { addMessage, updateMessageStatus, addReaction, setTyping } = useInboxStore();

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
        queryClient.refetchQueries({ queryKey: ["conversations"] });
        queryClient.refetchQueries({ queryKey: ["messages", String(message.conversation_id)] });
        return;
      }

      if (type === "message_status") {
        const convId = String(data.conversation_id ?? "");
        const ref: string = data.meta_message_id ?? data.message_id ?? "";
        updateMessageStatus(ref, data.status as any);
        queryClient.setQueryData(["messages", convId], (old: any) => {
          if (!old?.pages) return old;
          return {
            ...old,
            pages: old.pages.map((page: any) => ({
              ...page,
              items: page.items.map((m: Message) =>
                m.meta_message_id === data.meta_message_id ||
                String(m.id) === String(data.message_id)
                  ? { ...m, status: data.status }
                  : m
              ),
            })),
          };
        });
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
