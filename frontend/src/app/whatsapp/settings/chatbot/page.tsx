"use client";
import { useState } from "react";
import { Plus, Trash2, Loader2, Pencil, Check, X, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { useChatbotRules, useCreateChatbotRule, useUpdateChatbotRule, useDeleteChatbotRule, type ChatbotRule } from "@/hooks/use-chatbot-rules";

const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.09)", color: "white", borderRadius: "10px", padding: "9px 14px", width: "100%", fontSize: "13px", outline: "none" } as const;
const labelStyle = { fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(255,255,255,0.4)", marginBottom: "6px", display: "block" };

function RuleForm({ onDone }: { onDone: () => void }) {
  const [keyword, setKeyword] = useState(""); const [response, setResponse] = useState("");
  const [matchExact, setMatchExact] = useState(false); const [priority, setPriority] = useState(0);
  const { mutateAsync: create, isPending } = useCreateChatbotRule();
  const handleSubmit = async (e: React.FormEvent) => { e.preventDefault(); await create({ keyword, response, match_exact: matchExact, priority, is_active: true }); onDone(); };
  return (
    <form onSubmit={handleSubmit} className="rounded-2xl p-5 space-y-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <h3 className="font-semibold text-white">New Chatbot Rule</h3>
      <div className="grid grid-cols-2 gap-3">
        <div><span style={labelStyle}>Keyword / Trigger</span>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} required placeholder="price, help, hours" style={inputStyle}
            className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none font-mono"
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")} onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")} /></div>
        <div><span style={labelStyle}>Priority (higher = first)</span>
          <input type="number" value={priority} onChange={e => setPriority(Number(e.target.value))} style={inputStyle} className="focus:outline-none" /></div>
      </div>
      <div><span style={labelStyle}>Response</span>
        <textarea value={response} onChange={e => setResponse(e.target.value)} required rows={3} placeholder="Our pricing starts at…"
          className="resize-none placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none" style={inputStyle} /></div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={matchExact} onChange={e => setMatchExact(e.target.checked)} className="accent-violet-500" />
        <span className="text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>Exact match only (otherwise: contains)</span>
      </label>
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

function RuleRow({ rule }: { rule: ChatbotRule }) {
  const { mutateAsync: update } = useUpdateChatbotRule();
  const { mutateAsync: del, isPending: isDeleting } = useDeleteChatbotRule();
  const [editing, setEditing] = useState(false);
  const [keyword, setKeyword] = useState(rule.keyword);
  const [response, setResponse] = useState(rule.response);
  return (
    <div className="rounded-2xl p-4" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => update({ id: rule.id, payload: { is_active: !rule.is_active } })} className="mt-0.5 flex-shrink-0">
          {rule.is_active ? <ToggleRight className="h-5 w-5" style={{ color: "#10b981" }} /> : <ToggleLeft className="h-5 w-5" style={{ color: "rgba(255,255,255,0.3)" }} />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input value={keyword} onChange={e => setKeyword(e.target.value)} style={{ ...inputStyle }} className="focus:outline-none font-mono" />
              <textarea value={response} onChange={e => setResponse(e.target.value)} rows={2} className="resize-none focus:outline-none" style={inputStyle} />
              <div className="flex gap-2">
                <button onClick={async () => { await update({ id: rule.id, payload: { keyword, response } }); setEditing(false); }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}><Check className="h-3.5 w-3.5" /> Save</button>
                <button onClick={() => { setEditing(false); setKeyword(rule.keyword); setResponse(rule.response); }}
                  className="px-3 py-1.5 rounded-lg text-xs" style={{ color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.06)" }}><X className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-mono font-semibold"
                  style={{ background: "rgba(124,58,237,0.2)", color: "#a78bfa" }}>
                  <Zap className="h-3 w-3" />{rule.keyword}
                </span>
                {rule.match_exact && <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.4)" }}>exact</span>}
                <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>priority: {rule.priority}</span>
              </div>
              <p className="text-xs line-clamp-2" style={{ color: "rgba(255,255,255,0.4)" }}>{rule.response}</p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            {[{ Icon: Pencil, fn: () => setEditing(true), col: "#a78bfa" }, { Icon: Trash2, fn: () => del(rule.id), col: "#f43f5e", dis: isDeleting }].map(({ Icon, fn, col, dis }, i) => (
              <button key={i} type="button" onClick={fn} disabled={dis} className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-50"
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

export default function ChatbotPage() {
  const { data: rules = [], isLoading } = useChatbotRules();
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold text-white">Chatbot Rules</p>
          <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>Keyword-triggered auto-responses. Higher priority matches first.</p>
        </div>
        <button onClick={() => setShowForm(true)} disabled={showForm}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.35)" }}>
          <Plus size={14} /> New Rule
        </button>
      </div>
      {showForm && <RuleForm onDone={() => setShowForm(false)} />}
      {isLoading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" style={{ color: "#a78bfa" }} /></div>
        : rules.length === 0 && !showForm ? <div className="text-center py-16 text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>No chatbot rules yet.</div>
        : <div className="space-y-3">{rules.map(r => <RuleRow key={r.id} rule={r} />)}</div>}
    </div>
  );
}
