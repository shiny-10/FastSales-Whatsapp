"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Edit2, Trash2, RefreshCw, CheckCircle, Clock, XCircle, FileText, X, Activity, Send } from "lucide-react";
import {
  getTemplates, createTemplate, updateTemplate,
  deleteTemplate, syncTemplateStatus, resubmitTemplate, getRecentActivities,
  syncAllTemplates,
} from "../../services/templateService";

const card = { background: "#ffffff", border: "1px solid #ece9f8", borderRadius: "14px", boxShadow: "0 1px 6px rgba(100,80,200,0.07)" };
const inputStyle = { background: "#f5f4fb", border: "1.5px solid #e0ddf5", color: "#1a1040", borderRadius: "10px", padding: "9px 14px", width: "100%", fontSize: "13px", outline: "none" } as const;
const labelStyle = { fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "#9390b5", marginBottom: "6px", display: "block" };

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cfg = s === "APPROVED" ? { bg: "rgba(16,185,129,0.12)", color: "#10b981", icon: CheckCircle }
    : s === "REJECTED"         ? { bg: "rgba(244,63,94,0.10)",  color: "#f43f5e", icon: XCircle }
    :                            { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" />{s}
    </span>
  );
}

function StatCard({ icon: Icon, title, value, color, bg }: any) {
  return (
    <div className="rounded-2xl p-5 flex items-center justify-between" style={card}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#9390b5" }}>{title}</p>
        <p className="text-[28px] font-bold tabular-nums" style={{ color: "#1a1040" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
      </div>
      <div className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0" style={{ background: bg }}>
        <Icon size={22} style={{ color }} />
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [notification, setNotification] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [syncingIds, setSyncingIds] = useState<number[]>([]);
  const [resubmittingIds, setResubmittingIds] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState({
    template_name: "", category: "MARKETING", language: "en_US",
    header: "none", template_body: "", footer: "",
    buttons: [] as any[], header_url: null as string | null,
  });

  const [isSyncingAll, setIsSyncingAll] = useState(false);

  const handleSyncAll = async () => {
    setIsSyncingAll(true);
    try {
      const res = await syncAllTemplates();
      if (res.success) {
        notify("success", res.message || "Synced all templates from Meta!");
        const [td, ad] = await Promise.all([getTemplates(), getRecentActivities(10)]);
        setTemplates(td); setRecentActivities(ad);
      } else {
        notify("error", res.message || "Failed to sync templates");
      }
    } catch (e: any) {
      notify("error", (e as Error).message || "Sync failed");
    } finally {
      setIsSyncingAll(false);
    }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [td, ad] = await Promise.all([getTemplates(), getRecentActivities(10)]);
        if (!alive) return;
        setTemplates(td); setRecentActivities(ad);

        const res = await syncAllTemplates();
        if (res?.success && alive) {
          const freshTemplates = await getTemplates();
          if (alive) setTemplates(freshTemplates);
        }
      } catch { }
    })();
    return () => { alive = false; };
  }, []);

  const notify = (type: string, message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification({ type: "", message: "" }), 3000);
  };

  const filtered = filterStatus === "all" ? templates
    : templates.filter(t => (t.status || t.meta_status || "PENDING").toLowerCase() === filterStatus);

  const stats = {
    total:    templates.length,
    approved: templates.filter(t => (t.status || t.meta_status || "").toUpperCase() === "APPROVED").length,
    pending:  templates.filter(t => (t.status || t.meta_status || "").toUpperCase() === "PENDING").length,
    rejected: templates.filter(t => (t.status || t.meta_status || "").toUpperCase() === "REJECTED").length,
  };

  const handleSave = async () => {
    if (!templateData.template_name.trim()) { notify("error", "Template name is required"); return; }
    setIsLoading(true);
    try {
      let result: any;
      if (editingId) {
        result = await updateTemplate(editingId, templateData);
        notify("success", "Template updated!");
      } else {
        if (headerFile) {
          const fd = new FormData();
          Object.entries(templateData).forEach(([k, v]) => { if (v !== null) fd.append(k, typeof v === "object" ? JSON.stringify(v) : String(v)); });
          fd.append("file", headerFile);
          result = await createTemplate(fd);
        } else {
          result = await createTemplate(templateData);
        }
        notify("success", result?.warning ? "✓ Template saved locally" : "✓ Template submitted to Meta!");
      }
      setTemplateData({ template_name: "", category: "MARKETING", language: "en_US", header: "none", template_body: "", footer: "", buttons: [], header_url: null });
      setHeaderFile(null); setHeaderPreviewUrl(null); setEditingId(null); setShowModal(false);
      setTemplates(await getTemplates());
    } catch (e: any) {
      notify("error", (e as Error).message || "Failed to save template");
    } finally { setIsLoading(false); }
  };

  const handleEdit = (t: any) => {
    setTemplateData({ template_name: t.template_name, category: t.category, language: t.language, header: t.header || "none", template_body: t.template_body, footer: t.footer || "", buttons: t.buttons || [], header_url: t.header_url || null });
    setEditingId(t.id); setHeaderPreviewUrl(t.header_url || null); setShowModal(true);
  };

  const handleDelete = async (id: any) => {
    if (!confirm("Delete this template?")) return;
    try { await deleteTemplate(id); notify("success", "Deleted!"); setTemplates(await getTemplates()); }
    catch (e: any) { notify("error", (e as Error).message || "Failed to delete"); }
  };

  const handleSync = async (id: any, templateName: string) => {
    const tid = Number(id);
    setSyncingIds(s => [...s, tid]);
    try {
      const result = await syncTemplateStatus(id);
      if (result?.meta_status) setTemplates(p => p.map(t => Number(t.id) === tid ? { ...t, meta_status: result.meta_status, status: result.meta_status } : t));
      notify(result?.success ? "success" : "error", result?.success ? `"${templateName}" — ${result.meta_status}` : result?.message || "Could not reach Meta");
    } catch (e: any) { notify("error", (e as Error).message || "Sync failed"); }
    finally { setSyncingIds(s => s.filter(x => x !== tid)); }
  };

  const handleResubmit = async (id: any) => {
    const tid = Number(id);
    setResubmittingIds(s => [...s, tid]);
    try {
      const result = await resubmitTemplate(id);
      notify("success", result.message || "Resubmitted to Meta!");
      setTemplates(await getTemplates());
    } catch (e: any) {
      const err = e as any;
      notify("error", (err.message || "Resubmit failed") + (err.hint ? ` — ${err.hint}` : ""));
    } finally { setResubmittingIds(s => s.filter(x => x !== tid)); }
  };

  const FILTER_TABS = [
    { key: "all",      label: "All",      count: stats.total    },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "pending",  label: "Pending",  count: stats.pending  },
    { key: "rejected", label: "Rejected", count: stats.rejected },
  ];

  return (
    <div className="p-6 space-y-5 animate-fade-up">
      {/* Toast */}
      {notification.message && (
        <div className="fixed top-5 right-5 z-50 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-xl"
          style={{ background: notification.type === "success" ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#e11d48,#f43f5e)" }}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>Templates</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>Manage your WhatsApp message templates</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border border-purple-200 text-purple-700 bg-white hover:bg-purple-50 disabled:opacity-50 transition cursor-pointer"
          >
            <RefreshCw size={14} className={isSyncingAll ? "animate-spin" : ""} />
            {isSyncingAll ? "Syncing Meta..." : "Sync from Meta"}
          </button>
          <button onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white cursor-pointer"
            style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
            <Plus size={14} /> Create Template
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={FileText}    title="Total Templates" value={stats.total}    color="#7c3aed" bg="rgba(124,58,237,0.10)" />
        <StatCard icon={CheckCircle} title="Approved"        value={stats.approved} color="#10b981" bg="rgba(16,185,129,0.10)" />
        <StatCard icon={Clock}       title="Pending"         value={stats.pending}  color="#f59e0b" bg="rgba(245,158,11,0.10)" />
        <StatCard icon={XCircle}     title="Rejected"        value={stats.rejected} color="#f43f5e" bg="rgba(244,63,94,0.10)"  />
      </div>

      {/* Main grid — table + activity */}
      <div className="grid xl:grid-cols-3 gap-5 items-start">
        {/* Table */}
        <div className="xl:col-span-2" style={{ ...card, padding: 0, overflow: "hidden" }}>
          {/* Filter tabs */}
          <div className="flex gap-1 p-3" style={{ borderBottom: "1px solid #ece9f8" }}>
            {FILTER_TABS.map(tab => (
              <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: filterStatus === tab.key ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "#f5f4fb",
                  color: filterStatus === tab.key ? "#fff" : "#9390b5",
                  boxShadow: filterStatus === tab.key ? "0 4px 12px rgba(124,58,237,0.25)" : "none",
                }}>
                {tab.label}
                <span className="px-1.5 py-0.5 rounded-full text-[10px]"
                  style={{ background: filterStatus === tab.key ? "rgba(255,255,255,0.25)" : "#ece9f8", color: filterStatus === tab.key ? "#fff" : "#9390b5" }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <table className="data-table">
            <thead>
              <tr><th>Template</th><th>Category</th><th>Language</th><th>Status</th><th>Created</th><th className="text-center">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12" style={{ color: "#b0aed0" }}>Loading…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12" style={{ color: "#b0aed0" }}>No templates found</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id}>
                  <td><span className="font-semibold" style={{ color: "#1a1040" }}>{t.template_name}</span></td>
                  <td style={{ color: "#4b4880" }}>{t.category}</td>
                  <td style={{ color: "#4b4880" }}>{t.language}</td>
                  <td><StatusBadge status={t.status || t.meta_status || "PENDING"} /></td>
                  <td style={{ color: "#9390b5" }}>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      {[
                        { Icon: Edit2,     fn: () => handleEdit(t),                  col: "#7c3aed", title: "Edit",   spin: false },
                        { Icon: Trash2,    fn: () => handleDelete(t.id),             col: "#f43f5e", title: "Delete", spin: false },
                        { Icon: RefreshCw, fn: () => handleSync(t.id, t.template_name), col: "#10b981", title: "Sync", spin: syncingIds.includes(Number(t.id)) },
                      ].map(({ Icon, fn, col, title, spin }, k) => (
                        <button key={k} onClick={fn} title={title}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                          style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                          onMouseEnter={e => (e.currentTarget.style.background = col + "15")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}>
                          <Icon size={13} style={{ color: col }} className={spin ? "animate-spin" : ""} />
                        </button>
                      ))}
                      {!t.meta_template_id && (
                        <button onClick={() => handleResubmit(t.id)} title="Resubmit to Meta"
                          disabled={resubmittingIds.includes(Number(t.id))}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors disabled:opacity-50"
                          style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                          onMouseEnter={e => (e.currentTarget.style.background = "#f59e0b15")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}>
                          <Send size={13} style={{ color: "#f59e0b" }} className={resubmittingIds.includes(Number(t.id)) ? "animate-pulse" : ""} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent activity */}
        <div style={{ ...card, padding: "20px" }}>
          <h3 className="font-semibold text-[15px] mb-4 flex items-center gap-2" style={{ color: "#1a1040" }}>
            <Activity size={15} style={{ color: "#7c3aed" }} /> Recent Activity
          </h3>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "#b0aed0" }}>No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-2.5" style={{ borderBottom: "1px solid #f0eefb" }}>
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {a.action === "created" ? "📝" : a.action === "updated" ? "✏️" : a.action === "deleted" ? "🗑️" : "🔄"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize" style={{ color: "#1a1040" }}>{a.action}</p>
                    <p className="text-xs truncate" style={{ color: "#9390b5" }}>{a.template_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={a.status || "PENDING"} />
                    <p className="text-[10px] mt-1" style={{ color: "#b0aed0" }}>{new Date(a.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(26,16,64,0.35)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#fff", border: "1px solid #ece9f8" }}>
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid #ece9f8" }}>
              <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>{editingId ? "Edit Template" : "Create Template"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9390b5" }}><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-0 max-h-[75vh] overflow-y-auto">
              {/* Left — form */}
              <div className="p-6 space-y-4" style={{ borderRight: "1px solid #ece9f8" }}>
                <div>
                  <span style={labelStyle}>Template Name</span>
                  <input value={templateData.template_name} onChange={e => setTemplateData({ ...templateData, template_name: e.target.value })} placeholder="e.g. order_confirmation" style={inputStyle} className="placeholder:text-[#c0bed8] focus:outline-none" />
                  <p className="text-[11px] mt-1" style={{ color: "#b0aed0" }}>Lowercase, underscores only</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><span style={labelStyle}>Category</span>
                    <select value={templateData.category} onChange={e => setTemplateData({ ...templateData, category: e.target.value })} style={inputStyle} className="focus:outline-none">
                      <option>MARKETING</option><option>UTILITY</option><option>AUTHENTICATION</option>
                    </select>
                  </div>
                  <div><span style={labelStyle}>Language</span>
                    <select value={templateData.language} onChange={e => setTemplateData({ ...templateData, language: e.target.value })} style={inputStyle} className="focus:outline-none">
                      <option value="en_US">English (US)</option><option value="en_GB">English (UK)</option>
                      <option value="hi">Hindi</option><option value="ar">Arabic</option>
                      <option value="fr">French</option><option value="de">German</option>
                      <option value="es_ES">Spanish</option><option value="pt_BR">Portuguese (BR)</option>
                      <option value="id">Indonesian</option><option value="tr">Turkish</option>
                    </select>
                  </div>
                </div>
                <div><span style={labelStyle}>Header</span>
                  <select value={templateData.header} onChange={e => setTemplateData({ ...templateData, header: e.target.value })} style={inputStyle} className="focus:outline-none">
                    <option value="none">None</option><option value="text">Text</option><option value="image">Image</option><option value="video">Video</option><option value="document">Document</option>
                  </select>
                </div>
                {templateData.header !== "none" && (
                  <div><span style={labelStyle}>Upload {templateData.header}</span>
                    <input type="file" accept={templateData.header === "image" ? "image/*" : templateData.header === "video" ? "video/mp4" : ".pdf,.doc,.docx"}
                      onChange={e => { const f = e.target.files?.[0] || null; setHeaderFile(f); setHeaderPreviewUrl(f ? URL.createObjectURL(f) : null); }}
                      className="w-full text-sm" style={{ color: "#4b4880" }} />
                  </div>
                )}
                <div><span style={labelStyle}>Body Text</span>
                  <textarea rows={5} placeholder="Type your message..." value={templateData.template_body} onChange={e => setTemplateData({ ...templateData, template_body: e.target.value })}
                    style={{ ...inputStyle, resize: "none" }} className="placeholder:text-[#c0bed8] focus:outline-none" />
                </div>
                <div><span style={labelStyle}>Footer (optional)</span>
                  <input value={templateData.footer} maxLength={60} onChange={e => setTemplateData({ ...templateData, footer: e.target.value })} placeholder="Optional footer (max 60 chars)" style={inputStyle} className="placeholder:text-[#c0bed8] focus:outline-none" />
                </div>
                <div>
                  <span style={labelStyle}>Buttons</span>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {templateData.buttons.map((btn, i) => (
                      <div key={i} className="flex gap-2">
                        <select value={btn.type} onChange={e => { const b = [...templateData.buttons]; b[i].type = e.target.value; setTemplateData({ ...templateData, buttons: b }); }}
                          style={{ ...inputStyle, flex: 1, width: "auto" }} className="focus:outline-none text-xs">
                          <option value="QUICK_REPLY">QUICK_REPLY</option><option value="CALL_TO_ACTION">CALL_TO_ACTION</option>
                        </select>
                        <input value={btn.text} maxLength={20} placeholder="Label" onChange={e => { const b = [...templateData.buttons]; b[i].text = e.target.value; setTemplateData({ ...templateData, buttons: b }); }}
                          style={{ ...inputStyle, flex: 1, width: "auto" }} className="placeholder:text-[#c0bed8] focus:outline-none text-xs" />
                        <button onClick={() => setTemplateData({ ...templateData, buttons: templateData.buttons.filter((_, j) => j !== i) })} style={{ color: "#f43f5e" }}><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setTemplateData({ ...templateData, buttons: [...templateData.buttons, { type: "QUICK_REPLY", text: "" }] })}
                    className="mt-2 text-xs font-medium" style={{ color: "#7c3aed" }}>+ Add Button</button>
                </div>
              </div>

              {/* Right — preview */}
              <div className="p-6 space-y-4" style={{ background: "#faf9ff" }}>
                <span style={labelStyle}>Preview</span>
                <div className="rounded-2xl overflow-hidden" style={{ background: "#efeae2" }}>
                  <div className="px-3 py-2 text-xs font-semibold text-white" style={{ background: "#128c7e" }}>WhatsApp Preview</div>
                  <div className="p-4 min-h-48">
                    <div className="bg-white rounded-2xl rounded-tl-sm p-3 shadow-sm max-w-xs">
                      {templateData.header !== "none" && (headerPreviewUrl || templateData.header_url) ? (
                        templateData.header === "image" ? (
                          <div className="relative h-28 w-full mb-2 rounded-lg overflow-hidden">
                            <Image loader={({ src }) => src} src={headerPreviewUrl || templateData.header_url || ""} alt="header" fill className="object-cover" unoptimized />
                          </div>
                        ) : <div className="h-12 rounded-lg mb-2 flex items-center justify-center text-xs" style={{ background: "#f0f0f0", color: "#666" }}>[{templateData.header}]</div>
                      ) : null}
                      <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                        {(templateData.template_body || "Your message here…").replace(/\{\{1\}\}/g, "Rahul").replace(/\{\{2\}\}/g, "#12345").replace(/\{\{3\}\}/g, "today")}
                      </p>
                      {templateData.footer && <p className="text-xs text-gray-400 border-t mt-2 pt-1">{templateData.footer}</p>}
                      {templateData.buttons.length > 0 && (
                        <div className="border-t mt-2 pt-2 space-y-1">
                          {templateData.buttons.map((btn, i) => (
                            <div key={i} className="text-center text-xs py-1 rounded" style={{ color: "#128c7e", background: "#f0f0f0" }}>{btn.text || `Button ${i + 1}`}</div>
                          ))}
                        </div>
                      )}
                      <p className="text-right text-[10px] text-gray-400 mt-1">11:30 AM ✓✓</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid #ece9f8" }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>Cancel</button>
              <button onClick={handleSave} disabled={isLoading} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
                style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
                {isLoading ? "Saving…" : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
