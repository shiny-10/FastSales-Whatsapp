"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, Film, Music, Play, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSignedMediaUrl } from "@/hooks/use-media";
import type { MediaFile, MessageType } from "@/lib/types";

interface MediaViewerProps {
  mediaFiles: MediaFile[];
  messageType: MessageType;
  className?: string;
}

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function MediaViewer({ mediaFiles, messageType, className }: MediaViewerProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const file = mediaFiles[0];
  const fileId = file?.id ?? null;
  const { data: signedMedia } = useSignedMediaUrl(fileId, file?.file_url);

  // Resolve playable/downloadable URL
  const url: string | undefined =
    file?.file_url || signedMedia?.signed_url;

  if (mediaFiles.length === 0) return null;

  /* ── IMAGE ────────────────────────────────────────────────────────────── */
  if (messageType === "IMAGE") {
    if (!url) return (
      <div className="flex items-center gap-2 rounded-3xl px-3 py-2"
        style={{ background: "#f3f4f6" }}>
        <Film className="h-5 w-5" style={{ color: "#6b7280" }} />
        <span className="text-xs font-medium" style={{ color: "#374151" }}>
          {file.file_name ?? "Photo"}
        </span>
      </div>
    );
    return (
      <>
        <button onClick={() => setLightboxOpen(true)}
          className={cn("relative overflow-hidden rounded-3xl shadow-sm", className)}
          style={{ width: "240px", minHeight: "180px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={file.file_name ?? "image"}
            className="w-full h-full object-cover" />
        </button>
        <AnimatePresence>
          {lightboxOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightboxOpen(false)}>
              <motion.img initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
                src={url} alt={file.file_name ?? "image"}
                className="max-h-screen max-w-screen object-contain rounded-3xl"
                onClick={(e) => e.stopPropagation()} />
              <Button size="icon" variant="ghost"
                className="absolute top-4 right-4 text-white hover:text-white hover:bg-white/20"
                onClick={() => setLightboxOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  /* ── VIDEO ────────────────────────────────────────────────────────────── */
  if (messageType === "VIDEO") {
    if (!url) return (
      <div className="flex items-center gap-3 rounded-3xl px-3 py-3"
        style={{ background: "#f3f4f6", minWidth: "200px" }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200">
          <Play className="h-4 w-4" style={{ color: "#111827" }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "#111827" }}>
            {file.file_name ?? "Video"}
          </p>
          {file.file_size && (
            <p className="text-[10px] text-slate-500">{formatSize(file.file_size)}</p>
          )}
        </div>
      </div>
    );
    return (
      <div className={cn("relative overflow-hidden rounded-3xl shadow-sm bg-slate-950/5", className)}
        style={{ width: "240px", minHeight: "180px" }}>
        <video controls className="w-full h-full block object-cover" src={url}>
          <track kind="captions" />
        </video>
      </div>
    );
  }

  /* ── AUDIO / Voice note ───────────────────────────────────────────────── */
  if (messageType === "AUDIO") {
    return (
      <div className={cn("flex items-center gap-3 rounded-full px-3 py-3 shadow-sm", className)}
        style={{ minWidth: "190px", background: "#f8fafc", border: "1px solid #e5e7eb" }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white border border-slate-200">
          <Mic className="h-5 w-5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          {url ? (
            <audio controls className="w-full" style={{ accentColor: "#3b82f6" }}>
              <source src={url} />
            </audio>
          ) : (
            <div className="flex items-end gap-1 h-6">
              {Array.from({ length: 18 }).map((_, i) => (
                <div key={i} style={{
                  flex: 1,
                  borderRadius: "999px",
                  background: "#d1d5db",
                  height: `${18 - (i % 3) * 4}%`,
                }} />
              ))}
            </div>
          )}
          {file.file_size && (
            <p className="text-[10px] mt-2 text-slate-500">
              {formatSize(file.file_size)} · Voice note
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── DOCUMENT ─────────────────────────────────────────────────────────── */
  if (messageType === "DOCUMENT") {
    const inner = (
      <div className={cn("flex items-center gap-3 rounded-3xl px-4 py-3 bg-white shadow-sm", className)}
        style={{ minWidth: "220px", border: "1px solid #e5e7eb" }}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
          <FileText className="h-5 w-5 text-slate-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#111827" }}>
            {file.file_name ?? "Document"}
          </p>
          {file.file_size && (
            <p className="text-[11px] mt-1 text-slate-500">
              {formatSize(file.file_size)}
            </p>
          )}
        </div>
        {url && (
          <Download className="h-4 w-4 shrink-0 text-slate-500" />
        )}
      </div>
    );

    if (url) {
      return (
        <a href={url} download={file.file_name} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()} style={{ textDecoration: "none", display: "block" }}>
          {inner}
        </a>
      );
    }
    return inner;
  }

  return null;
}
