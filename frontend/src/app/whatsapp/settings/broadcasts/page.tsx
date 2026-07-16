"use client";
import { useState } from "react";
import { Plus, Send, Trash2, Loader2, Users, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { useBroadcasts, useCreateBroadcast, useDeleteBroadcast, useSendBroadcast, type Broadcast } from "@/hooks/use-broadcasts";

const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.09)", color: "white", borderRadius: "10px", padding: "9px 14px", width: "100%", fontSize: "13px", outline: "none" } as const;
const labelStyle = { fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(255,255,255,0.4)", marginBottom: "6px", display: "block" };

const STATUS_CFG: Record<string, { icon: any; color: string; bg: string }> = {
  DRAFT:     { icon: Clock,        color: "#b0b3c6", bg: "rgba(255,255,255,0.07)" },
  SCHEDULED: { icon: Calendar,     color: "#60a5fa", bg: "rgba(96,165,250,0.15)" },
  SENDING:   { icon: Loader2,      color: "#f59e0b", bg: "rgba(245,158,11,0.15)" },
  DONE:      { icon: CheckCircle2, color: "#10b981", bg: "rgba(16,185,129,0.15)" },
  FAILED:    { icon: XCircle,      color: "#f43f5e", bg: "rgba(244,63,94,0.15)" },
};

function BroadcastForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState(""); const [message, setMessage] = useState(""); const [recipientsRaw, setRecipientsRaw] = useState("");
  const { mutateAsync: create, isPending } = useCreateBroadcast();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = recipientsRaw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    if (!name || !message || !recipients.length) return;
    await create({ name, message, recipients }); onDone();
  };
  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="font-semibold text-white">New Broadcast</h3>
      <div><span style={labelStyle}>Name</span>
        <input value={name} onChange={e => setName(e.target.value)} required placeholder="e.g. Promo July" style={inputStyle}
          className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none"
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")} onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")} /></div>
      <div><span style={labelStyle}>Message</span>
        <textarea value={message} onChange={e => setMessage(e.target.value)} required rows={3} placeholder="Hello {{name}}, …"
          className="resize-none placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none" style={inputStyle} /></div>
      <div><span style={labelStyle}>Recipients (phone numbers, comma or newline separated)</span>
        <textarea value={recipientsRaw} onChange={e => setRecipientsRaw(e.target.value)} required rows={3} placeholder={"919876543210\n14155552671"}
          className="resize-none placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none font-mono text-xs" style={inputStyle} /></div>
      <div className="flex gap-3">
        <button type="button" onClick={onDone} className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
        <button type="submit" disabled={isPending} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}>
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create
        </button>
      </div>
    </form>
  );
}

function BroadcastRow({ b }: { b: Broadcast }) {
  const { mutateAsync: send, isPending: isSending } = useSendBroadcast();
  const { mutateAsync: del, isPending: isDeleting } = useDeleteBroadcast();
  const [error, setError] = useState<string | null>(null);
  const cfg = STATUS_CFG[b.status] ?? STATUS_CFG.DRAFT;
  const StatusIcon = cfg.icon;
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      {error && <div className="text-xs rounded-xl px-3 py-2 mb-3" style={{ background: "rgba(244,63,94,0.12)", color: "#fca5a5", border: "1px solid rgba(244,63,94,0.2)" }}>{error}</div>}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: cfg.bg, color: cfg.color }}>
              <StatusIcon className={`h-3 w-3 ${b.status === "SENDING" ? "animate-spin" : ""}`} />{b.status}
            </span>
            <span className="font-medium text-white text-sm truncate">{b.name}</span>
          </div>
          <p className="text-xs line-clamp-2 mb-2" style={{ color: "rgba(255,255,255,0.4)" }}>{b.message}</p>
          <div className="flex items-center gap-3 text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{b.recipients.length} recipients</span>
            {b.sent_count > 0 && <span style={{ color: "#10b981" }}>✓ {b.sent_count} sent</span>}
            {b.failed_count > 0 && <span style={{ color: "#f43f5e" }}>✗ {b.failed_count} failed</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {(b.status === "DRAFT" || b.status === "FAILED") && (
            <button onClick={async () => { setError(null); try { await send(b.id); } catch (e: any) { setError(e?.response?.data?.detail ?? "Send failed"); } }}
              disabled={isSending} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white disabled:opacity-50"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
            </button>
          )}
          <button onClick={() => del(b.id)} disabled={isDeleting} className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-50"
            style={{ background: "rgba(244,63,94,0.1)", border: "1px solid rgba(244,63,94,0.2)" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(244,63,94,0.2)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(244,63,94,0.1)")}>
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: "#f43f5e" }} /> : <Trash2 size={13} style={{ color: "#f43f5e" }} />}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const { data: broadcasts = [], isLoading } = useBroadcasts();
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">Broadcasts</p>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Send bulk messages to multiple contacts at once.</p>
        </div>
        <button onClick={() => setShowForm(true)} disabled={showForm}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}>
          <Plus size={14} /> New Broadcast
        </button>
      </div>
      {showForm && <BroadcastForm onDone={() => setShowForm(false)} />}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#a78bfa" }} /></div>
        : broadcasts.length === 0 && !showForm ? <div className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No broadcasts yet. Create one to get started.</div>
        : <div className="space-y-3">{broadcasts.map(b => <BroadcastRow key={b.id} b={b} />)}</div>}
    </div>
  );
}
