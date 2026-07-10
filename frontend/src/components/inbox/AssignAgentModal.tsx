"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssignAgent } from "@/hooks/use-conversations";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getInitials } from "@/lib/utils";

// In production, fetch agents from API
const MOCK_AGENTS = [
  { id: "00000000-0000-0000-0000-000000000002", name: "Alice Smith", email: "alice@acme.com" },
  { id: "00000000-0000-0000-0000-000000000003", name: "Bob Jones", email: "bob@acme.com" },
  { id: "00000000-0000-0000-0000-000000000004", name: "Carol White", email: "carol@acme.com" },
];

interface AssignAgentModalProps {
  conversationId: string;
  currentAgentId?: string;
  children: React.ReactNode;
}

export function AssignAgentModal({
  conversationId,
  currentAgentId,
  children,
}: AssignAgentModalProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { mutateAsync, isPending } = useAssignAgent();

  const filtered = MOCK_AGENTS.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async (agentId: string) => {
    await mutateAsync({ conversationId, agentId });
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>{children}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-background p-6 shadow-2xl border border-border">
          <div className="flex items-center justify-between mb-4">
            <Dialog.Title className="font-semibold text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-brand-600" />
              Assign Agent
            </Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </Dialog.Close>
          </div>

          <Input
            placeholder="Search agents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
          />

          <div className="space-y-1 max-h-64 overflow-y-auto">
            {filtered.map((agent) => (
              <button
                key={agent.id}
                onClick={() => handleAssign(agent.id)}
                disabled={isPending}
                className="w-full flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-accent transition-colors text-left disabled:opacity-50"
              >
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {getInitials(agent.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">{agent.email}</p>
                </div>
                {currentAgentId === agent.id && (
                  <span className="ml-auto text-xs text-brand-600 font-medium">Current</span>
                )}
              </button>
            ))}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
