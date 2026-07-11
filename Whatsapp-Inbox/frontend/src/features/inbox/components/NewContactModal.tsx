"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, X } from "lucide-react";
import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { useCreateConversation } from "@/features/inbox/api/use-conversations";
import { toast } from "@/shared/components/toast";

interface NewContactModalProps {
  onCreated: (conversationId: string) => void;
}

export function NewContactModal({ onCreated }: NewContactModalProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const { mutateAsync, isPending } = useCreateConversation();

  const handleSubmit = async () => {
    const trimmedPhone = phone.trim();
    if (!trimmedPhone) {
      toast.error("Phone number is required");
      return;
    }

    try {
      const conversation = await mutateAsync({
        customer_phone: trimmedPhone,
        customer_name: name.trim() || undefined,
      });
      setOpen(false);
      setPhone("");
      setName("");
      onCreated(conversation.id);
    } catch (error) {
      console.error(error);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button size="sm" variant="secondary" className="h-9 px-3">
          <Plus className="mr-2 h-4 w-4" />
          New contact
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background p-6 shadow-2xl border border-border">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Add contact</h2>
              <p className="text-sm text-muted-foreground">
                Create a new conversation for a customer phone number.
              </p>
            </div>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Phone number
              </label>
              <Input
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="e.g. +14155552671"
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Customer name
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Optional"
                className="mt-2"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Dialog.Close asChild>
              <Button variant="ghost" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button size="sm" onClick={handleSubmit} disabled={isPending}>
              Create conversation
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
