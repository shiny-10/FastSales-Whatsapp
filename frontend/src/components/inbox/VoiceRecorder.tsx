"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Mic, Trash2, Send, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";

/* ── Detect best supported MIME type ───────────────────────────────────── */
function getSupportedMimeType(): string {
  // Meta WhatsApp accepts: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg
  // Prefer ogg/opus as it's widely supported and accepted by Meta
  const types = [
    "audio/ogg;codecs=opus",
    "audio/ogg",
    "audio/mp4",
    "audio/webm;codecs=opus",
    "audio/webm",
    "",
  ];
  for (const type of types) {
    try {
      if (!type || MediaRecorder.isTypeSupported(type)) return type;
    } catch { continue; }
  }
  return "";
}

interface VoiceRecorderProps {
  conversationId: string;
  onSent: (message: Message) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ conversationId, onSent, onCancel }: VoiceRecorderProps) {
  const [phase, setPhase] = useState<"recording" | "preview">("recording");
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const mediaRef   = useRef<MediaRecorder | null>(null);
  const chunksRef  = useRef<Blob[]>([]);
  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef  = useRef<MediaStream | null>(null);

  /* start recording immediately on mount */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const options = mimeType ? { mimeType } : {};
      const mr = new MediaRecorder(stream, options);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const recordedMime = mimeType || "audio/webm";
        const b = new Blob(chunksRef.current, { type: recordedMime });
        setBlob(b);
        setPhase("preview");
        stream.getTracks().forEach((t) => t.stop());
      };

      mr.start(100); // collect data every 100ms
      mediaRef.current = mr;
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch (err) {
      setError("Microphone permission denied");
      setTimeout(onCancel, 1500);
    }
  }, [onCancel]);

  useEffect(() => {
    const t = setTimeout(startRecording, 0);
    return () => {
      clearTimeout(t);
      if (timerRef.current) clearInterval(timerRef.current);
      // Clean up stream if component unmounts mid-recording
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [startRecording]);

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRef.current?.stop();
  };

  const handleSend = async () => {
    if (!blob) return;
    setSending(true);
    try {
      const mimeType = blob.type || "audio/ogg";
      // Map to Meta-accepted format
      let ext = "ogg";
      let sendMime = "audio/ogg";
      if (mimeType.includes("mp4")) { ext = "mp4"; sendMime = "audio/mp4"; }
      else if (mimeType.includes("mpeg") || mimeType.includes("mp3")) { ext = "mp3"; sendMime = "audio/mpeg"; }
      else if (mimeType.includes("aac")) { ext = "aac"; sendMime = "audio/aac"; }
      else if (mimeType.includes("amr")) { ext = "amr"; sendMime = "audio/amr"; }
      // For webm, try sending as ogg since Meta doesn't support webm audio directly
      else if (mimeType.includes("webm")) { ext = "ogg"; sendMime = "audio/ogg"; }

      const sendBlob = new Blob([blob], { type: sendMime });
      const form = new FormData();
      form.append("file", sendBlob, `voice.${ext}`);
      form.append("conversation_id", conversationId);
      form.append("message_type", "AUDIO");
      const { data } = await api.post("/api/messages/send/media-upload", form);
      onSent(data as Message);
    } catch (err: any) {
      const detail = err?.response?.data?.detail ?? err?.message ?? "Failed to send voice note";
      console.error("Voice send error:", err?.response?.data ?? err);
      setError(detail);
      setSending(false);
    }
  };

  const handleDelete = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    onCancel();
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (error) {
    return (
      <div className="flex items-center gap-2 flex-1 px-3 py-2 rounded-2xl text-sm"
        style={{ background: "#fff1f2", color: "#f43f5e" }}>
        {error}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1">

      {/* Delete / Cancel */}
      <button
        type="button"
        onClick={handleDelete}
        className="flex items-center justify-center w-9 h-9 rounded-xl flex-shrink-0 transition-colors"
        style={{ background: "#f5f6fa", color: "#f43f5e" }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(239,68,68,0.1)")}
        onMouseLeave={e => (e.currentTarget.style.background = "#f5f6fa")}
        title="Delete"
      >
        <Trash2 className="h-4 w-4" />
      </button>

      {/* Timer + waveform bar */}
      <div
        className="flex items-center gap-2 flex-1 rounded-2xl px-3 py-2"
        style={{ background: "#f5f6fa", border: "1.5px solid #e8eaf0" }}
      >
        {/* Recording dot */}
        {phase === "recording" && (
          <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" style={{ background: "#f43f5e" }} />
        )}
        {phase === "preview" && (
          <Mic className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "#7c3aed" }} />
        )}

        {/* Timer */}
        <span className="text-sm font-mono font-medium" style={{ color: "#1a1d23" }}>
          {fmt(seconds)}
        </span>

        {/* Waveform bars (animated when recording) */}
        <div className="flex items-end gap-0.5 flex-1 h-5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className={phase === "recording" ? "animate-pulse" : ""}
              style={{
                flex: 1,
                borderRadius: "2px",
                background: phase === "recording" ? "#7c3aed" : "#c0c3d6",
                height: `${20 + Math.sin(i * 0.8) * 14}%`,
                minHeight: "3px",
                animationDelay: `${i * 50}ms`,
                animationDuration: "600ms",
              }}
            />
          ))}
        </div>

        {/* Status text */}
        <span className="text-[11px] flex-shrink-0 font-medium"
          style={{ color: phase === "recording" ? "#f43f5e" : "#9498b0" }}>
          {phase === "recording" ? "Recording…" : "Ready"}
        </span>
      </div>

      {/* Stop (while recording) or Send (after stop) */}
      {phase === "recording" ? (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all"
          style={{ background: "rgba(239,68,68,0.12)", color: "#f43f5e", border: "1.5px solid rgba(239,68,68,0.3)" }}
          title="Stop recording"
        >
          <span className="w-3.5 h-3.5 rounded-sm" style={{ background: "#f43f5e", display: "block" }} />
        </button>
      ) : (
        <button
          type="button"
          onClick={handleSend}
          disabled={sending}
          className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all disabled:opacity-60"
          style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "#ffffff", boxShadow: "0 4px 14px rgba(124,58,237,0.4)" }}
          title="Send voice note"
        >
          {sending
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />}
        </button>
      )}
    </div>
  );
}

/* ── Mic button shown in composer when not recording ─────────────────── */
export function VoiceMicButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0 transition-all"
      style={{
        background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
        color: "#ffffff",
        boxShadow: "0 4px 14px rgba(124,58,237,0.4)",
      }}
      title="Record voice note"
    >
      <Mic className="h-4 w-4" />
    </button>
  );
}
