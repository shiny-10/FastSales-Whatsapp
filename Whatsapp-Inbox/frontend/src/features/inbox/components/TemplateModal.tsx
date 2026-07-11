"use client";

import { useState } from "react";
import { X, Send, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/button";
import { useSendTemplateMessage } from "@/features/inbox/api/use-messages";
import { useInboxStore } from "@/features/inbox/store/inbox-store";
import type { Message } from "@/shared/types";

interface TemplateModalProps {
  conversationId: string;
  onSent: (message: Message) => void;
  onClose: () => void;
}

export function TemplateModal({ conversationId, onSent, onClose }: TemplateModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [languageCode, setLanguageCode] = useState("en_US");
  const [variables, setVariables] = useState<string[]>([""]);
  const { mutateAsync: sendTemplate, isPending } = useSendTemplateMessage();
  const { addMessage } = useInboxStore();

  const handleSend = async () => {
    if (!templateName.trim()) return;
    const components = variables.some((v) => v.trim())
      ? [{ type: "body", parameters: variables.filter((v) => v.trim()).map((v) => ({ type: "text", text: v })) }]
      : undefined;

    try {
      const msg = await sendTemplate({
        conversation_id: conversationId,
        template_name: templateName.trim(),
        language_code: languageCode,
        components,
      });
      addMessage(msg);
      onSent(msg);
      onClose();
    } catch (e) {
      console.error("Template send failed", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#202c33] rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Send Template</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Template Name</label>
            <input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g. hello_world"
              className="w-full bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none placeholder:text-gray-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Language Code</label>
            <input
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              placeholder="en_US"
              className="w-full bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm font-medium">Variables (&#123;&#123;1&#125;&#125;, &#123;&#123;2&#125;&#125;…)</label>
              <button
                type="button"
                onClick={() => setVariables((v) => [...v, ""])}
                className="text-xs text-brand-600 dark:text-brand-400 flex items-center gap-1 hover:underline"
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {variables.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs text-gray-400 w-6 shrink-0">{`{{${i + 1}}}`}</span>
                  <input
                    value={v}
                    onChange={(e) => setVariables((prev) => prev.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={`Variable ${i + 1}`}
                    className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-1.5 text-sm focus:outline-none placeholder:text-gray-400"
                  />
                  {variables.length > 1 && (
                    <button type="button" onClick={() => setVariables((prev) => prev.filter((_, j) => j !== i))} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <Button variant="ghost" onClick={onClose} className="flex-1">Cancel</Button>
          <Button
            onClick={handleSend}
            disabled={!templateName.trim() || isPending}
            className="flex-1 bg-[#00a884] hover:bg-[#00956f] text-white gap-2"
          >
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Template
          </Button>
        </div>
      </div>
    </div>
  );
}
