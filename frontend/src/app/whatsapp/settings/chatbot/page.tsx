"use client";
import { useState } from "react";
import {
  Plus, Trash2, Loader2, Pencil, Check, X,
  ToggleLeft, ToggleRight, Zap, Bot,
} from "lucide-react";
import {
  useChatbotRules, useCreateChatbotRule, useUpdateChatbotRule,
  useDeleteChatbotRule, type ChatbotRule,
} from "@/hooks/use-chatbot-rules";

/* ── Shared styles ────────────────────────────────────────────────────────── */
const inputStyle = {
  background: "#f5f4fb",
  border: "1px solid #e0ddf5",
  color: "#1a1040",
  borderRadius: "10px",
  padding: "9px 14px",
  width: "100%",
  fontSize: "13px",
  outline: "none",
} as const;

const labelStyle = {
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  color: "#9390b5",
  marginBottom: "6px",
  display: "block",
};

/* ── New Rule Form ───────────────────────────────────────────────────────── */
function RuleForm({ onDone }: { onDone: () => void }) {
  const [keyword,    setKeyword]    = useState("");
  const [response,   setResponse]   = useState("");
  const [matchExact, setMatchExact] = useState(false);
  const [priority,   setPriority]   = useState(0);
  const { mutateAsync: create, isPending } = useCreateChatbotRule();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create({ keyword: keyword.trim(), response: response.trim(), match_exact: matchExact, priority, is_active: true });
    onDone();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl p-5 space-y-4"
      style={{ background: "#f5f4fb", border: "1.5px solid #e0ddf5" }}
    >
      <h3 className="font-semibold" style={{ color: "#1a1040" }}>New Chatbot Rule</h3>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <span style={labelStyle}>Keyword / Trigger</span>
          <input
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            required
            placeholder="e.g.  price, help, hours"
            style={inputStyle}
            className="placeholder:text-[#c0bed8] focus:outline-none font-mono"
            onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
            onBlur={e => (e.currentTarget.style.borderColor = "#e0ddf5")}
          />
        </div>
        <div>
          <span style={labelStyle}>Priority (higher = first)</span>
          <input
            type="number"
            min={0}
            value={priority}
            onChange={e => setPriority(Number(e.target.value))}
            style={inputStyle}
            className="focus:outline-none"
          />
        </div>
      </div>

      <div>
        <span style={labelStyle}>Auto-Reply Response</span>
        <textarea
          value={response}
          onChange={e => setResponse(e.target.value)}
          required
          rows={4}
          placeholder="Hi! Our pricing starts at ₹999/month. Visit example.com for details."
          className="resize-none placeholder:text-[#c0bed8] focus:outline-none"
          style={inputStyle}
          onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
          onBlur={e => (e.currentTarget.style.borderColor = "#e0ddf5")}
        />
        <p className="text-[11px] mt-1" style={{ color: "#b0aed0" }}>
          You can use <code className="px-1 rounded" style={{ background: "#ede9fe", color: "#7c3aed" }}>{"{customer_name}"}</code> and <code className="px-1 rounded" style={{ background: "#ede9fe", color: "#7c3aed" }}>{"{customer_phone}"}</code> as variables.
        </p>
      </div>

      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={matchExact}
          onChange={e => setMatchExact(e.target.checked)}
          className="accent-violet-500 w-4 h-4"
        />
        <div>
          <span className="text-sm font-medium" style={{ color: "#4b4880" }}>Exact match only</span>
          <p className="text-[11px]" style={{ color: "#9390b5" }}>
            Unchecked = triggers if message <em>contains</em> the keyword anywhere
          </p>
        </div>
      </label>

      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={onDone}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium"
          style={{ background: "#fff", color: "#9390b5", border: "1px solid #e0ddf5" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending || !keyword.trim() || !response.trim()}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}
        >
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
          Create Rule
        </button>
      </div>
    </form>
  );
}

