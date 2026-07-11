"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { SocketProvider } from "@/shared/hooks/socket-context";
import { Toaster } from "@/shared/components/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 30 * 1000, retry: 1 } },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <SocketProvider>
        {children}
        <Toaster />
      </SocketProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
