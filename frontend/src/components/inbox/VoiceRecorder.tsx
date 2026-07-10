"use client";

import { useRef, useState, useEffect } from "react";
import { Mic, Square, Send, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

interface VoiceRecorderProps {
  conversationId: string;
  onSent: (message: Message) => void;
  onCancel: () => void;
}

export function VoiceRecorder({ conversationId, onSent, onCancel }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [sending, setSending] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    startRecording();
    return () => stopTimer();
  }, []);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => chunksRef.current.push(e.data);
      mr.onstop = () => {
        const b = new Blob(chunksRef.current, { type: "audio/webm" });
        setBlob(b);
        stream.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } catch {
      onCancel();
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
    stopTimer();
  };

  const handleSend = async () => {
    if (!blob) return;
    setSending(true);
    try {
      const form = new FormData();
      form.append("file", blob, "voice.webm");
      form.append("conversation_id", conversationId);
      form.append("message_type", "AUDIO");
      const { data } = await api.post("/api/messages/send/media-upload", form);
      onSent(data as Message);
    } catch (e) {
      console.error("Voice send failed", e);
    } finally {
      setSending(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="flex items-center gap-3 bg-white dark:bg-[#2a3942] rounded-2xl px-4 py-2.5 shadow-sm flex-1">
      <button type="button" onClick={onCancel} className="text-gray-400 hover:text-red-500 transition-colors">
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-center gap-2 flex-1">
        {recording && (
          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
        )}
        <span className="text-sm font-mono text-gray-600 dark:text-gray-300">{fmt(seconds)}</span>
        {!recording && blob && (
          <span className="text-xs text-gray-400">Ready to send</span>
        )}
      </div>

      {recording ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={stopRecording}
          className="h-8 w-8 text-red-500 hover:text-red-600"
        >
          <Square className="h-4 w-4 fill-current" />
        </Button>
      ) : (
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!blob || sending}
          className="h-8 w-8 rounded-full bg-[#00a884] hover:bg-[#00956f] text-white border-0"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}

export function VoiceMicButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      onClick={onClick}
      className="h-9 w-9 shrink-0 rounded-full bg-[#00a884] hover:bg-[#00956f] text-white border-0"
      title="Record voice note"
    >
      <Mic className="h-4 w-4" />
    </Button>
  );
}
