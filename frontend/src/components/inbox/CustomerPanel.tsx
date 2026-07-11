"use client";

import { Phone, User, Tag, Clock, ChevronDown, Archive, Trash2, Pencil, Check, X } from "lucide-react";
import { ContactAvatar } from "./ContactAvatar";
import { StatusBadge } from "./StatusBadge";
import { AssignAgentModal } from "./AssignAgentModal";
import { Button } from "@/components/ui/button";
import { useArchiveConversation, useDeleteConversation, useUpdateConversation } from "@/hooks/use-conversations";
import { getInitials, formatLastSeen } from "@/lib/utils";
import type { Conversation, ConversationStatus } from "@/lib/types";
import * as Select from "@radix-ui/react-select";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { useInboxStore } from "@/store/inbox-store";

interface CustomerPanelProps {
  conversation: Conversation;
}

const STATUS_OPTIONS: ConversationStatus[] = ["OPEN", "PENDING", "RESOLVED", "CLOSED"];

export function CustomerPanel({ conversation }: CustomerPanelProps) {
  const { mutateAsync: updateConv } = useUpdateConversation();
  const { mutateAsync: archiveConv } = useArchiveConversation();
  const { mutateAsync: deleteConv } = useDeleteConversation();
  const { setActiveConversation } = useInboxStore();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(conversation.customer_name ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setName(conversation.customer_name ?? "");
  }, [conversation.customer_name]);

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus();
  }, [editingName]);

  const handleStatusChange = async (status: string) => {
    await updateConv({ id: conversation.id, status: status as ConversationStatus });
  };

  const handleNameSave = async () => {
    setEditingName(false);
    const trimmed = name.trim();
    if (trimmed === (conversation.customer_name ?? "")) return;
    await updateConv({ id: conversation.id, customer_name: trimmed || undefined });
  };

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleNameSave();
    if (e.key === "Escape") { setName(conversation.customer_name ?? ""); setEditingName(false); }
  };

  const handleArchiveToggle = async () => {
    await archiveConv({ id: conversation.id, archive: !conversation.is_archived });
  };

  const handleDelete = async () => {
    if (!window.confirm("Delete this conversation? This cannot be undone.")) {
      return;
    }
    await deleteConv(conversation.id);
    setActiveConversation(null);
  };

  return (
    <div className="h-full overflow-y-auto">
      {/* Customer Header */}
      <div className="px-5 py-5 border-b border-border text-center">
        <ContactAvatar
          name={conversation.customer_name}
          phone={conversation.customer_phone}
          className="h-16 w-16 mx-auto mb-3"
        />
        <div className="space-y-1">
          {/* Inline editable name — like WhatsApp */}
          <div className="flex items-center justify-center gap-1 group">
            {editingName ? (
              <>
                <input
                  ref={nameInputRef}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameSave}
                  className="text-sm font-semibold text-center bg-transparent border-b-2 border-brand-400 focus:outline-none w-36"
                  placeholder="Enter name"
                />
                <button type="button" onMouseDown={(e) => { e.preventDefault(); handleNameSave(); }} className="text-green-500 hover:text-green-600">
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); setName(conversation.customer_name ?? ""); setEditingName(false); }} className="text-muted-foreground hover:text-destructive">
                  <X className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold truncate max-w-[160px]">
                  {conversation.customer_name || conversation.customer_phone}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingName(true)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  aria-label="Edit name"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">{conversation.customer_phone}</p>
        </div>
      </div>

      {/* Details */}
      <div className="px-5 py-4 space-y-5">
        {/* Status */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
            Status
          </label>
          <Select.Root
            value={conversation.status}
            onValueChange={handleStatusChange}
          >
            <Select.Trigger className="flex items-center justify-between w-full rounded-xl border border-input px-3 py-2 text-sm bg-background hover:bg-accent transition-colors">
              <Select.Value>
                <StatusBadge status={conversation.status} />
              </Select.Value>
              <Select.Icon>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className="z-50 min-w-[160px] rounded-xl border bg-popover p-1 shadow-lg">
                <Select.Viewport>
                  {STATUS_OPTIONS.map((s) => (
                    <Select.Item
                      key={s}
                      value={s}
                      className="flex items-center rounded-lg px-3 py-2 text-sm cursor-pointer outline-none hover:bg-accent"
                    >
                      <Select.ItemText>
                        <StatusBadge status={s} />
                      </Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Assigned Agent */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
            Assigned Agent
          </label>
          <AssignAgentModal
            conversationId={conversation.id}
            currentAgentId={conversation.assigned_agent_id}
          >
            <button className="flex items-center gap-2 w-full rounded-xl border border-dashed border-border px-3 py-2.5 hover:bg-accent transition-colors text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {conversation.assigned_agent_id ? "Reassign agent" : "Assign agent"}
              </span>
            </button>
          </AssignAgentModal>
        </div>

        {/* Actions */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
            Actions
          </label>
          <div className="grid gap-2">
            <Button variant="outline" onClick={handleArchiveToggle}>
              <Archive className="h-4 w-4 mr-2" />
              {conversation.is_archived ? "Unarchive chat" : "Archive chat"}
            </Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete chat
            </Button>
          </div>
        </div>

        {/* Info rows */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block">
            Information
          </label>
          <InfoRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={conversation.customer_phone} />
          <InfoRow
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Last active"
            value={formatLastSeen(conversation.last_message_at)}
          />
          <InfoRow
            icon={<Tag className="h-3.5 w-3.5" />}
            label="Created"
            value={new Date(conversation.created_at).toLocaleDateString()}
          />
        </div>

        {/* Notes placeholder */}
        <div>
          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
            Notes
          </label>
          <textarea
            className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
            rows={3}
            placeholder="Add a private note…"
          />
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="text-sm font-medium truncate">{value}</span>
    </div>
  );
}
