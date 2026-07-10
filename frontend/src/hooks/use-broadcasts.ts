import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export interface Broadcast {
  id: string;
  company_id: string;
  name: string;
  message: string;
  recipients: string[];
  status: string;
  scheduled_at?: string | null;
  sent_count: number;
  failed_count: number;
  created_at: string;
  updated_at: string;
}

export interface BroadcastCreate {
  name: string;
  message: string;
  recipients: string[];
  scheduled_at?: string;
}

export interface BroadcastUpdate {
  name?: string;
  message?: string;
  recipients?: string[];
  scheduled_at?: string | null;
}

export function useBroadcasts() {
  return useQuery<Broadcast[]>({
    queryKey: ["broadcasts"],
    queryFn: async () => {
      const { data } = await api.get("/api/broadcasts");
      return data;
    },
    staleTime: 10_000,
  });
}

export function useCreateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BroadcastCreate) => {
      const { data } = await api.post("/api/broadcasts", payload);
      return data as Broadcast;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    },
  });
}

export function useUpdateBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: BroadcastUpdate }) => {
      const { data } = await api.patch(`/api/broadcasts/${id}`, payload);
      return data as Broadcast;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    },
  });
}

export function useDeleteBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/broadcasts/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    },
  });
}

export function useSendBroadcast() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/api/broadcasts/${id}/send`);
      return data as Broadcast;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["broadcasts"] });
    },
  });
}
