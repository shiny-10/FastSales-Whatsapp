"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Pencil, Check, X, ToggleLeft, ToggleRight, Zap } from "lucide-react";
import { Button } from "@/shared/components/button";
import {
  useChatbotRules, useCreateChatbotRule, useUpdateChatbotRule,
  useDeleteChatbotRule, type ChatbotRule,
} from "@/features/messaging/use-chatbot-rules";

function RuleForm({ onDone }: { onDone: () => void }) {
  const [keyword, setKeyword] = useState("");
  const [response, setResponse] = useState("");
  const [matchExact, setMatchExact] = useState(false);
  const [priority, setPriority] = useState(0);
  const { mutateAsync: create, isPending } = useCreateChatbotRule();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await create({ keyword, response, match_exact: matchExact, priority, is_active: true });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">New Chatbot Rule</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1 text-muted-foreground">Keyword / Trigger</label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} required
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="e.g. price, help, hours" />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1 text-muted-foreground">Priority (higher = first)</label>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Response</label>
        <textarea value={response} onChange={(e) => setResponse(e.target.value)} required rows={3}
          className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" placeholder="Our pricing starts at…" />
      </div>
      <label className="flex items-center gap-2 cursor-pointer select-none">
        <input type="checkbox" checked={matchExact} onChange={(e) => setMatchExact(e.target.checked)} className="rounded" />
        <span className="text-sm">Exact match only (otherwise: contains)</span>
      </label>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onDone} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={isPending} className="flex-1 gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create
        </Button>
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

  const handleSave = async () => {
    await update({ id: rule.id, payload: { keyword, response } });
    setEditing(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => update({ id: rule.id, payload: { is_active: !rule.is_active } })}
          className="mt-0.5 shrink-0">
          {rule.is_active
            ? <ToggleRight className="h-5 w-5 text-green-500" />
            : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input value={keyword} onChange={(e) => setKeyword(e.target.value)}
                className="w-full bg-muted rounded-xl px-3 py-1.5 text-sm focus:outline-none font-mono" />
              <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={2}
                className="w-full bg-muted rounded-xl px-3 py-1.5 text-sm focus:outline-none resize-none" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} className="gap-1"><Check className="h-3.5 w-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setKeyword(rule.keyword); setResponse(rule.response); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300 rounded-lg px-2 py-0.5">
                  <Zap className="h-3 w-3" />{rule.keyword}
                </span>
                {rule.match_exact && (
                  <span className="text-[10px] bg-muted text-muted-foreground rounded-full px-2 py-0.5">exact</span>
                )}
                <span className="text-[10px] text-muted-foreground">priority: {rule.priority}</span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{rule.response}</p>
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} className="h-8 w-8">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => del(rule.id)} disabled={isDeleting}
              className="h-8 w-8 text-muted-foreground hover:text-red-500">
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
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
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chatbot Rules</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Keyword-triggered auto-responses. Higher priority rules match first.
          </p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2" disabled={showForm}>
          <Plus className="h-4 w-4" /> New Rule
        </Button>
      </div>

      {showForm && <RuleForm onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : rules.length === 0 && !showForm ? (
        <div className="text-center py-16 text-muted-foreground text-sm">
          No chatbot rules yet. Add a keyword trigger to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => <RuleRow key={rule.id} rule={rule} />)}
        </div>
      )}
    </div>
  );
}
