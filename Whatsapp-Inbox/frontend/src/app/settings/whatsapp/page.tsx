"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "whatsapp-settings-draft";

type WhatsAppFormState = {
  waba_id: string;
  phone_number_id: string;
  access_token: string;
};

function readDraft(): WhatsAppFormState {
  if (typeof window === "undefined") {
    return { waba_id: "", phone_number_id: "", access_token: "" };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { waba_id: "", phone_number_id: "", access_token: "" };
    }
    const parsed = JSON.parse(raw) as Partial<WhatsAppFormState>;
    return {
      waba_id: parsed.waba_id ?? "",
      phone_number_id: parsed.phone_number_id ?? "",
      access_token: parsed.access_token ?? "",
    };
  } catch {
    return { waba_id: "", phone_number_id: "", access_token: "" };
  }
}
import { motion } from "framer-motion";
import {
  Wifi,
  WifiOff,
  Phone,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Key,
  Hash,
  RefreshCw,
} from "lucide-react";
import {
  useWhatsAppAccount,
  useConnectWhatsApp,
  useDisconnectWhatsApp,
} from "@/features/messaging/use-whatsapp";
import { Button } from "@/shared/components/button";
import { Input } from "@/shared/components/input";
import { cn } from "@/shared/lib/utils";

export default function WhatsAppSettingsPage() {
  const { data: status, isLoading, refetch } = useWhatsAppAccount();
  const { mutateAsync: connect, isPending: isConnecting } = useConnectWhatsApp();
  const { mutateAsync: disconnect, isPending: isDisconnecting } = useDisconnectWhatsApp();

  const [form, setForm] = useState<WhatsAppFormState>(() => readDraft());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status?.account) {
      const next = {
        waba_id: status.account.waba_id ?? "",
        phone_number_id: status.account.phone_number_id ?? "",
        access_token: form.access_token,
      };
      setForm(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    }
  }, [status]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await connect(form);
      setSuccess("WhatsApp account connected successfully!");
      setForm((prev) => ({
        ...prev,
        access_token: "",
      }));
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          waba_id: form.waba_id,
          phone_number_id: form.phone_number_id,
          access_token: "",
        })
      );
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Connection failed. Check your credentials.");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure you want to disconnect your WhatsApp account?")) return;
    setError(null);
    try {
      await disconnect();
      setSuccess("Disconnected successfully.");
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Failed to disconnect.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
      </div>
    );
  }

  const account = status?.account;
  const connected = status?.connected;

  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold">WhatsApp Configuration</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Connect your Meta WhatsApp Business account to start receiving messages.
        </p>
      </div>

      {/* Status Card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "rounded-2xl border p-5 flex items-start gap-4",
          connected
            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10"
            : "border-border bg-card"
        )}
      >
        <div
          className={cn(
            "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
            connected ? "bg-green-100 dark:bg-green-800/30" : "bg-muted"
          )}
        >
          {connected ? (
            <Wifi className="h-5 w-5 text-green-600 dark:text-green-400" />
          ) : (
            <WifiOff className="h-5 w-5 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="font-semibold text-base">
                {connected ? "Connected" : "Not Connected"}
              </h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {status?.message}
              </p>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              className="shrink-0"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {account && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <DetailItem
                icon={<Phone className="h-3.5 w-3.5" />}
                label="Phone Number"
                value={account.display_phone_number ?? "—"}
              />
              <DetailItem
                icon={<CheckCircle2 className="h-3.5 w-3.5" />}
                label="Verified Name"
                value={account.verified_name ?? "—"}
              />
              <DetailItem
                icon={<Hash className="h-3.5 w-3.5" />}
                label="WABA ID"
                value={account.waba_id}
              />
              <DetailItem
                icon={<Shield className="h-3.5 w-3.5" />}
                label="Webhook"
                value={account.webhook_verified ? "Verified" : "Pending"}
              />
            </div>
          )}
        </div>
      </motion.div>

      {/* Feedback messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-green-300 bg-green-50 dark:bg-green-900/20 px-4 py-3 text-sm text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {success}
        </div>
      )}

      {/* Connection Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border bg-card p-6 space-y-4"
      >
        <h2 className="font-semibold text-base">Meta Credentials</h2>
        <p className="text-sm text-muted-foreground">
          Enter your WhatsApp Business API credentials from the{" "}
          <a
            href="https://developers.facebook.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 hover:underline"
          >
            Meta Developer Portal
          </a>
          .
        </p>

        <form onSubmit={handleConnect} className="space-y-4">
          <FormField
            label="WhatsApp Business Account ID (WABA ID)"
            placeholder="123456789012345"
            value={form.waba_id}
            onChange={(v) => setForm((f) => ({ ...f, waba_id: v }))}
            icon={<Hash className="h-4 w-4" />}
          />
          <FormField
            label="Phone Number ID"
            placeholder="987654321098765"
            value={form.phone_number_id}
            onChange={(v) => setForm((f) => ({ ...f, phone_number_id: v }))}
            icon={<Phone className="h-4 w-4" />}
          />
          <FormField
            label="Access Token"
            placeholder="EAAxxxxx…"
            value={form.access_token}
            onChange={(v) => setForm((f) => ({ ...f, access_token: v }))}
            icon={<Key className="h-4 w-4" />}
            type="password"
          />

          <div className="flex items-center gap-3 pt-2">
            <Button type="submit" disabled={isConnecting} className="gap-2">
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {connected ? "Update Connection" : "Connect WhatsApp"}
            </Button>

            {connected && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                className="gap-2"
              >
                {isDisconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                Disconnect
              </Button>
            )}
          </div>
        </form>
      </motion.div>

      {/* Webhook Info */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border bg-card p-6 space-y-3"
      >
        <h2 className="font-semibold text-base">Webhook Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure the following in your Meta App Dashboard:
        </p>
        <div className="space-y-2">
          <WebhookRow label="Callback URL" value={`${process.env.NEXT_PUBLIC_API_URL ?? "https://your-api.com"}/webhooks/meta`} />
          <WebhookRow label="Verify Token" value="(Set in backend .env: META_VERIFY_TOKEN)" />
          <WebhookRow label="Subscribed Fields" value="messages, message_status_updates, message_reactions" />
        </div>
      </motion.div>
    </div>
  );
}

function DetailItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

function FormField({
  label,
  placeholder,
  value,
  onChange,
  icon,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  icon: React.ReactNode;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        <Input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="pl-9"
          required
        />
      </div>
    </div>
  );
}

function WebhookRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-1 text-sm">
      <span className="text-muted-foreground w-40 shrink-0">{label}:</span>
      <code className="text-xs bg-muted rounded-lg px-2 py-1 break-all font-mono">
        {value}
      </code>
    </div>
  );
}
