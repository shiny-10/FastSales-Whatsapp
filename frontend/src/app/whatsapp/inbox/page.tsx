"use client";
import { useEffect, useState } from "react";
import { useInboxStore } from "@/store/inbox-store";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { useConversation, useMarkConversationRead } from "@/hooks/use-conversations";
import { MessageSquareDashed, Lock, Calendar, Trash2, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContacts } from "@/services/contactService";
import { getTemplates } from "@/services/templateService";
import { listCampaigns, runCampaign } from "@/services/campaignService";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export default function InboxPage() {
  const { activeConversationId, setActiveConversation, updateConversation } = useInboxStore();
  const { data: conversation } = useConversation(activeConversationId);
  const { mutate: markConversationRead } = useMarkConversationRead();
  const [panelOpen, setPanelOpen] = useState(false);

  // Close panel when switching conversations
  useEffect(() => {
    setPanelOpen(false);
    if (activeConversationId) {
      // Immediately zero out unread badge in the store so the Unread tab
      // removes this conversation right away (like real WhatsApp behaviour).
      updateConversation(activeConversationId, { unread_count: 0 });
      markConversationRead(activeConversationId);
    }
  }, [activeConversationId, markConversationRead, updateConversation]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: "#f5f6fa" }}>

      {/* ── LEFT: Send Message + Run Campaign ── */}
      <div
        className="hidden lg:flex flex-col h-full flex-shrink-0"
        style={{
          width: "280px",
          minWidth: "280px",
          background: "#ffffff",
          borderRight: "1px solid #e8eaf0",
          padding: "16px 12px",
          gap: "12px",
          overflowY: "auto",
        }}
      >
        <SendMessagePanel onConversationReady={setActiveConversation} />
        <RunCampaignPanel />
        <ScheduleMessagePanel />
      </div>

      {/* ── CENTER: Conversation list ── */}
      <div
        className={cn(
          "flex flex-col h-full flex-shrink-0",
          activeConversationId ? "hidden md:flex" : "flex w-full md:w-[340px]"
        )}
        style={{
          width: "340px",
          minWidth: "340px",
          background: "#ffffff",
          borderRight: "1px solid #e8eaf0",
        }}
      >
        <ConversationList />
      </div>

      {/* ── RIGHT: Chat window + sliding Customer panel ── */}
      <div
        className={cn(
          "flex flex-1 h-full overflow-hidden relative",
          !activeConversationId ? "hidden md:flex" : "flex"
        )}
      >
        {/* Chat window */}
        <div className="flex flex-col flex-1 h-full overflow-hidden" style={{ background: "#f5f6fa" }}>
          {activeConversationId ? (
            <ChatWindow
              conversationId={activeConversationId}
              onBack={() => setActiveConversation(null)}
              onContactClick={() => setPanelOpen((v) => !v)}
            />
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Sliding Customer Panel */}
        {activeConversationId && conversation && (
          <div
            className="flex-shrink-0 h-full overflow-y-auto transition-all duration-300 ease-in-out"
            style={{
              width: panelOpen ? "300px" : "0px",
              minWidth: panelOpen ? "300px" : "0px",
              background: "#ffffff",
              borderLeft: panelOpen ? "1px solid #e8eaf0" : "none",
              overflow: panelOpen ? "auto" : "hidden",
            }}
          >
            {panelOpen && (
              <CustomerPanel
                conversation={conversation}
                onClose={() => setPanelOpen(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Send Message Panel
───────────────────────────────────────────── */
function SendMessagePanel({ onConversationReady }: { onConversationReady: (id: string) => void }) {
  const [contacts, setContacts] = useState<{ id: string | number; name: string; phone_number: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string | number; template_name: string; status?: string; meta_status?: string; template_body?: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const qc = useQueryClient();
  const { addMessage } = useInboxStore();

  useEffect(() => {
    getContacts().then((res) => {
      const items = Array.isArray(res) ? res : res?.contacts ?? res?.items ?? [];
      setContacts(items);
    }).catch(() => {});
    getTemplates().then((res) => {
      const items: { id: string | number; template_name: string; status?: string; meta_status?: string; template_body?: string }[] =
        Array.isArray(res) ? res : res?.templates ?? res?.items ?? [];
      setTemplates(items.filter((t) => t.meta_status === "APPROVED"));
    }).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!selectedContact || !selectedTemplate) return;
    const contact = contacts.find((c) => String(c.id) === selectedContact);
    if (!contact) return;

    setLoading(true);
    setStatus(null);

    try {
      // Step 1: Send template via /api/whatsapp/send (uses env credentials directly)
      const { data: sendData } = await api.post("/api/whatsapp/send", {
        to: contact.phone_number,
        template_name: selectedTemplate,
      });

      if (sendData?.success === false) {
        setStatus(`Error: ${sendData?.error ?? "Send failed"}`);
        return;
      }

      // Step 2: Ensure an inbox conversation exists for this phone (get or create)
      const { data: convData } = await api.post("/inbox/conversations", {
        customer_phone: contact.phone_number,
        customer_name: contact.name,
      });

      const conversationId = String(convData?.conversation?.id ?? convData?.id ?? "");
      if (!conversationId || conversationId === "undefined") {
        setStatus("Sent! But could not open conversation.");
        return;
      }

      // Step 3: Push message directly into the store so it appears instantly in chat
      if (sendData?.message) {
        addMessage({
          ...sendData.message,
          conversation_id: conversationId,
          id: sendData.message.id ?? String(Date.now()),
          reactions: [],
          media_files: [],
        });
      }

      // Step 4: Refresh list and open the conversation
      qc.invalidateQueries({ queryKey: ["conversations"] });
      qc.invalidateQueries({ queryKey: ["messages", conversationId] });
      setStatus(convData?.created ? "Sent! New conversation created." : "Sent! Added to existing conversation.");
      setSelectedContact("");
      setSelectedTemplate("");
      onConversationReady(conversationId);

    } catch (e: any) {
      const rawErr =
        e?.response?.data?.detail ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to send.";
      const detail = typeof rawErr === "object" ? (rawErr.message || (rawErr.error_data ? rawErr.error_data.details : JSON.stringify(rawErr))) : String(rawErr);
      console.error("[SendMessage] error:", e?.response?.data ?? e);
      setStatus(`Error: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-3 flex-1 flex flex-col" style={{ background: "#fff", border: "1px solid #ece9f8" }}>
      <h3 className="font-bold text-sm mb-0.5" style={{ color: "#1a1040" }}>Send Message</h3>
      <p className="text-[11px] mb-3" style={{ color: "#9390b5" }}>Send a WhatsApp message using a template.</p>

      <label className="block text-[11px] font-medium mb-1" style={{ color: "#4b4880" }}>Select Contact</label>
      <select
        value={selectedContact}
        onChange={(e) => setSelectedContact(e.target.value)}
        className="w-full rounded-lg px-2.5 py-2 text-xs mb-3 focus:outline-none"
        style={{ border: "1px solid #e0ddf5", background: "#f5f4fb", color: selectedContact ? "#1a1040" : "#b0aed0" }}
      >
        <option value="">Select contact...</option>
        {contacts.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.name}</option>
        ))}
      </select>

      <label className="block text-[11px] font-medium mb-1" style={{ color: "#4b4880" }}>Select Template</label>
      <select
        value={selectedTemplate}
        onChange={(e) => setSelectedTemplate(e.target.value)}
        className="w-full rounded-lg px-2.5 py-2 text-xs mb-3 focus:outline-none"
        style={{ border: "1px solid #e0ddf5", background: "#f5f4fb", color: selectedTemplate ? "#1a1040" : "#b0aed0" }}
      >
        <option value="">Select template...</option>
        {templates.filter((t) => (t.status || t.meta_status || "").toUpperCase() === "APPROVED").map((t) => (
          <option key={t.id} value={t.template_name}>{t.template_name}</option>
        ))}
      </select>

      <button
        onClick={handleSend}
        disabled={loading || !selectedContact || !selectedTemplate}
        className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
        style={{
          background: "linear-gradient(90deg,#7c3aed,#4f46e5)",
          color: "#fff",
          opacity: loading || !selectedContact || !selectedTemplate ? 0.55 : 1,
          boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
        }}
      >
        {loading ? "Sending…" : "Send WhatsApp Message"}
      </button>

      {status && (
        <p
          className="text-[11px] mt-2 text-center break-words"
          style={{ color: status.startsWith("Sent") ? "#10b981" : "#f43f5e" }}
        >
          {status}
        </p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Run Campaign Panel
───────────────────────────────────────────── */
function RunCampaignPanel() {
  const [campaigns, setCampaigns] = useState<{ id: string | number; campaign_name: string }[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    listCampaigns().then((res) => {
      // backend returns { success, campaigns: [...] } or a plain array
      const items: any[] = Array.isArray(res) ? res : res?.campaigns ?? [];
      setCampaigns(items);
    }).catch(() => {});
  }, []);

  const handleRun = async () => {
    if (!selectedCampaign) return;
    setLoading(true);
    setStatus(null);
    try {
      const result = await runCampaign(selectedCampaign);
      if (result?.success === false) {
        setStatus(`Error: ${result.error || "Failed to run campaign"}`);
      } else {
        const sent = result?.sent ?? result?.message_count ?? "?";
        const failed = result?.failed ?? 0;
        setStatus(`Sent to ${sent} contact${sent !== 1 ? "s" : ""}${failed > 0 ? `, ${failed} failed` : ""}`);
        setSelectedCampaign("");
      }
    } catch {
      setStatus("Failed to run.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-3 flex-1 flex flex-col" style={{ background: "#fff", border: "1px solid #ece9f8" }}>
      <h3 className="font-bold text-sm mb-0.5" style={{ color: "#1a1040" }}>Run Campaign</h3>
      <p className="text-[11px] mb-3" style={{ color: "#9390b5" }}>Send messages to all contacts in a campaign.</p>

      <label className="block text-[11px] font-medium mb-1" style={{ color: "#4b4880" }}>Select Campaign</label>
      <select
        value={selectedCampaign}
        onChange={(e) => setSelectedCampaign(e.target.value)}
        className="w-full rounded-lg px-2.5 py-2 text-xs mb-3 focus:outline-none"
        style={{ border: "1px solid #e0ddf5", background: "#f5f4fb", color: selectedCampaign ? "#1a1040" : "#b0aed0" }}
      >
        <option value="">Select campaign...</option>
        {campaigns.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.campaign_name}</option>
        ))}
      </select>

      <button
        onClick={handleRun}
        disabled={loading || !selectedCampaign}
        className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
        style={{
          background: "linear-gradient(90deg,#7c3aed,#4f46e5)",
          color: "#fff",
          opacity: loading || !selectedCampaign ? 0.55 : 1,
          boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
        }}
      >
        {loading ? "Running…" : "Send Campaign"}
      </button>

      {status && (
        <p className="text-[11px] mt-2 text-center" style={{ color: status.startsWith("Error") ? "#f43f5e" : "#10b981" }}>{status}</p>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────
   Empty State
───────────────────────────────────────────── */
function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 select-none" style={{ background: "#f5f6fa" }}>
      <div
        className="flex items-center justify-center w-20 h-20 rounded-2xl"
        style={{ background: "linear-gradient(135deg,#7c3aed22,#4f46e511)", border: "1.5px solid #7c3aed33" }}
      >
        <MessageSquareDashed className="w-10 h-10" style={{ color: "#7c3aed" }} />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-semibold" style={{ color: "#1a1d23" }}>Select a conversation</h2>
        <p className="text-sm mt-2 max-w-xs" style={{ color: "#8b8fa8" }}>Choose a conversation from the left to start chatting</p>
      </div>
      <div className="flex items-center gap-1.5 text-xs" style={{ color: "#b0b3c6" }}>
        <Lock className="w-3 h-3" />
        End-to-end encrypted
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   Schedule Message Panel
───────────────────────────────────────────── */
type ScheduledMsg = {
  id: string;
  customer_phone: string;
  content: string;
  template_name?: string;
  message_type: string;
  scheduled_at: string;
  status: string;
};

function ScheduleMessagePanel() {
  const [contacts, setContacts] = useState<{ id: string | number; name: string; phone_number: string }[]>([]);
  const [templates, setTemplates] = useState<{ id: string | number; template_name: string; status?: string; meta_status?: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState("");
  const [messageType, setMessageType] = useState<"TEXT" | "TEMPLATE">("TEXT");
  const [textContent, setTextContent] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ msg: string; ok: boolean } | null>(null);
  const [scheduled, setScheduled] = useState<ScheduledMsg[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const formatLocalDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}`;
  };

  const minScheduleDateTime = formatLocalDateTime(new Date(Date.now() + 120_000));

  // Load contacts + approved templates + existing scheduled messages
  useEffect(() => {
    getContacts()
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.contacts ?? res?.items ?? [];
        setContacts(items);
      })
      .catch(() => {});

    getTemplates()
      .then((res) => {
        const items = Array.isArray(res) ? res : res?.templates ?? res?.items ?? [];
        setTemplates((items as any[]).filter((t) => t.meta_status === "APPROVED"));
      })
      .catch(() => {});

    loadScheduled();
  }, []);

  const loadScheduled = () => {
    setLoadingList(true);
    api
      .get("/inbox/scheduled-messages", { params: { status: "PENDING" } })
      .then(({ data }) => setScheduled(data?.items ?? []))
      .catch(() => {})
      .finally(() => setLoadingList(false));
  };

  const handleSchedule = async () => {
    if (!selectedContact || !scheduledAt) return;
    if (messageType === "TEXT" && !textContent.trim()) return;
    if (messageType === "TEMPLATE" && !selectedTemplate) return;

    const contact = contacts.find((c) => String(c.id) === selectedContact);
    if (!contact) return;

    setLoading(true);
    setStatus(null);

    try {
      const scheduledTimestamp = new Date(scheduledAt).getTime();
      if (scheduledTimestamp <= Date.now() + 5000) {
        setStatus({ msg: "Please choose a time at least a few seconds in the future.", ok: false });
        return;
      }

      const { data } = await api.post("/inbox/scheduled-messages", {
        customer_phone: contact.phone_number,
        customer_name: contact.name,
        message_type: messageType,
        content: messageType === "TEXT" ? textContent.trim() : undefined,
        template_name: messageType === "TEMPLATE" ? selectedTemplate : undefined,
        scheduled_at: new Date(scheduledAt).toISOString(),
      });

      if (data?.success) {
        setStatus({ msg: "Message scheduled!", ok: true });
        setSelectedContact("");
        setTextContent("");
        setSelectedTemplate("");
        setScheduledAt("");
        loadScheduled();
      } else {
        setStatus({ msg: data?.detail ?? "Failed to schedule.", ok: false });
      }
    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ?? e?.message ?? "Failed to schedule.";
      setStatus({ msg: detail, ok: false });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/inbox/scheduled-messages/${id}`);
      setScheduled((prev) => prev.filter((m) => m.id !== id));
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
    }
  };

  const selectStyle = {
    border: "1px solid #e0ddf5",
    background: "#f5f4fb",
    borderRadius: "8px",
    padding: "7px 10px",
    fontSize: "11px",
    width: "100%",
    outline: "none",
  } as const;

  const inputStyle = {
    ...selectStyle,
    color: "#1a1040",
  } as const;

  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-2"
      style={{ background: "#fff", border: "1px solid #ece9f8" }}
    >
      {/* Header */}
      <div>
        <h3 className="font-bold text-sm mb-0.5" style={{ color: "#1a1040" }}>
          Schedule Message
        </h3>
        <p className="text-[11px]" style={{ color: "#9390b5" }}>
          Schedule WhatsApp messages to be sent later.
        </p>
      </div>

      {/* Contact */}
      <div>
        <label className="block text-[11px] font-medium mb-1" style={{ color: "#4b4880" }}>
          Select Contact
        </label>
        <select
          value={selectedContact}
          onChange={(e) => setSelectedContact(e.target.value)}
          className="focus:outline-none"
          style={{ ...selectStyle, color: selectedContact ? "#1a1040" : "#b0aed0" }}
        >
          <option value="">Select contact...</option>
          {contacts.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {/* Message type toggle */}
      <div className="flex gap-1.5">
        {(["TEXT", "TEMPLATE"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setMessageType(t)}
            className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition-all"
            style={{
              background: messageType === t ? "linear-gradient(90deg,#7c3aed,#4f46e5)" : "#f5f4fb",
              color: messageType === t ? "#fff" : "#9390b5",
              border: messageType === t ? "none" : "1px solid #e0ddf5",
            }}
          >
            {t === "TEXT" ? "Text" : "Template"}
          </button>
        ))}
      </div>

      {/* Content */}
      {messageType === "TEXT" ? (
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "#4b4880" }}>
            Message
          </label>
          <textarea
            value={textContent}
            onChange={(e) => setTextContent(e.target.value)}
            rows={3}
            placeholder="Type your message…"
            className="resize-none focus:outline-none placeholder:text-[#b0aed0]"
            style={inputStyle}
          />
        </div>
      ) : (
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "#4b4880" }}>
            Select Template
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="focus:outline-none"
            style={{ ...selectStyle, color: selectedTemplate ? "#1a1040" : "#b0aed0" }}
          >
            <option value="">Select template...</option>
            {templates.map((t) => (
              <option key={t.id} value={String((t as any).template_name)}>
                {(t as any).template_name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Date & Time */}
      <div>
        <label className="block text-[11px] font-medium mb-1" style={{ color: "#4b4880" }}>
          Select Date &amp; Time
        </label>
        <div className="relative">
          <Calendar
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
            style={{ color: "#b0aed0" }}
          />
          <input
            type="datetime-local"
            value={scheduledAt}
            min={minScheduleDateTime}
            onChange={(e) => setScheduledAt(e.target.value)}
            className="focus:outline-none"
            style={{ ...inputStyle, paddingLeft: "28px" }}
          />
        </div>
      </div>

      {/* Submit */}
      <button
        onClick={handleSchedule}
        disabled={
          loading ||
          !selectedContact ||
          !scheduledAt ||
          (messageType === "TEXT" ? !textContent.trim() : !selectedTemplate)
        }
        className="w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
        style={{
          background: "linear-gradient(90deg,#7c3aed,#4f46e5)",
          color: "#fff",
          opacity:
            loading ||
            !selectedContact ||
            !scheduledAt ||
            (messageType === "TEXT" ? !textContent.trim() : !selectedTemplate)
              ? 0.55
              : 1,
          boxShadow: "0 4px 12px rgba(124,58,237,0.3)",
        }}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Calendar className="h-3.5 w-3.5" />
        )}
        {loading ? "Scheduling…" : "Schedule Message"}
      </button>

      {/* Status feedback */}
      {status && (
        <div
          className="flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-2"
          style={{
            background: status.ok ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
            color: status.ok ? "#059669" : "#ef4444",
            border: `1px solid ${status.ok ? "rgba(16,185,129,0.2)" : "rgba(239,68,68,0.2)"}`,
          }}
        >
          {status.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {status.msg}
        </div>
      )}

      {/* Scheduled list */}
      {(loadingList || scheduled.length > 0) && (
        <div style={{ borderTop: "1px solid #f0eefb", paddingTop: "8px", marginTop: "2px" }}>
          <p className="text-[11px] font-semibold mb-2" style={{ color: "#4b4880" }}>
            Pending ({loadingList ? "…" : scheduled.length})
          </p>

          {loadingList ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin" style={{ color: "#7c3aed" }} />
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {scheduled.map((msg) => {
                const contact = contacts.find(
                  (c) => c.phone_number === msg.customer_phone
                );
                return (
                  <div
                    key={msg.id}
                    className="flex items-start justify-between gap-2 rounded-lg p-2"
                    style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-[11px] font-semibold truncate"
                        style={{ color: "#1a1040" }}
                      >
                        {contact?.name ?? msg.customer_phone}
                      </p>
                      <p
                        className="text-[10px] truncate mt-0.5"
                        style={{ color: "#9390b5" }}
                      >
                        {msg.message_type === "TEMPLATE"
                          ? msg.template_name ?? msg.content ?? "—"
                          : msg.content ?? msg.template_name ?? "—"}
                      </p>
                      <p
                        className="text-[10px] mt-0.5 flex items-center gap-1"
                        style={{ color: "#7c3aed" }}
                      >
                        <Calendar className="h-2.5 w-2.5 shrink-0" />
                        {new Date(msg.scheduled_at).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleCancel(msg.id)}
                      disabled={deletingId === msg.id}
                      className="shrink-0 p-1 rounded-lg transition-colors"
                      style={{ color: "#f43f5e" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(244,63,94,0.08)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                      title="Cancel"
                    >
                      {deletingId === msg.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
