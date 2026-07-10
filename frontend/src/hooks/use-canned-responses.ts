import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface CannedResponse {
  id: string;
  shortcut: string;
  content: string;
}

export function useCannedResponses(query?: string) {
  return useQuery<CannedResponse[]>({
    queryKey: ["canned-responses", query ?? ""],
    queryFn: async () => {
      const { data } = await api.get("/api/canned-responses", {
        params: query ? { q: query } : {},
      });
      return data;
    },
    enabled: query !== undefined,
    staleTime: 10_000,
  });
}

export function useCreateCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { shortcut: string; content: string }) => {
      const { data } = await api.post("/api/canned-responses", payload);
      return data as CannedResponse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canned-responses"] }),
  });
}

export function useUpdateCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Partial<CannedResponse> }) => {
      const { data } = await api.patch(`/api/canned-responses/${id}`, payload);
      return data as CannedResponse;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canned-responses"] }),
  });
}

export function useDeleteCannedResponse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/canned-responses/${id}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canned-responses"] }),
  });
}
