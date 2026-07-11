"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

interface LinkPreviewData {
  title: string | null;
  description: string | null;
  image: string | null;
  url: string;
}

const URL_REGEX = /https?:\/\/[^\s<>"]+/gi;

function extractFirstUrl(text: string): string | null {
  return text.match(URL_REGEX)?.[0] ?? null;
}

export function LinkPreview({ text, isAgent }: { text: string; isAgent: boolean }) {
  const [data, setData] = useState<LinkPreviewData | null>(null);
  const url = extractFirstUrl(text);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(`/api/link-preview?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.title) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  if (!data) return null;

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`block mt-2 rounded-xl overflow-hidden border text-left transition-opacity hover:opacity-90 ${
        isAgent
          ? "border-green-300/50 dark:border-green-700/50 bg-green-50/50 dark:bg-green-900/20"
          : "border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800/50"
      }`}
    >
      {data.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={data.image} alt="" className="w-full h-32 object-cover" />
      )}
      <div className="px-3 py-2">
        <p className="text-xs font-semibold line-clamp-1 text-gray-800 dark:text-gray-100">{data.title}</p>
        {data.description && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 line-clamp-2 mt-0.5">{data.description}</p>
        )}
        <div className="flex items-center gap-1 mt-1">
          <ExternalLink className="h-2.5 w-2.5 text-gray-400" />
          <span className="text-[10px] text-gray-400 truncate">{data.url}</span>
        </div>
      </div>
    </a>
  );
}
