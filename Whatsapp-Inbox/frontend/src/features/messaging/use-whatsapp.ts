import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/shared/lib/api";
import type { WhatsAppStatusResponse } from "@/shared/types";

export function useWhatsAppAccount() {
  return useQuery<WhatsAppStatusResponse>({
    queryKey: ["whatsapp-account"],
    queryFn: async () => {
      const { data } = await api.get("/api/whatsapp/account");
      return data;
    },
  });
}

export function useConnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      waba_id: string;
      phone_number_id: string;
      access_token: string;
    }) => {
      const { data } = await api.post("/api/whatsapp/connect", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-account"] });
    },
  });
}

export function useDisconnectWhatsApp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.delete("/api/whatsapp/disconnect");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["whatsapp-account"] });
    },
  });
}