/* ── Rule Row ────────────────────────────────────────────────────────────── */
function RuleRow({ rule }: { rule: ChatbotRule }) {
  const { mutateAsync: update } = useUpdateChatbotRule();
  const { mutateAsync: del, isPending: isDeleting } = useDeleteChatbotRule();
  const [editing,  setEditing]  = useState(false);
  const [keyword,  setKeyword]  = useState(rule.keyword);
  const [response, setResponse] = useState(rule.response);

  const handleSave = async () => {
    await update({ id: rule.id, payload: { keyword, response } });
    setEditing(false);
  };

  return (
    <div
      className="rounded-2xl p-4 transition-all"
      style={{
        background: rule.is_active ? "#ffffff" : "#fafafa",
        border: `1px solid ${rule.is_active ? "#ece9f8" : "#e8e8f0"}`,
        boxShadow: rule.is_active ? "0 1px 4px rgba(100,80,200,0.05)" : "none",
        opacity: rule.is_active ? 1 : 0.65,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Active toggle */}
        <button
          type="button"
          onClick={() => update({ id: rule.id, payload: { is_active: !rule.is_active } })}
          className="mt-0.5 flex-shrink-0"
          title={rule.is_active ? "Disable rule" : "Enable rule"}
        >
          {rule.is_active
            ? <ToggleRight className="h-6 w-6" style={{ color: "#10b981" }} />
            : <ToggleLeft  className="h-6 w-6" style={{ color: "#c0bed8" }} />}
        </button>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <div>
                <span style={{ ...labelStyle, marginBottom: "4px" }}>Keyword</span>
                <input
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  style={inputStyle}
                  className="focus:outline-none font-mono"
                />
              </div>
              <div>
                <span style={{ ...labelStyle, marginBottom: "4px" }}>Response</span>
                <textarea
                  value={response}
                  onChange={e => setResponse(e.target.value)}
                  rows={3}
                  className="resize-none focus:outline-none"
                  style={inputStyle}
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                  style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}
                >
                  <Check className="h-3.5 w-3.5" /> Save
                </button>
                <button
                  onClick={() => { setEditing(false); setKeyword(rule.keyword); setResponse(rule.response); }}
                  className="px-3 py-1.5 rounded-lg text-xs"
                  style={{ color: "#9390b5", background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Keyword + meta badges */}
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold"
                  style={{ background: "rgba(124,58,237,0.10)", color: "#7c3aed" }}
                >
                  <Zap className="h-3 w-3" />
                  {rule.keyword}
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                  style={{
                    background: rule.match_exact ? "rgba(79,70,229,0.08)" : "rgba(16,185,129,0.08)",
                    color: rule.match_exact ? "#4f46e5" : "#059669",
                    border: `1px solid ${rule.match_exact ? "rgba(79,70,229,0.2)" : "rgba(16,185,129,0.2)"}`,
                  }}
                >
                  {rule.match_exact ? "exact match" : "contains"}
                </span>
                <span className="text-[10px]" style={{ color: "#b0aed0" }}>
                  priority {rule.priority}
                </span>
              </div>

              {/* Response preview */}
              <div
                className="rounded-xl px-3 py-2 text-xs leading-relaxed"
                style={{ background: "#f5f4fb", color: "#4b4880", border: "1px solid #e0ddf5" }}
              >
                {rule.response}
              </div>
            </>
          )}
        </div>

        {/* Actions */}
        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
              style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(124,58,237,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}
            >
              <Pencil size={13} style={{ color: "#7c3aed" }} />
            </button>
            <button
              type="button"
              onClick={() => del(rule.id)}
              disabled={isDeleting}
              className="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-50 transition-colors"
              style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.08)")}
              onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}
            >
              {isDeleting
                ? <Loader2 size={13} className="animate-spin" style={{ color: "#f43f5e" }} />
                : <Trash2 size={13} style={{ color: "#f43f5e" }} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Page ────────────────────────────────────────────────────────────────── */
export default function ChatbotPage() {
  const { data: rules = [], isLoading } = useChatbotRules();
  const [showForm, setShowForm] = useState(false);

  const activeCount  = rules.filter(r => r.is_active).length;
  const totalCount   = rules.length;

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold" style={{ color: "#1a1040" }}>Chatbot Rules</p>
            {totalCount > 0 && (
              <span
                className="text-[11px] px-2 py-0.5 rounded-full font-semibold"
                style={{ background: activeCount > 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)", color: activeCount > 0 ? "#059669" : "#ef4444" }}
              >
                {activeCount}/{totalCount} active
              </span>
            )}
          </div>
          <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>
            When a customer sends a trigger keyword, the matching response is sent automatically.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          disabled={showForm}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}
        >
          <Plus size={14} /> New Rule
        </button>
      </div>

      {/* New Rule form */}
      {showForm && <RuleForm onDone={() => setShowForm(false)} />}

      {/* Rules list */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "#7c3aed" }} />
        </div>
      ) : rules.length === 0 && !showForm ? (
        <div
          className="flex flex-col items-center justify-center py-14 rounded-2xl gap-3"
          style={{ background: "#f9f8ff", border: "1.5px dashed #e0ddf5" }}
        >
          <Bot className="h-10 w-10" style={{ color: "#d4d0f0" }} />
          <p className="font-medium text-sm" style={{ color: "#9390b5" }}>No chatbot rules yet</p>
          <p className="text-xs text-center max-w-xs" style={{ color: "#b0aed0" }}>
            Create your first rule — when a customer sends a keyword, the chatbot replies automatically.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white mt-1"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 12px rgba(124,58,237,0.3)" }}
          >
            <Plus size={14} /> Create First Rule
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules
            .slice()
            .sort((a, b) => b.priority - a.priority)
            .map(r => <RuleRow key={r.id} rule={r} />)}
        </div>
      )}
    </div>
  );
}
