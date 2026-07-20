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
  const { data: signedMedia } = useSignedMediaUrl(fileId);

  // Resolve playable/downloadable URL
  const url: string | undefined =
    signedMedia?.signed_url ||
    (file?.file_url && (file.file_url.startsWith("http://") || file.file_url.startsWith("https://"))
      ? file.file_url
      : undefined);

  if (mediaFiles.length === 0) return null;

  /* ── IMAGE ────────────────────────────────────────────────────────────── */
  if (messageType === "IMAGE") {
    if (!url) return (
      <div className="flex items-center gap-2 rounded-xl px-3 py-2"
        style={{ background: "rgba(255,255,255,0.15)" }}>
        <Film className="h-5 w-5" style={{ color: "rgba(255,255,255,0.7)" }} />
        <span className="text-xs" style={{ color: "rgba(255,255,255,0.7)" }}>
          {file.file_name ?? "Photo"}
        </span>
      </div>
    );
    return (
      <>
        <button onClick={() => setLightboxOpen(true)}
          className={cn("relative overflow-hidden rounded-xl max-w-xs", className)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={file.file_name ?? "image"}
            className="max-w-full max-h-72 object-cover rounded-xl" />
        </button>
        <AnimatePresence>
          {lightboxOpen && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightboxOpen(false)}>
              <motion.img initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                src={url} alt={file.file_name ?? "image"}
                className="max-h-screen max-w-screen object-contain rounded-xl"
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
      <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
        style={{ background: "rgba(255,255,255,0.15)", minWidth: "180px" }}>
        <div className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.25)" }}>
          <Play className="h-4 w-4" style={{ color: "#fff" }} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium truncate" style={{ color: "#fff" }}>
            {file.file_name ?? "Video"}
          </p>
          {file.file_size && (
            <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.6)" }}>{formatSize(file.file_size)}</p>
          )}
        </div>
      </div>
    );
    return (
      <div className={cn("rounded-xl overflow-hidden max-w-xs", className)}>
        <video controls className="max-w-full max-h-72 rounded-xl" src={url}>
          <track kind="captions" />
        </video>
      </div>
    );
  }

  /* ── AUDIO / Voice note ───────────────────────────────────────────────── */
  if (messageType === "AUDIO") {
    return (
      <div className={cn("flex items-center gap-3 rounded-2xl px-3 py-2.5", className)}
        style={{ minWidth: "200px", background: "rgba(255,255,255,0.15)" }}>
        {/* Mic icon */}
        <div className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.25)" }}>
          <Mic className="h-4 w-4" style={{ color: "#fff" }} />
        </div>
        <div className="flex-1 min-w-0">
          {url ? (
            <audio controls className="w-full h-7" style={{ accentColor: "#7c3aed" }}>
              <source src={url} />
            </audio>
          ) : (
            /* Waveform placeholder when no URL yet */
            <div className="flex items-end gap-0.5 h-6">
              {Array.from({ length: 22 }).map((_, i) => (
                <div key={i} style={{
                  flex: 1,
                  borderRadius: "2px",
                  background: "rgba(255,255,255,0.5)",
                  height: `${30 + Math.sin(i * 0.7) * 50}%`,
                  minHeight: "3px",
                }} />
              ))}
            </div>
          )}
          {file.file_size && (
            <p className="text-[10px] mt-0.5" style={{ color: "rgba(255,255,255,0.6)" }}>
              {formatSize(file.file_size)} · Voice note
            </p>
          )}
        </div>
      </div>
    );
  }

  /* ── DOCUMENT ─────────────────────────────────────────────────────────── */
  if (messageType === "DOCUMENT") {
    const isAgent = true; // document bubbles are always on agent side styled purple
    const inner = (
      <div className={cn("flex items-center gap-3 rounded-2xl px-3 py-3 max-w-[260px]", className)}
        style={{ background: "rgba(255,255,255,0.15)", minWidth: "200px" }}>
        {/* File icon */}
        <div className="flex items-center justify-center w-10 h-10 rounded-xl flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.25)" }}>
          <FileText className="h-5 w-5" style={{ color: "#fff" }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#fff" }}>
            {file.file_name ?? "Document"}
          </p>
          {file.file_size && (
            <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.65)" }}>
              {formatSize(file.file_size)}
            </p>
          )}
        </div>
        {url && (
          <Download className="h-4 w-4 flex-shrink-0" style={{ color: "rgba(255,255,255,0.7)" }} />
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
