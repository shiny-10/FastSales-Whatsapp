"use client";

import { useState } from "react";
import { Plus, Trash2, Loader2, Pencil, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useAutoReplies, useCreateAutoReply, useUpdateAutoReply,
  useDeleteAutoReply, type AutoReply,
} from "@/hooks/use-auto-replies";

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
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">New Auto Reply</h3>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="e.g. Welcome message" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={3}
          className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" placeholder="Hi! Thanks for reaching out…" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Delay (seconds)</label>
        <input type="number" min={0} value={delay} onChange={(e) => setDelay(Number(e.target.value))}
          className="w-32 bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none" />
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" onClick={onDone} className="flex-1">Cancel</Button>
        <Button type="submit" disabled={isPending} className="flex-1 gap-2">
          {isPending && <Loader2 className="h-4 w-4 animate-spin" />} Create
        </Button>
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

  const handleSave = async () => {
    await update({ id: item.id, payload: { name, message } });
    setEditing(false);
  };

  return (
    <div className="rounded-2xl border bg-card p-4 space-y-2">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => update({ id: item.id, payload: { is_active: !item.is_active } })}
          className="mt-0.5 shrink-0 text-muted-foreground hover:text-emerald-600 transition-colors">
          {item.is_active
            ? <ToggleRight className="h-5 w-5 text-emerald-500" />
            : <ToggleLeft className="h-5 w-5" />}
        </button>
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="w-full bg-muted rounded-xl px-3 py-1.5 text-sm focus:outline-none" />
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2}
                className="w-full bg-muted rounded-xl px-3 py-1.5 text-sm focus:outline-none resize-none" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleSave} className="gap-1"><Check className="h-3.5 w-3.5" /> Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setName(item.name); setMessage(item.message); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ) : (
            <>
              <p className="font-medium text-sm">{item.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.message}</p>
              {item.delay_seconds > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">Delay: {item.delay_seconds}s</p>
              )}
            </>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" onClick={() => setEditing(true)} className="h-8 w-8">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => del(item.id)} disabled={isDeleting}
              className="h-8 w-8 text-muted-foreground hover:text-red-500">
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </Button>
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
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auto Replies</h1>
          <p className="text-muted-foreground text-sm mt-1">Automatically respond to incoming messages when active.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2" disabled={showForm}>
          <Plus className="h-4 w-4" /> New Auto Reply
        </Button>
      </div>

      {showForm && <AutoReplyForm onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 && !showForm ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No auto replies yet.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => <AutoReplyRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
