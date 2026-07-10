import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

export function useSignedMediaUrl(mediaFileId: string | null) {
  return useQuery<{ signed_url: string; expires_in: number }>({
    queryKey: ["media-signed-url", mediaFileId],
    queryFn: async () => {
      const { data } = await api.get(`/api/media/${mediaFileId}/signed-url`);
      return data;
    },
    enabled: !!mediaFileId,
    staleTime: 50 * 60 * 1000, // Re-fetch before 1h expiry
    gcTime: 55 * 60 * 1000,
  });
}
