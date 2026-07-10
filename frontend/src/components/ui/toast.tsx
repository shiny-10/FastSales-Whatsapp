"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { create } from "zustand";

// ── Toast store ──────────────────────────────────────────────────────────────

type ToastVariant = "success" | "error" | "info";

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

interface ToastStore {
  toasts: Toast[];
  add: (t: Omit<Toast, "id">) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>()((set) => ({
  toasts: [],
  add: (t) =>
    set((s) => ({
      toasts: [...s.toasts, { ...t, id: Math.random().toString(36).slice(2) }],
    })),
  remove: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().add({ title, description, variant: "success" }),
  error: (title: string, description?: string) =>
    useToastStore.getState().add({ title, description, variant: "error" }),
  info: (title: string, description?: string) =>
    useToastStore.getState().add({ title, description, variant: "info" }),
};

// ── Toaster component ────────────────────────────────────────────────────────

const VARIANT_STYLES: Record<ToastVariant, string> = {
  success: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20",
  error: "border-destructive/40 bg-destructive/10",
  info: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20",
};

const VARIANT_ICONS: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />,
  error: <AlertCircle className="h-4 w-4 text-destructive" />,
  info: <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />,
};

export function Toaster() {
  const { toasts, remove } = useToastStore();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((t) => (
        <ToastPrimitive.Root
          key={t.id}
          open
          onOpenChange={(open) => !open && remove(t.id)}
          duration={4000}
          className={cn(
            "flex items-start gap-3 rounded-2xl border p-4 shadow-lg max-w-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-bottom-2",
            VARIANT_STYLES[t.variant ?? "info"]
          )}
        >
          <span className="mt-0.5 shrink-0">
            {VARIANT_ICONS[t.variant ?? "info"]}
          </span>
          <div className="flex-1 min-w-0">
            <ToastPrimitive.Title className="text-sm font-semibold">
              {t.title}
            </ToastPrimitive.Title>
            {t.description && (
              <ToastPrimitive.Description className="text-xs text-muted-foreground mt-0.5">
                {t.description}
              </ToastPrimitive.Description>
            )}
          </div>
          <ToastPrimitive.Close
            onClick={() => remove(t.id)}
            className="shrink-0 rounded-lg p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
