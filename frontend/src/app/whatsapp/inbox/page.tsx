"use client";
import { useEffect, useState } from "react";
import { useInboxStore } from "@/store/inbox-store";
import { ConversationList } from "@/components/inbox/ConversationList";
import { ChatWindow } from "@/components/inbox/ChatWindow";
import { CustomerPanel } from "@/components/inbox/CustomerPanel";
import { useConversation, useMarkConversationRead } from "@/hooks/use-conversations";
import { MessageSquareDashed, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContacts } from "@/services/contactService";
import { getTemplates } from "@/services/templateService";
import { listCampaigns, runCampaign } from "@/services/campaignService";
import { api } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

export default function InboxPage() {
  const { activeConversationId, setActiveConversation } = useInboxStore();
  const { data: conversation } = useConversation(activeConversationId);
  const { mutate: markConversationRead } = useMarkConversationRead();
  const [panelOpen, setPanelOpen] = useState(false);

  // Close panel when switching conversations
  useEffect(() => {
    setPanelOpen(false);
    if (activeConversationId) markConversationRead(activeConversationId);
  }, [activeConversationId, markConversationRead]);

  return (
    <div className="flex h-full w-full overflow-hidden" style={{ background: "#f5f6fa" }}>

      {/* ── LEFT: Send Message + Run Campaign ── */}
      <div
        className="hidden lg:flex flex-col h-full flex-shrink-0 overflow-y-auto"
        style={{
          width: "280px",
          minWidth: "280px",
          background: "#ffffff",
          borderRight: "1px solid #e8eaf0",
          padding: "16px 12px",
          gap: "12px",
        }}
      >
        <SendMessagePanel onConversationReady={setActiveConversation} />
        <RunCampaignPanel />
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
  const [templates, setTemplates] = useState<{ id: string | number; template_name: string; meta_status?: string }[]>([]);
  const [selectedContact, setSelectedContact] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const qc = useQueryClient();

  useEffect(() => {
    getContacts().then((res) => {
      const items = Array.isArray(res) ? res : res?.contacts ?? res?.items ?? [];
      setContacts(items);
    }).catch(() => {});
    getTemplates().then((res) => {
      const items: { id: string | number; template_name: string; meta_status?: string }[] =
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

      // Step 3: Refresh list and open the conversation
      qc.invalidateQueries({ queryKey: ["conversations"] });
      setStatus(convData?.created ? "Sent! New conversation created." : "Sent! Added to existing conversation.");
      setSelectedContact("");
      setSelectedTemplate("");
      onConversationReady(conversationId);

    } catch (e: any) {
      const detail =
        e?.response?.data?.detail ||
        e?.response?.data?.error ||
        e?.message ||
        "Failed to send.";
      console.error("[SendMessage] error:", e?.response?.data ?? e);
      setStatus(`Error: ${detail}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl p-3 flex-shrink-0" style={{ background: "#fff", border: "1px solid #e8eaf0" }}>
      <h3 className="font-bold text-sm mb-0.5" style={{ color: "#1a1d23" }}>Send Message</h3>
      <p className="text-[11px] mb-3" style={{ color: "#8b8fa8" }}>Send a WhatsApp message using a template.</p>

      <label className="block text-[11px] font-medium mb-1" style={{ color: "#5a5e72" }}>Select Contact</label>
      <select
        value={selectedContact}
        onChange={(e) => setSelectedContact(e.target.value)}
        className="w-full rounded-lg px-2.5 py-2 text-xs mb-3 focus:outline-none"
        style={{ border: "1px solid #e8eaf0", background: "#fff", color: selectedContact ? "#1a1d23" : "#b0b3c6" }}
      >
        <option value="">Select contact...</option>
        {contacts.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.name}</option>
        ))}
      </select>

      <label className="block text-[11px] font-medium mb-1" style={{ color: "#5a5e72" }}>Select Template</label>
      <select
        value={selectedTemplate}
        onChange={(e) => setSelectedTemplate(e.target.value)}
        className="w-full rounded-lg px-2.5 py-2 text-xs mb-3 focus:outline-none"
        style={{ border: "1px solid #e8eaf0", background: "#fff", color: selectedTemplate ? "#1a1d23" : "#b0b3c6" }}
      >
        <option value="">Select template...</option>
        {templates.map((t) => (
          <option key={t.id} value={t.template_name}>{t.template_name}</option>
        ))}
      </select>

      <button
        onClick={handleSend}
        disabled={loading || !selectedContact || !selectedTemplate}
        className="w-full py-2 rounded-lg text-xs font-semibold transition-opacity"
        style={{ background: "#25d366", color: "#fff", opacity: loading || !selectedContact || !selectedTemplate ? 0.6 : 1 }}
      >
        {loading ? "Sending…" : "Send WhatsApp Message"}
      </button>

      {status && (
        <p
          className="text-[11px] mt-2 text-center break-words"
          style={{ color: status.startsWith("Sent") ? "#25d366" : "#ef4444" }}
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
    <div className="rounded-xl p-3 flex-shrink-0" style={{ background: "#fff", border: "1px solid #e8eaf0" }}>
      <h3 className="font-bold text-sm mb-0.5" style={{ color: "#1a1d23" }}>Run Campaign</h3>
      <p className="text-[11px] mb-3" style={{ color: "#8b8fa8" }}>Send messages to all contacts in a campaign.</p>

      <label className="block text-[11px] font-medium mb-1" style={{ color: "#5a5e72" }}>Select Campaign</label>
      <select
        value={selectedCampaign}
        onChange={(e) => setSelectedCampaign(e.target.value)}
        className="w-full rounded-lg px-2.5 py-2 text-xs mb-3 focus:outline-none"
        style={{ border: "1px solid #e8eaf0", background: "#fff", color: selectedCampaign ? "#1a1d23" : "#b0b3c6" }}
      >
        <option value="">Select campaign...</option>
        {campaigns.map((c) => (
          <option key={c.id} value={String(c.id)}>{c.campaign_name}</option>
        ))}
      </select>

      <button
        onClick={handleRun}
        disabled={loading || !selectedCampaign}
        className="w-full py-2 rounded-lg text-xs font-semibold transition-opacity"
        style={{ background: "#25d366", color: "#fff", opacity: loading || !selectedCampaign ? 0.6 : 1 }}
      >
        {loading ? "Running…" : "Send Campaign"}
      </button>

      {status && (
        <p className="text-[11px] mt-2 text-center" style={{ color: status.startsWith("Error") ? "#ef4444" : "#25d366" }}>{status}</p>
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
