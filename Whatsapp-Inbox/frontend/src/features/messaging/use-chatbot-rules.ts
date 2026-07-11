import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";

export interface ChatbotRule {
  id: string;
  company_id: string;
  keyword: string;
  response: string;
  is_active: boolean;
  match_exact: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export function useChatbotRules() {
  return useQuery<ChatbotRule[]>({
    queryKey: ["chatbot-rules"],
    queryFn: async () => {
      const { data } = await api.get("/api/chatbot-rules");
      return data;
    },
    staleTime: 10_000,
  });
}

export function useCreateChatbotRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { keyword: string; response: string; is_active?: boolean; match_exact?: boolean; priority?: number }) => {
      const { data } = await api.post("/api/chatbot-rules", payload);
      return data as ChatbotRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chatbot-rules"] }),
  });
}

export function useUpdateChatbotRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<ChatbotRule> }) => {
      const { data } = await api.patch(`/api/chatbot-rules/${id}`, payload);
      return data as ChatbotRule;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chatbot-rules"] }),
  });
}

export function useDeleteChatbotRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/chatbot-rules/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["chatbot-rules"] }),
  });
}
