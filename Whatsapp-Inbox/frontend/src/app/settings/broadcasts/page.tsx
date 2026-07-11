"use client";

import { useState } from "react";
import { Plus, Send, Trash2, Loader2, Users, Calendar, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Button } from "@/shared/components/button";
import {
  useBroadcasts, useCreateBroadcast, useUpdateBroadcast,
  useDeleteBroadcast, useSendBroadcast, type Broadcast,
} from "@/features/messaging/use-broadcasts";

const STATUS_ICON: Record<string, React.ReactNode> = {
  DRAFT: <Clock className="h-3.5 w-3.5 text-gray-400" />,
  SCHEDULED: <Calendar className="h-3.5 w-3.5 text-blue-500" />,
  SENDING: <Loader2 className="h-3.5 w-3.5 text-yellow-500 animate-spin" />,
  DONE: <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />,
  FAILED: <XCircle className="h-3.5 w-3.5 text-red-500" />,
};

function BroadcastForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [recipientsRaw, setRecipientsRaw] = useState("");
  const { mutateAsync: create, isPending } = useCreateBroadcast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const recipients = recipientsRaw.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    if (!name || !message || !recipients.length) return;
    await create({ name, message, recipients });
    onDone();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="font-semibold text-sm">New Broadcast</h3>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} required
          className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none" placeholder="e.g. Promo July" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Message</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} required rows={3}
          className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none resize-none" placeholder="Hello {{name}}, …" />
      </div>
      <div>
        <label className="block text-xs font-medium mb-1 text-muted-foreground">Recipients (phone numbers, comma or newline separated)</label>
        <textarea value={recipientsRaw} onChange={(e) => setRecipientsRaw(e.target.value)} required rows={3}
          className="w-full bg-muted rounded-xl px-3 py-2 text-sm focus:outline-none resize-none font-mono" placeholder="+1234567890&#10;+0987654321" />
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

function BroadcastRow({ b }: { b: Broadcast }) {
  const { mutateAsync: send, isPending: isSending } = useSendBroadcast();
  const { mutateAsync: del, isPending: isDeleting } = useDeleteBroadcast();
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    try {
      await send(b.id);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? "Send failed. Check your WhatsApp connection.");
    }
  };

  return (
    <div className="rounded-2xl border bg-card p-4 flex flex-col gap-2">
      {error && (
        <div className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-xl px-3 py-2">{error}</div>
      )}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {STATUS_ICON[b.status]}
            <span className="font-medium text-sm truncate">{b.name}</span>
            <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground bg-muted rounded-full px-2 py-0.5">{b.status}</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{b.message}</p>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3 w-3" />{b.recipients.length} recipients</span>
            {b.sent_count > 0 && <span className="text-green-600">✓ {b.sent_count} sent</span>}
            {b.failed_count > 0 && <span className="text-red-500">✗ {b.failed_count} failed</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {(b.status === "DRAFT" || b.status === "FAILED") && (
            <Button size="sm" variant="ghost" onClick={handleSend} disabled={isSending} className="gap-1 text-xs">
              {isSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Send
            </Button>
          )}
          <Button size="icon" variant="ghost" onClick={() => del(b.id)} disabled={isDeleting} className="h-8 w-8 text-muted-foreground hover:text-red-500">
            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function BroadcastsPage() {
  const { data: broadcasts = [], isLoading } = useBroadcasts();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Broadcasts</h1>
          <p className="text-muted-foreground text-sm mt-1">Send bulk messages to multiple contacts at once.</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="gap-2" disabled={showForm}>
          <Plus className="h-4 w-4" /> New Broadcast
        </Button>
      </div>

      {showForm && <BroadcastForm onDone={() => setShowForm(false)} />}

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : broadcasts.length === 0 && !showForm ? (
        <div className="text-center py-16 text-muted-foreground text-sm">No broadcasts yet. Create one to get started.</div>
      ) : (
        <div className="space-y-3">
          {broadcasts.map((b) => <BroadcastRow key={b.id} b={b} />)}
        </div>
      )}
    </div>
  );
}
