"use client";

import { useState, useEffect } from "react";
import {
  Wifi, WifiOff, Phone, CheckCircle2, AlertCircle,
  Loader2, Shield, Key, Hash, RefreshCw, Copy,
} from "lucide-react";
import { useWhatsAppAccount, useConnectWhatsApp, useDisconnectWhatsApp } from "@/hooks/use-whatsapp";

const STORAGE_KEY = "whatsapp-settings-draft";

type FormState = { waba_id: string; phone_number_id: string; access_token: string };

function readDraft(): FormState {
  if (typeof window === "undefined") return { waba_id: "", phone_number_id: "", access_token: "" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { waba_id: "", phone_number_id: "", access_token: "" };
    const p = JSON.parse(raw) as Partial<FormState>;
    return { waba_id: p.waba_id ?? "", phone_number_id: p.phone_number_id ?? "", access_token: p.access_token ?? "" };
  } catch { return { waba_id: "", phone_number_id: "", access_token: "" }; }
}

const inputStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1.5px solid rgba(255,255,255,0.09)",
  color: "white",
  borderRadius: "12px",
  padding: "10px 14px 10px 40px",
  width: "100%",
  fontSize: "14px",
  outline: "none",
} as const;

const labelStyle = {
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  color: "rgba(255,255,255,0.4)",
  marginBottom: "6px",
  display: "block",
};

