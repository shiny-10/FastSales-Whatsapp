import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSignedMediaUrl(mediaFileId: string | null, fileUrl?: string) {
  return useQuery<{ signed_url: string; expires_in: number }>({
    queryKey: ["media-signed-url", mediaFileId],
    queryFn: async () => {
      const { data } = await api.get(`/inbox/messages/media/${mediaFileId}/signed-url`);
      return data;
    },
    enabled: !!mediaFileId && !fileUrl,
    staleTime: 50 * 60 * 1000, // Re-fetch before 1h expiry
    gcTime: 55 * 60 * 1000,
  });
}
