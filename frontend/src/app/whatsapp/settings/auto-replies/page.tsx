"use client";
import { useState } from "react";
import { Plus, Trash2, Loader2, Pencil, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import { useAutoReplies, useCreateAutoReply, useUpdateAutoReply, useDeleteAutoReply, type AutoReply } from "@/hooks/use-auto-replies";

const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.09)", color: "white", borderRadius: "10px", padding: "9px 14px", width: "100%", fontSize: "13px", outline: "none" } as const;
const labelStyle = { fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(255,255,255,0.4)", marginBottom: "6px", display: "block" };

function AutoReplyForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [delay, setDelay] = useState(0);
  const { mutateAsync: create, isPending } = useCreateAutoReply();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create({ name, message, delay_seconds: delay, is_active: true });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-5 space-y-4"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="font-semibold text-white">New Auto Reply</h3>
      {[{ label: "Name", value: name, set: setName, ph: "e.g. Welcome message", rows: 0 },
        { label: "Message", value: message, set: setMessage, ph: "Hi! Thanks for reaching out…", rows: 3 }].map(({ label, value, set, ph, rows }) => (
        <div key={label}>
          <span style={labelStyle}>{label}</span>
          {rows === 0
            ? <input value={value} onChange={e => set(e.target.value)} required placeholder={ph} style={inputStyle}
                className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none"
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")} />
            : <textarea value={value} onChange={e => set(e.target.value)} required placeholder={ph} rows={rows}
                className="resize-none placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none"
                style={{ ...inputStyle }} />}
        </div>
      ))}
      <div>
        <span style={labelStyle}>Delay (seconds)</span>
        <input type="number" min={0} value={delay} onChange={e => setDelay(Number(e.target.value))}
          style={{ ...inputStyle, width: "120px" }} className="focus:outline-none" />
      </div>
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

function AutoReplyRow({ item }: { item: AutoReply }) {
  const { mutateAsync: update } = useUpdateAutoReply();
  const { mutateAsync: del, isPending: isDeleting } = useDeleteAutoReply();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [message, setMessage] = useState(item.message);

  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => update({ id: item.id, payload: { is_active: !item.is_active } })} className="mt-0.5 flex-shrink-0">
          {item.is_active ? <ToggleRight className="h-5 w-5" style={{ color: "#10b981" }} /> : <ToggleLeft className="h-5 w-5" style={{ color: "rgba(255,255,255,0.3)" }} />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} className="focus:outline-none" />
              <textarea value={message} onChange={e => setMessage(e.target.value)} rows={2} className="resize-none focus:outline-none" style={inputStyle} />
              <div className="flex gap-2">
                <button onClick={async () => { await update({ id: item.id, payload: { name, message } }); setEditing(false); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                  <Check className="h-3.5 w-3.5" /> Save
                </button>
                <button onClick={() => { setEditing(false); setName(item.name); setMessage(item.message); }}
                  className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-medium text-white text-sm">{item.name}</p>
              <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "rgba(255,255,255,0.4)" }}>{item.message}</p>
              {item.delay_seconds > 0 && <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Delay: {item.delay_seconds}s</p>}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {[{ Icon: Pencil, fn: () => setEditing(true), col: "#a78bfa" }, { Icon: Trash2, fn: () => del(item.id), col: "#f43f5e", dis: isDeleting }].map(({ Icon, fn, col, dis }, i) => (
              <button key={i} type="button" onClick={fn} disabled={dis}
                className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-50"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                onMouseEnter={e => (e.currentTarget.style.background = col + "22")}
                onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}>
                <Icon size={13} style={{ color: col }} />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AutoRepliesPage() {
  const { data: items = [], isLoading } = useAutoReplies();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">Auto Replies</p>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Auto-respond to incoming messages when active.</p>
        </div>
        <button onClick={() => setShowForm(true)} disabled={showForm}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}>
          <Plus size={14} /> New Auto Reply
        </button>
      </div>
      {showForm && <AutoReplyForm onDone={() => setShowForm(false)} />}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#a78bfa" }} /></div>
      ) : items.length === 0 && !showForm ? (
        <div className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No auto replies yet.</div>
      ) : (
        <div className="space-y-3">{items.map(item => <AutoReplyRow key={item.id} item={item} />)}</div>
      )}
    </div>
  );
}
