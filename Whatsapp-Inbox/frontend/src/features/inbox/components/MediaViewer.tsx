"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Download, FileText, Film, Music } from "lucide-react";
import { Button } from "@/shared/components/button";
import { cn } from "@/shared/lib/utils";
import { useSignedMediaUrl } from "@/features/messaging/use-media";
import type { MediaFile, MessageType } from "@/shared/types";

interface MediaViewerProps {
  mediaFiles: MediaFile[];
  messageType: MessageType;
  className?: string;
}

export function MediaViewer({ mediaFiles, messageType, className }: MediaViewerProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  if (mediaFiles.length === 0) return null;

  const file = mediaFiles[0];
  const { data: signedMedia } = useSignedMediaUrl(file.id);
  const url = signedMedia?.signed_url || (file.file_url?.startsWith("http://") || file.file_url?.startsWith("https://") ? file.file_url : undefined);

  if (!url) {
    return null;
  }

  if (messageType === "IMAGE") {
    return (
      <>
        <button
          onClick={() => { setActiveIdx(0); setLightboxOpen(true); }}
          className={cn("relative overflow-hidden rounded-xl max-w-xs", className)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={file.file_name ?? "image"}
            className="max-w-full max-h-72 object-cover rounded-xl"
          />
        </button>

        <AnimatePresence>
          {lightboxOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
              onClick={() => setLightboxOpen(false)}
            >
              <motion.img
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0.9 }}
                src={url ?? ""}
                alt={file.file_name ?? "image"}
                className="max-h-screen max-w-screen object-contain rounded-xl"
                onClick={(e) => e.stopPropagation()}
              />
              <Button
                size="icon"
                variant="ghost"
                className="absolute top-4 right-4 text-white hover:text-white hover:bg-white/20"
                onClick={() => setLightboxOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  if (messageType === "VIDEO") {
    return (
      <div className={cn("rounded-xl overflow-hidden max-w-xs", className)}>
        <video controls className="max-w-full max-h-72 rounded-xl" src={url ?? undefined}>
          <track kind="captions" />
        </video>
      </div>
    );
  }

  if (messageType === "AUDIO") {
    return (
      <div className={cn("flex items-center gap-3 bg-muted rounded-xl px-4 py-3 min-w-[200px]", className)}>
        <Music className="h-5 w-5 text-brand-600 shrink-0" />
        <audio controls className="flex-1 h-8">
          <source src={url ?? undefined} />
        </audio>
      </div>
    );
  }

  if (messageType === "DOCUMENT") {
    return (
      <a
        href={url ?? "#"}
        download={file.file_name}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center gap-3 bg-muted hover:bg-accent transition-colors rounded-xl px-4 py-3 max-w-xs",
          className
        )}
      >
        <FileText className="h-8 w-8 text-brand-600 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{file.file_name ?? "Document"}</p>
          {file.file_size && (
            <p className="text-xs text-muted-foreground">
              {(file.file_size / 1024).toFixed(1)} KB
            </p>
          )}
        </div>
        <Download className="h-4 w-4 text-muted-foreground shrink-0 ml-auto" />
      </a>
    );
  }

  return null;
}
