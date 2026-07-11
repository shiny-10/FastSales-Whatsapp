import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";

export interface AutoReply {
  id: string;
  company_id: string;
  name: string;
  message: string;
  is_active: boolean;
  delay_seconds: number;
  created_at: string;
  updated_at: string;
}

export function useAutoReplies() {
  return useQuery<AutoReply[]>({
    queryKey: ["auto-replies"],
    queryFn: async () => {
      const { data } = await api.get("/api/auto-replies");
      return data;
    },
    staleTime: 10_000,
  });
}

export function useCreateAutoReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; message: string; is_active?: boolean; delay_seconds?: number }) => {
      const { data } = await api.post("/api/auto-replies", payload);
      return data as AutoReply;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-replies"] }),
  });
}

export function useUpdateAutoReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<AutoReply> }) => {
      const { data } = await api.patch(`/api/auto-replies/${id}`, payload);
      return data as AutoReply;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-replies"] }),
  });
}

export function useDeleteAutoReply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/auto-replies/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["auto-replies"] }),
  });
}
