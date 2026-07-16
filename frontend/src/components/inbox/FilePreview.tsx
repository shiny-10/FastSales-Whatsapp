"use client";

import { useEffect, useState } from "react";
import { X, Send, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import type { Message } from "@/lib/types";

interface FilePreviewProps {
  file: File;
  mediaType: "image" | "video" | "audio" | "document";
  conversationId: string;
  onSent: (message: Message) => void;
  onCancel: () => void;
}

export function FilePreview({ file, mediaType, conversationId, onSent, onCancel }: FilePreviewProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (mediaType === "image" || mediaType === "video") {
      const url = URL.createObjectURL(file);
      // defer setting state to avoid setState-in-effect lint rule
      const t = setTimeout(() => setObjectUrl(url), 0);
      return () => { clearTimeout(t); URL.revokeObjectURL(url); };
    }
  }, [file, mediaType]);

  const handleSend = async () => {
    setSending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("conversation_id", conversationId);
      form.append("message_type", mediaType.toUpperCase());
      if (caption) form.append("caption", caption);
      const { data } = await api.post("/api/messages/send/media-upload", form);
      onSent(data as Message);
    } catch (e) {
      console.error("File send failed", e);
    } finally {
      setSending(false);
    }
  };

  const sizeMB = (file.size / 1024 / 1024).toFixed(1);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#202c33] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        {/* Preview area */}
        <div className="relative bg-black/10 dark:bg-black/30 flex items-center justify-center min-h-48">
          {mediaType === "image" && objectUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={objectUrl} alt="preview" className="max-h-72 max-w-full object-contain" />
          )}
          {mediaType === "video" && objectUrl && (
            <video src={objectUrl} controls className="max-h-72 max-w-full" />
          )}
          {(mediaType === "document" || mediaType === "audio") && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-500 dark:text-gray-400">
              <FileText className="h-12 w-12" />
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200 max-w-48 truncate">{file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sizeMB} MB</p>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={onCancel}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/40 flex items-center justify-center text-white hover:bg-black/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Caption + send */}
        <div className="p-4 space-y-3">
          {(mediaType === "image" || mediaType === "video" || mediaType === "document") && (
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a caption…"
              className="w-full bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none placeholder:text-gray-400"
            />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onCancel} className="flex-1">Cancel</Button>
            <Button
              onClick={handleSend}
              disabled={sending}
              className="flex-1 bg-[#00a884] hover:bg-[#00956f] text-white gap-2"
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
