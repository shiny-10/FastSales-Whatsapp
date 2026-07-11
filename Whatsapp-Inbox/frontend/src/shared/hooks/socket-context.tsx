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
import { io, Socket } from "socket.io-client";
import { useAuthStore } from "@/store/auth-store";
import { useInboxStore } from "@/features/inbox/store/inbox-store";
import type { Message, Reaction } from "@/shared/types";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:8000";

interface SocketContextValue {
  socket: Socket | null;
  connected: boolean;
  emitTyping: (conversationId: string) => void;
  joinConversation: (conversationId: string) => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  connected: false,
  emitTyping: () => {},
  joinConversation: () => {},
});

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const { addMessage, updateConversation, upsertConversation, updateMessageStatus, addReaction, setTyping } = useInboxStore();

  useEffect(() => {
    if (!user) return;

    const socket = io(SOCKET_URL, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("✅ Socket connected");
      setConnected(true);
      // Join company room
      socket.emit("join_company", { company_id: user.company_id });
      console.log("📍 Joined company room:", user.company_id);
    });

    socket.on("disconnect", () => {
      console.log("❌ Socket disconnected");
      setConnected(false);
    });

    socket.on("NEW_MESSAGE", (message: Message) => {
      console.log("🆕 NEW_MESSAGE received from socket:", message);
      addMessage(message);
      // Force refetch conversations immediately
      queryClient.refetchQueries({ queryKey: ["conversations"] });
      queryClient.refetchQueries({ queryKey: ["messages", message.conversation_id] });
      console.log("🔄 Refetching conversations and messages");
    });

    socket.on(
      "MESSAGE_STATUS",
      (data: {
        message_id?: string;
        meta_message_id?: string;
        status: string;
        conversation_id: string;
      }) => {
        updateMessageStatus(data.meta_message_id ?? data.message_id ?? "", data.status as any);
        queryClient.setQueryData(["messages", data.conversation_id], (oldData: any) => {
          if (!oldData || !oldData.pages) return oldData;
          return {
            ...oldData,
            pages: oldData.pages.map((page: any) => ({
              ...page,
              items: page.items.map((message: Message) =>
                message.meta_message_id === data.meta_message_id || message.id === data.message_id
                  ? { ...message, status: data.status as any }
                  : message
              ),
            })),
          };
        });
      }
    );

    socket.on("NEW_REACTION", (reaction: Reaction) => {
      addReaction(reaction);
      queryClient.invalidateQueries({ queryKey: ["messages"] });
    });

    socket.on("AGENT_ASSIGNED", (data: { conversation_id: string; agent_id: string }) => {
      // Could refresh conversations or update store
    });

    socket.on("TYPING", (data: { conversation_id: string; from?: string }) => {
      setTyping(data.conversation_id, true);
      // Auto-clear typing indicator after 3 seconds
      setTimeout(() => setTyping(data.conversation_id, false), 3000);
    });

    return () => {
      socket.disconnect();
    };
  }, [user]);

  const emitTyping = useCallback((conversationId: string) => {
    socketRef.current?.emit("typing", { conversation_id: conversationId });
  }, []);

  const joinConversation = useCallback((conversationId: string) => {
    socketRef.current?.emit("join_conversation", { conversation_id: conversationId });
  }, []);

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, emitTyping, joinConversation }}>
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => useContext(SocketContext);
