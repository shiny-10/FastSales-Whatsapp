import {
  useQuery,
  useMutation,
  useInfiniteQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Message, MessageListResponse, MessageReactionsResponse, Reaction } from "@/lib/types";

export function useMessages(conversationId: string | null) {
  return useInfiniteQuery<MessageListResponse>({
    queryKey: ["messages", conversationId],
    queryFn: async ({ pageParam }) => {
      const params: Record<string, string> = {};
      if (pageParam) params.before = pageParam as string;
      const { data } = await api.get(
        `/inbox/conversations/${conversationId}/messages`,
        { params }
      );
      return data;
    },
    getNextPageParam: (lastPage) =>
      lastPage.has_more ? lastPage.cursor : undefined,
    initialPageParam: undefined,
    enabled: !!conversationId,
  });
}

export function useSendTextMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversation_id,
      content,
      reply_to_message_id,
    }: {
      conversation_id: string;
      content: string;
      reply_to_message_id?: string;
    }) => {
      const { data } = await api.post("/inbox/messages", {
        conversation_id,
        message_type: "TEXT",
        content,
        reply_to_message_id: reply_to_message_id ?? null,
      });
      return data as Message;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["messages", variables.conversation_id] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useSendMediaMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      conversation_id: string;
      message_type: string;
      media_url?: string;
      media_id?: string;
      caption?: string;
      file_name?: string;
    }) => {
      const { data } = await api.post("/inbox/messages", payload);
      return data as Message;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["messages", variables.conversation_id] });
    },
  });
}

export function useSendTemplateMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      conversation_id: string;
      template_name: string;
      language_code?: string;
      components?: any[];
    }) => {
      const { data } = await api.post("/inbox/messages", {
        conversation_id: payload.conversation_id,
        message_type: "TEMPLATE",
        template_name: payload.template_name,
        language_code: payload.language_code,
        components: payload.components,
      });
      return data as Message;
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ["messages", variables.conversation_id] });
    },
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (messageId: string) => {
      await api.delete(`/inbox/messages/${messageId}`);
      return messageId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useDeleteMessages() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      await api.delete("/inbox/messages", { data: { ids } });
      return ids;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useSendReaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      messageId,
      emoji,
      customer_phone,
    }: {
      messageId: string;
      emoji: string;
      customer_phone?: string;
    }) => {
      const { data } = await api.post(`/api/messages/${messageId}/reactions`, {
        emoji,
        customer_phone,
      });
      return data as Reaction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
    },
    onError: (error) => {
      console.error("Failed to send reaction", error);
    },
  });
}

export function useMessageReactions(messageId: string | null) {
  return useQuery<MessageReactionsResponse>({
    queryKey: ["reactions", messageId],
    queryFn: async () => {
      const { data } = await api.get(`/api/messages/${messageId}/reactions`);
      return data;
    },
    enabled: !!messageId,
  });
}
