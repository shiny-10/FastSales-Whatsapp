"use client";
import { useState, useEffect } from "react";
import { X, Send, Loader2, ChevronDown, Eye } from "lucide-react";
import { useSendTemplateMessage } from "@/hooks/use-messages";
import { useInboxStore } from "@/store/inbox-store";
import { getTemplates } from "@/services/templateService";
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

interface Template {
  id: number;
  template_name: string;
  template_body: string;
  language: string;
  category: string;
  meta_status: string;
  header?: string;
  footer?: string;
}

interface TemplateModalProps {
  conversationId: string;
  onSent: (message: Message) => void;
  onClose: () => void;
}

/** Extract {{1}}, {{2}} … placeholders from a template body */
function extractVariables(body: string): number[] {
  const matches = body.match(/\{\{(\d+)\}\}/g) ?? [];
  const nums = [...new Set(matches.map((m) => parseInt(m.replace(/\D/g, ""))))];
  return nums.sort((a, b) => a - b);
}

/** Replace {{1}}, {{2}} … with the provided values */
function applyVariables(body: string, values: Record<number, string>): string {
  return body.replace(/\{\{(\d+)\}\}/g, (_, n) => values[parseInt(n)] ?? `{{${n}}}`);
}

export function TemplateModal({ conversationId, onSent, onClose }: TemplateModalProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [variables, setVariables] = useState<Record<number, string>>({});
  const [showPreview, setShowPreview] = useState(true);

  const { mutateAsync: sendTemplate, isPending } = useSendTemplateMessage();
  const { addMessage } = useInboxStore();

  // Load approved templates
  useEffect(() => {
    getTemplates()
      .then((res: any[]) => {
        const approved = (Array.isArray(res) ? res : []).filter(
          (t) => (t.meta_status ?? "").toUpperCase() === "APPROVED"
        );
        setTemplates(approved);
        if (approved.length > 0) setSelectedId(approved[0].id);
      })
      .catch(() => {})
      .finally(() => setLoadingTemplates(false));
  }, []);

  const selected = templates.find((t) => t.id === selectedId) ?? null;
  const varNums = selected ? extractVariables(selected.template_body ?? "") : [];
  const preview = selected
    ? applyVariables(selected.template_body ?? "", variables)
    : "";

  const handleSelectTemplate = (id: number) => {
    setSelectedId(id);
    setVariables({});
  };

  const handleSend = async () => {
    if (!selected) return;
    const components =
      varNums.length > 0
        ? [
            {
              type: "body",
              parameters: varNums.map((n) => ({
                type: "text",
                text: variables[n] ?? "",
              })),
            },
          ]
        : undefined;

    try {
      const msg = await sendTemplate({
        conversation_id: conversationId,
        template_name: selected.template_name,
        language_code: selected.language || "en_US",
        components,
      });
      addMessage(msg);
      onSent(msg);
      onClose();
    } catch {
      /* ignore — error shown by hook */
    }
  };

  const labelStyle = {
    fontSize: "11px",
    fontWeight: 600,
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
    color: "#b0b3c6",
    marginBottom: "6px",
    display: "block",
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(4px)" }}
    >
      <div
        className="w-full max-w-md mx-4 rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: "#ffffff", border: "1px solid #e8eaf0" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid #f0f1f5" }}
        >
          <h2 className="font-semibold text-base" style={{ color: "#1a1d23" }}>
            Send Template
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors"
            style={{ background: "#f5f6fa", color: "#9498b0" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e8eaf0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f6fa")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Template selector */}
          <div>
            <span style={labelStyle}>Template</span>
            {loadingTemplates ? (
              <div className="flex items-center gap-2 py-2" style={{ color: "#b0b3c6" }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Loading templates…</span>
              </div>
            ) : templates.length === 0 ? (
              <p className="text-sm py-2" style={{ color: "#b0b3c6" }}>
                No approved templates found. Create and get approval in the Templates page.
              </p>
            ) : (
              <div className="relative">
                <select
                  value={selectedId ?? ""}
                  onChange={(e) => handleSelectTemplate(Number(e.target.value))}
                  className="appearance-none focus:outline-none pr-9"
                  style={{ ...inputCls, cursor: "pointer" }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "#7c3aed44")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "#e8eaf0")}
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.template_name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                  style={{ color: "#b0b3c6" }}
                />
              </div>
            )}
          </div>

          {/* Variables */}
          {selected && varNums.length > 0 && (
            <div>
              <span style={labelStyle}>Variables</span>
              <div className="space-y-2">
                {varNums.map((n) => (
                  <div key={n} className="flex items-center gap-2">
                    <span
                      className="text-xs w-8 shrink-0 font-mono"
                      style={{ color: "#b0b3c6" }}
                    >
                      {`{{${n}}}`}
                    </span>
                    <input
                      value={variables[n] ?? ""}
                      onChange={(e) =>
                        setVariables((prev) => ({ ...prev, [n]: e.target.value }))
                      }
                      placeholder={`Variable ${n}`}
                      style={{ ...inputCls, flex: 1, width: "auto" }}
                      className="placeholder:text-[#c0c3d6] focus:outline-none"
                      onFocus={(e) => (e.currentTarget.style.borderColor = "#7c3aed44")}
                      onBlur={(e) => (e.currentTarget.style.borderColor = "#e8eaf0")}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Preview */}
          {selected && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span style={labelStyle}>Preview</span>
                <button
                  type="button"
                  onClick={() => setShowPreview((v) => !v)}
                  className="flex items-center gap-1 text-xs"
                  style={{ color: "#7c3aed" }}
                >
                  <Eye className="h-3 w-3" />
                  {showPreview ? "Hide" : "Show"}
                </button>
              </div>
              {showPreview && (
                <div
                  className="rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap break-words leading-relaxed"
                  style={{
                    background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
                    color: "#ffffff",
                    boxShadow: "0 2px 12px rgba(124,58,237,0.2)",
                  }}
                >
                  {preview || (
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>
                      {selected.template_body}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex gap-2 px-5 pb-5 pt-3"
          style={{ borderTop: "1px solid #f0f1f5" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "#f5f6fa", color: "#4b4f6b", border: "1px solid #e8eaf0" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#e8eaf0")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f5f6fa")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!selected || isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg,#7c3aed,#4f46e5)",
              boxShadow: "0 4px 14px rgba(124,58,237,0.35)",
            }}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send Template
          </button>
        </div>
      </div>
    </div>
  );
}
