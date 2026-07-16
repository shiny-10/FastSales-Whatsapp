"use client";

import { Phone, User, Tag, Clock, ChevronDown, Archive, Trash2, Pencil, Check, X } from "lucide-react";
import { ContactAvatar } from "./ContactAvatar";
import { AssignAgentModal } from "./AssignAgentModal";
import { useArchiveConversation, useDeleteConversation, useUpdateConversation } from "@/hooks/use-conversations";
import { formatLastSeen } from "@/lib/utils";
import type { Conversation, ConversationStatus } from "@/lib/types";
import * as Select from "@radix-ui/react-select";
import { useEffect, useRef, useState } from "react";
import { useInboxStore } from "@/store/inbox-store";

interface CustomerPanelProps {
  conversation: Conversation;
}

const STATUS_OPTIONS: Array<{ value: ConversationStatus; label: string; color: string; bg: string }> = [
  { value: "OPEN",     label: "Open",     color: "#22c55e", bg: "rgba(34,197,94,0.1)" },
  { value: "PENDING",  label: "Pending",  color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
  { value: "RESOLVED", label: "Resolved", color: "#3b82f6", bg: "rgba(59,130,246,0.1)" },
  { value: "CLOSED",   label: "Closed",   color: "#9ca3af", bg: "rgba(156,163,175,0.1)" },
];

function getStatus(v: string) {
  return STATUS_OPTIONS.find(s => s.value === v) ?? STATUS_OPTIONS[0];
}

const sectionLabel = {
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  color: "#b0b3c6",
  marginBottom: "8px",
  display: "block",
};

export function CustomerPanel({ conversation }: CustomerPanelProps) {
  const { mutateAsync: updateConv } = useUpdateConversation();
  const { mutateAsync: archiveConv } = useArchiveConversation();
  const { mutateAsync: deleteConv } = useDeleteConversation();
  const { setActiveConversation } = useInboxStore();
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(conversation.customer_name ?? "");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setName(conversation.customer_name ?? ""), 0);
    return () => clearTimeout(t);
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

  const currentStatus = getStatus(conversation.status);

  return (
    <div className="h-full overflow-y-auto scrollbar-none" style={{ background: "#ffffff" }}>

      {/* Header */}
      <div className="px-5 pt-6 pb-5 text-center" style={{ borderBottom: "1px solid #f0f1f5" }}>
        <ContactAvatar name={conversation.customer_name} phone={conversation.customer_phone} className="h-16 w-16 mx-auto mb-3" />

        <div className="flex items-center justify-center gap-1.5 group mb-1">
          {editingName ? (
            <>
              <input
                ref={nameInputRef}
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleNameKeyDown}
                onBlur={handleNameSave}
                className="text-sm font-semibold text-center bg-transparent focus:outline-none w-36"
                style={{ borderBottom: "2px solid #7c3aed", color: "#1a1d23" }}
                placeholder="Enter name"
              />
              <button type="button" onMouseDown={e => { e.preventDefault(); handleNameSave(); }} style={{ color: "#22c55e" }}>
                <Check className="h-3.5 w-3.5" />
              </button>
              <button type="button" onMouseDown={e => { e.preventDefault(); setName(conversation.customer_name ?? ""); setEditingName(false); }} style={{ color: "#b0b3c6" }}>
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <span className="text-sm font-semibold truncate max-w-[160px]" style={{ color: "#1a1d23" }}>
                {conversation.customer_name || conversation.customer_phone}
              </span>
              <button type="button" onClick={() => setEditingName(true)}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "#b0b3c6" }}>
                <Pencil className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
        <p className="text-xs" style={{ color: "#b0b3c6" }}>{conversation.customer_phone}</p>
      </div>

      {/* Body */}
      <div className="px-5 py-4 space-y-5">

        {/* Status */}
        <div>
          <span style={sectionLabel}>Status</span>
          <Select.Root value={conversation.status} onValueChange={handleStatusChange}>
            <Select.Trigger
              className="flex items-center justify-between w-full rounded-xl px-3 py-2.5 text-sm focus:outline-none"
              style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0", color: "#1a1d23" }}
            >
              <Select.Value>
                <span className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: currentStatus.color }} />
                  {currentStatus.label}
                </span>
              </Select.Value>
              <Select.Icon>
                <ChevronDown className="h-3.5 w-3.5" style={{ color: "#b0b3c6" }} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="z-50 min-w-[160px] rounded-xl p-1 shadow-xl"
                style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
              >
                <Select.Viewport>
                  {STATUS_OPTIONS.map(s => (
                    <Select.Item
                      key={s.value}
                      value={s.value}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer outline-none"
                      style={{ color: "#4b4f6b" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#f5f6fa")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                      <Select.ItemText>{s.label}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Assign agent */}
        <div>
          <span style={sectionLabel}>Assigned Agent</span>
          <AssignAgentModal conversationId={conversation.id} currentAgentId={conversation.assigned_agent_id}>
            <button
              className="flex items-center gap-2 w-full rounded-xl px-3 py-2.5 text-sm transition-colors"
              style={{ background: "#f5f6fa", border: "1.5px dashed #e0e2eb", color: "#9498b0" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#f0eeff")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f5f6fa")}
            >
              <User className="h-4 w-4" style={{ color: "#b0b3c6" }} />
              {conversation.assigned_agent_id ? "Reassign agent" : "Assign agent"}
            </button>
          </AssignAgentModal>
        </div>

        {/* Info */}
        <div>
          <span style={sectionLabel}>Information</span>
          <div className="space-y-2.5">
            {[
              { icon: Phone,  label: "Phone",    value: conversation.customer_phone },
              { icon: Clock,  label: "Last seen", value: formatLastSeen(conversation.last_message_at) },
              { icon: Tag,    label: "Created",   value: new Date(conversation.created_at).toLocaleDateString() },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                  style={{ background: "#f5f6fa" }}>
                  <Icon className="h-3.5 w-3.5" style={{ color: "#9498b0" }} />
                </div>
                <span className="text-xs w-20 shrink-0" style={{ color: "#b0b3c6" }}>{label}</span>
                <span className="text-sm font-medium truncate" style={{ color: "#4b4f6b" }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <span style={sectionLabel}>Notes</span>
          <textarea
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none transition-colors"
            style={{
              background: "#f5f6fa",
              border: "1.5px solid #e8eaf0",
              color: "#4b4f6b",
            }}
            rows={3}
            placeholder="Add a private note…"
            onFocus={e => (e.currentTarget.style.borderColor = "#7c3aed44")}
            onBlur={e => (e.currentTarget.style.borderColor = "#e8eaf0")}
          />
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button
            onClick={async () => await archiveConv({ id: conversation.id, archive: !conversation.is_archived })}
            className="flex items-center gap-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ background: "#f5f6fa", border: "1px solid #e8eaf0", color: "#4b4f6b" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#f0eeff")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f5f6fa")}
          >
            <Archive className="h-4 w-4" style={{ color: "#9498b0" }} />
            {conversation.is_archived ? "Unarchive chat" : "Archive chat"}
          </button>
          <button
            onClick={async () => {
              if (!window.confirm("Delete this conversation?")) return;
              await deleteConv(conversation.id);
              setActiveConversation(null);
            }}
            className="flex items-center gap-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
            style={{ background: "#fff5f5", border: "1px solid #fecaca", color: "#ef4444" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#fee2e2")}
            onMouseLeave={e => (e.currentTarget.style.background = "#fff5f5")}
          >
            <Trash2 className="h-4 w-4" />
            Delete chat
          </button>
        </div>
      </div>
    </div>
  );
}