export default function WhatsAppSettingsPage() {
  const { data: status, isLoading, refetch } = useWhatsAppAccount();
  const { mutateAsync: connect, isPending: isConnecting } = useConnectWhatsApp();
  const { mutateAsync: disconnect, isPending: isDisconnecting } = useDisconnectWhatsApp();

  const [form, setForm] = useState<FormState>(() => readDraft());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showToken, setShowToken] = useState(false);

  const account = status?.account;
  const connected = status?.connected;

  useEffect(() => {
    if (account) {
      setTimeout(() => setForm(f => ({ ...f, waba_id: account.waba_id ?? "", phone_number_id: account.phone_number_id ?? "" })), 0);
    }
  }, [status]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(form)); }, [form]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setSuccess(null);
    try {
      await connect(form);
      setSuccess("WhatsApp account connected successfully.");
      refetch();
    } catch (err: any) {
      setError(err?.response?.data?.detail ?? "Connection failed. Check your credentials.");
    }
  };

  const handleDisconnect = async () => {
    setError(null); setSuccess(null);
    try {
      await disconnect();
      setSuccess("WhatsApp account disconnected.");
      setForm({ waba_id: "", phone_number_id: "", access_token: "" });
      localStorage.removeItem(STORAGE_KEY);
      refetch();
    } catch { setError("Failed to disconnect."); }
  };

  const webhookUrl = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/webhook`;

  if (isLoading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#a78bfa" }} />
    </div>
  );

  return (
    <div className="space-y-6">

      {/* Status card */}
      <div
        className="rounded-2xl p-5 flex items-start gap-4"
        style={{
          background: connected
            ? "linear-gradient(135deg,rgba(16,185,129,0.12),rgba(5,150,105,0.06))"
            : "rgba(255,255,255,0.04)",
          border: `1px solid ${connected ? "rgba(16,185,129,0.3)" : "rgba(255,255,255,0.07)"}`,
        }}
      >
        <div className="flex items-center justify-center w-11 h-11 rounded-xl flex-shrink-0"
          style={{ background: connected ? "rgba(16,185,129,0.2)" : "rgba(255,255,255,0.06)" }}>
          {connected
            ? <Wifi className="h-5 w-5" style={{ color: "#10b981" }} />
            : <WifiOff className="h-5 w-5" style={{ color: "rgba(255,255,255,0.4)" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold text-white">{connected ? "Connected" : "Not Connected"}</p>
              <p className="text-sm mt-0.5" style={{ color: "rgba(255,255,255,0.4)" }}>{status?.message}</p>
            </div>
            <button type="button" onClick={() => refetch()}
              className="p-2 rounded-lg transition-colors" style={{ color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {account && (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[
                { icon: Phone, label: "Phone", value: account.display_phone_number ?? "—" },
                { icon: CheckCircle2, label: "Verified Name", value: account.verified_name ?? "—" },
                { icon: Hash, label: "WABA ID", value: account.waba_id },
                { icon: Shield, label: "Webhook", value: account.webhook_verified ? "✓ Verified" : "Pending" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-start gap-2">
                  <Icon className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }} />
                  <div>
                    <p className="text-[10px] uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.35)" }}>{label}</p>
                    <p className="text-sm font-medium text-white truncate">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
          <AlertCircle className="h-4 w-4 flex-shrink-0" />{error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2.5 rounded-xl px-4 py-3 text-sm"
          style={{ background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7" }}>
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />{success}
        </div>
      )}

      {/* Credentials form */}
      <div>
        <p className="text-white font-semibold mb-1">Meta Credentials</p>
        <p className="text-sm mb-4" style={{ color: "rgba(255,255,255,0.4)" }}>
          Enter your credentials from the{" "}
          <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer"
            className="underline" style={{ color: "#a78bfa" }}>
            Meta Developer Portal
          </a>.
        </p>

        <form onSubmit={handleConnect} className="space-y-4">
          {[
            { key: "waba_id", label: "WABA ID", placeholder: "123456789012345", icon: Hash, type: "text" },
            { key: "phone_number_id", label: "Phone Number ID", placeholder: "987654321098765", icon: Phone, type: "text" },
          ].map(({ key, label, placeholder, icon: Icon, type }) => (
            <div key={key}>
              <span style={labelStyle}>{label}</span>
              <div className="relative">
                <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "rgba(255,255,255,0.3)" }} />
                <input type={type} placeholder={placeholder} value={(form as any)[key]} required
                  onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  style={inputStyle}
                  className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none"
                  onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
                  onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")} />
              </div>
            </div>
          ))}

          {/* Access token with show/hide */}
          <div>
            <span style={labelStyle}>Access Token</span>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                style={{ color: "rgba(255,255,255,0.3)" }} />
              <input type={showToken ? "text" : "password"} placeholder="EAAxxxxx…"
                value={form.access_token} required
                onChange={e => setForm(f => ({ ...f, access_token: e.target.value }))}
                style={{ ...inputStyle, paddingRight: "80px" }}
                className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none"
                onFocus={e => (e.currentTarget.style.borderColor = "rgba(124,58,237,0.5)")}
                onBlur={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)")} />
              <button type="button" onClick={() => setShowToken(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium"
                style={{ color: "#a78bfa" }}>
                {showToken ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={isConnecting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}>
              {isConnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {connected ? "Update Connection" : "Connect WhatsApp"}
            </button>
            {connected && (
              <button type="button" onClick={handleDisconnect} disabled={isDisconnecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-60"
                style={{ background: "rgba(239,68,68,0.15)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.3)" }}>
                {isDisconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
                Disconnect
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Webhook info */}
      <div className="rounded-2xl p-5 space-y-3"
        style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
        <p className="text-white font-semibold">Webhook Configuration</p>
        <p className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          Set these values in your Meta App Dashboard under Webhooks.
        </p>
        <div className="space-y-2">
          {[
            { label: "Callback URL", value: webhookUrl },
            { label: "Verify Token", value: "Set in .env → META_VERIFY_TOKEN" },
            { label: "Subscribe Fields", value: "messages, message_status_updates" },
          ].map(({ label, value }) => (
            <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1">
              <span className="text-xs w-36 flex-shrink-0" style={{ color: "rgba(255,255,255,0.4)" }}>{label}:</span>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <code className="text-xs px-3 py-1.5 rounded-lg flex-1 truncate font-mono"
                  style={{ background: "rgba(255,255,255,0.06)", color: "#a78bfa", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {value}
                </code>
                {label === "Callback URL" && (
                  <button type="button" onClick={() => navigator.clipboard.writeText(value)}
                    className="flex-shrink-0 p-1.5 rounded-lg transition-colors"
                    style={{ color: "rgba(255,255,255,0.4)" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    title="Copy">
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
