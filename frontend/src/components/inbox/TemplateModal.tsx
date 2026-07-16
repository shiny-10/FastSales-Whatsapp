"use client";
import { useState } from "react";
import { X, Send, Loader2, Plus, Trash2 } from "lucide-react";
import { useSendTemplateMessage } from "@/hooks/use-messages";
import { useInboxStore } from "@/store/inbox-store";
import type { Message } from "@/lib/types";

const inputCls = {
  background: "#f5f6fa",
  border: "1.5px solid #e8eaf0",
  borderRadius: "10px",
  padding: "9px 14px",
  width: "100%",
  fontSize: "13px",
  color: "#1a1d23",
  outline: "none",
} as const;

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
    const components = variables.some(v => v.trim())
      ? [{ type: "body", parameters: variables.filter(v => v.trim()).map(v => ({ type: "text", text: v })) }]
      : undefined;
    try {
      const msg = await sendTemplate({ conversation_id: conversationId, template_name: templateName.trim(), language_code: languageCode, components });
      addMessage(msg); onSent(msg); onClose();
    } catch { /* ignore */ }
  };

  const labelStyle = { fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "#b0b3c6", marginBottom: "6px", display: "block" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}>
      <div className="w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden" style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid #f0f1f5" }}>
          <h2 className="font-semibold text-base" style={{ color: "#1a1d23" }}>Send Template</h2>
          <button type="button" onClick={onClose} className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: "#f5f6fa", color: "#9498b0" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e8eaf0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f5f6fa")}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div>
            <span style={labelStyle}>Template Name</span>
            <input value={templateName} onChange={e => setTemplateName(e.target.value)}
              placeholder="e.g. hello_world" style={inputCls} className="placeholder:text-[#c0c3d6] focus:outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = "#7c3aed44")}
              onBlur={e => (e.currentTarget.style.borderColor = "#e8eaf0")} />
          </div>
          <div>
            <span style={labelStyle}>Language Code</span>
            <input value={languageCode} onChange={e => setLanguageCode(e.target.value)}
              placeholder="en_US" style={inputCls} className="focus:outline-none"
              onFocus={e => (e.currentTarget.style.borderColor = "#7c3aed44")}
              onBlur={e => (e.currentTarget.style.borderColor = "#e8eaf0")} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span style={labelStyle}>Variables</span>
              <button type="button" onClick={() => setVariables(v => [...v, ""])}
                className="flex items-center gap-1 text-xs font-medium transition-colors"
                style={{ color: "#7c3aed" }}>
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            <div className="space-y-2">
              {variables.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs w-8 shrink-0 font-mono" style={{ color: "#b0b3c6" }}>{`{{${i+1}}}`}</span>
                  <input value={v} onChange={e => setVariables(prev => prev.map((x, j) => j === i ? e.target.value : x))}
                    placeholder={`Variable ${i+1}`} style={{ ...inputCls, flex: 1, width: "auto" }}
                    className="placeholder:text-[#c0c3d6] focus:outline-none" />
                  {variables.length > 1 && (
                    <button type="button" onClick={() => setVariables(prev => prev.filter((_, j) => j !== i))}
                      style={{ color: "#d0d2e0" }}
                      onMouseEnter={e => (e.currentTarget.style.color = "#ef4444")}
                      onMouseLeave={e => (e.currentTarget.style.color = "#d0d2e0")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-5 pb-5">
          <button type="button" onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "#f5f6fa", color: "#4b4f6b", border: "1px solid #e8eaf0" }}
            onMouseEnter={e => (e.currentTarget.style.background = "#e8eaf0")}
            onMouseLeave={e => (e.currentTarget.style.background = "#f5f6fa")}>
            Cancel
          </button>
          <button type="button" onClick={handleSend} disabled={!templateName.trim() || isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.35)" }}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send Template
          </button>
        </div>
      </div>
    </div>
  );
}
