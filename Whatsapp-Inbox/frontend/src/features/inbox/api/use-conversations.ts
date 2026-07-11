import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import { toast } from "@/shared/components/toast";
import type {
  ConversationListResponse,
  Conversation,
  ConversationStatus,
} from "@/shared/types";

export function useConversations(params?: {
  status?: ConversationStatus;
  search?: string;
  archived?: boolean | null;
  page?: number;
  page_size?: number;
}) {
  return useQuery<ConversationListResponse>({
    queryKey: ["conversations", params],
    queryFn: async () => {
      const { data } = await api.get("/api/conversations", { params });
      return data;
    },
    refetchInterval: 30_000,
  });
}

export function useConversation(id: string | null) {
  return useQuery<Conversation>({
    queryKey: ["conversation", id],
    queryFn: async () => {
      const { data } = await api.get(`/api/conversations/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

export function useAssignAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      conversationId,
      agentId,
    }: {
      conversationId: string;
      agentId: string;
    }) => {
      const { data } = await api.post(
        `/api/conversations/${conversationId}/assign`,
        { agent_id: agentId }
      );
      return data as Conversation;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.setQueryData(["conversation", data.id], data);
      toast.success("Agent assigned successfully");
    },
    onError: () => toast.error("Failed to assign agent"),
  });
}

export function useUpdateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<Conversation> & { id: string }) => {
      const { data } = await api.patch(`/api/conversations/${id}`, updates);
      return data as Conversation;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.setQueryData(["conversation", data.id], data);
      toast.success("Conversation updated");
    },
    onError: () => toast.error("Failed to update conversation"),
  });
}

export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      archive,
    }: {
      id: string;
      archive: boolean;
    }) => {
      const { data } = await api.patch(`/api/conversations/${id}`, {
        is_archived: archive,
      });
      return data as Conversation;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.setQueryData(["conversation", data.id], data);
      toast.success(data.is_archived ? "Conversation archived" : "Conversation unarchived");
    },
    onError: () => toast.error("Failed to update archive status"),
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/conversations/${id}`);
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.removeQueries({ queryKey: ["conversation", id] });
      toast.success("Conversation deleted");
    },
    onError: () => toast.error("Failed to delete conversation"),
  });
}

export function useCreateConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      customer_phone: string;
      customer_name?: string;
    }) => {
      const { data } = await api.post("/api/conversations", payload);
      return data as Conversation;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      toast.success("Conversation created");
    },
    onError: () => toast.error("Failed to create conversation"),
  });
}

export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { data } = await api.post(`/api/conversations/${conversationId}/read`);
      return data as Conversation;
    },
    onSuccess: (conversation) => {
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.setQueryData(["conversation", conversation.id], conversation);
    },
    onError: () => toast.error("Failed to mark conversation as read"),
  });
}
