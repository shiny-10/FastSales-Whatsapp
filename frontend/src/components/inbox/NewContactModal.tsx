"use client";
import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { useCreateConversation } from "@/hooks/use-conversations";
import { toast } from "@/components/ui/toast";

const inputCls = {
  background: "#f5f6fa",
  border: "1.5px solid #e8eaf0",
  borderRadius: "10px",
  padding: "10px 14px",
  width: "100%",
  fontSize: "14px",
  color: "#1a1d23",
  outline: "none",
} as const;

interface NewContactModalProps {
  onCreated: (conversationId: string) => void;
}

export function NewContactModal({ onCreated }: NewContactModalProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const { mutateAsync, isPending } = useCreateConversation();

  const handleSubmit = async () => {
    const trimmed = phone.trim();
    if (!trimmed) { toast.error("Phone number is required"); return; }
    try {
      const conv = await mutateAsync({ customer_phone: trimmed, customer_name: name.trim() || undefined });
      setOpen(false); setPhone(""); setName("");
      onCreated(conv.id);
    } catch { /* toast handled by hook */ }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          style={{ background: "#7c3aed", color: "#ffffff" }}
          onMouseEnter={e => (e.currentTarget.style.background = "#6d28d9")}
          onMouseLeave={e => (e.currentTarget.style.background = "#7c3aed")}
        >
          <Plus className="w-3.5 h-3.5" />
          New contact
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }} />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl p-6 shadow-2xl"
          style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <Dialog.Title className="text-lg font-semibold" style={{ color: "#1a1d23" }}>New Conversation</Dialog.Title>
              <p className="text-sm mt-0.5" style={{ color: "#9498b0" }}>Start a new chat with a customer.</p>
            </div>
            <Dialog.Close asChild>
              <button type="button" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
                style={{ background: "#f5f6fa", color: "#9498b0" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#e8eaf0")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f5f6fa")}>
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#b0b3c6" }}>Phone number *</label>
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="919876543210  (country code + number)"
                style={inputCls}
                className="placeholder:text-[#c0c3d6] focus:outline-none"
                onFocus={e => (e.currentTarget.style.borderColor = "#7c3aed44")}
                onBlur={e => (e.currentTarget.style.borderColor = "#e8eaf0")}
                onKeyDown={e => { if (e.key === "Enter") handleSubmit(); }}
              />
              <p className="text-[11px] mt-1" style={{ color: "#b0b3c6" }}>
                International format without + — e.g. <span style={{ color: "#7c3aed" }}>919876543210</span> for India
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: "#b0b3c6" }}>Customer name</label>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Optional"
                style={inputCls}
                className="placeholder:text-[#c0c3d6] focus:outline-none"
                onFocus={e => (e.currentTarget.style.borderColor = "#7c3aed44")}
                onBlur={e => (e.currentTarget.style.borderColor = "#e8eaf0")}
              />
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Dialog.Close asChild>
              <button type="button" className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ background: "#f5f6fa", color: "#4b4f6b", border: "1px solid #e8eaf0" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#e8eaf0")}
                onMouseLeave={e => (e.currentTarget.style.background = "#f5f6fa")}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}
            >
              {isPending ? "Creating…" : "Start conversation"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
