"use client";

import { useRef, useState } from "react";
import { Paperclip, Image, Film, FileText, Music, Loader2 } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Message } from "@/lib/types";

interface MediaUploadButtonProps {
  conversationId: string;
  onSent?: (message: Message) => void;
}

type MediaCategory = "image" | "video" | "audio" | "document";

const ACCEPT_MAP: Record<MediaCategory, string> = {
  image: "image/jpeg,image/png,image/webp,image/gif",
  video: "video/mp4,video/3gpp",
  audio: "audio/mpeg,audio/ogg,audio/opus,audio/aac",
  document: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain",
};

const MENU_ITEMS: Array<{ type: MediaCategory; icon: React.ReactNode; label: string }> = [
  { type: "image",    icon: <Image className="h-4 w-4" />,    label: "Image" },
  { type: "video",    icon: <Film className="h-4 w-4" />,     label: "Video" },
  { type: "audio",    icon: <Music className="h-4 w-4" />,    label: "Audio" },
  { type: "document", icon: <FileText className="h-4 w-4" />, label: "Document" },
];

export function MediaUploadButton({ conversationId, onSent }: MediaUploadButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingType, setPendingType] = useState<MediaCategory | null>(null);
  const [open, setOpen] = useState(false);

  const triggerFilePicker = (type: MediaCategory) => {
    setPendingType(type);
    setOpen(false);
    // Small delay so popover closes before dialog opens
    setTimeout(() => fileInputRef.current?.click(), 80);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !pendingType) return;

    setUploading(true);
    try {
      // Upload to our backend which proxies to S3 / Meta
      const form = new FormData();
      form.append("file", file);
      form.append("conversation_id", conversationId);
      form.append("message_type", pendingType.toUpperCase());

      const { data } = await api.post(
        "/api/messages/send/media-upload",
        form
      );
      onSent?.(data as Message);
    } catch (err) {
      console.error("Media upload failed:", err);
    } finally {
      setUploading(false);
      setPendingType(null);
      // Reset so same file can be picked again
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept={pendingType ? ACCEPT_MAP[pendingType] : "*"}
        onChange={handleFileChange}
      />

      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className={cn(
              "h-8 w-8 shrink-0 transition-colors",
              uploading
                ? "text-brand-600 cursor-not-allowed"
                : "text-muted-foreground hover:text-foreground"
            )}
            disabled={uploading}
            title="Attach media"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </Button>
        </Popover.Trigger>

        <Popover.Portal>
          <Popover.Content
            side="top"
            align="start"
            sideOffset={8}
            className="z-50 w-44 rounded-2xl border bg-popover p-1.5 shadow-xl animate-in fade-in-0 zoom-in-95"
          >
            {MENU_ITEMS.map(({ type, icon, label }) => (
              <button
                key={type}
                onClick={() => triggerFilePicker(type)}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm hover:bg-accent transition-colors"
              >
                <span className="text-muted-foreground">{icon}</span>
                {label}
              </button>
            ))}
            <Popover.Arrow className="fill-popover" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </>
  );
}
