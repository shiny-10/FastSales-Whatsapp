"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Plus, Edit2, Trash2, RefreshCw, CheckCircle, Clock, XCircle, FileText, X, Activity } from "lucide-react";
import {
  getTemplates, createTemplate, updateTemplate,
  deleteTemplate, syncTemplateStatus, getRecentActivities,
} from "../../services/templateService";
import { getOrganizations } from "../../services/organizationService";
import StatsCard from "../../components/StatsCard";

const glass = { background: "linear-gradient(145deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.015) 100%)", border: "1px solid rgba(255,255,255,0.08)" } as const;
const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1.5px solid rgba(255,255,255,0.09)", color: "white", borderRadius: "10px", padding: "9px 14px", width: "100%", fontSize: "13px", outline: "none" } as const;
const labelStyle = { fontSize: "11px", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.07em", color: "rgba(255,255,255,0.4)", marginBottom: "6px", display: "block" };

function StatusBadge({ status }: { status: string }) {
  const s = status.toUpperCase();
  const cfg = s === "APPROVED" ? { bg: "rgba(16,185,129,0.15)", color: "#10b981", icon: CheckCircle }
    : s === "REJECTED" ? { bg: "rgba(239,68,68,0.15)", color: "#f87171", icon: XCircle }
    : { bg: "rgba(245,158,11,0.15)", color: "#f59e0b", icon: Clock };
  const Icon = cfg.icon;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: cfg.bg, color: cfg.color }}>
      <Icon className="w-3 h-3" />{s}
    </span>
  );
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [notification, setNotification] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);
  const [syncingIds, setSyncingIds] = useState<number[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<any>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [headerFile, setHeaderFile] = useState<File | null>(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState<string | null>(null);
  const [templateData, setTemplateData] = useState({
    template_name: "", category: "MARKETING", language: "en_US",
    header: "none", template_body: "", footer: "",
    buttons: [] as any[], organization_id: 1, header_url: null as string | null,
  });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [td, ad, od] = await Promise.all([getTemplates(), getRecentActivities(10), getOrganizations()]);
        if (!alive) return;
        setTemplates(td); setRecentActivities(ad); setOrganizations(od || []);
      } catch { /* ignore */ }
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
    total: templates.length,
    approved: templates.filter(t => (t.status || t.meta_status || "").toUpperCase() === "APPROVED").length,
    pending: templates.filter(t => (t.status || t.meta_status || "").toUpperCase() === "PENDING").length,
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
        // Template was saved — warn if Meta submission had an issue
        if (result?.warning) {
          notify("success", "✓ Template saved locally (Meta approval pending)");
        } else {
          notify("success", "✓ Template submitted to Meta for approval!");
        }
      }
      setTemplateData({ template_name: "", category: "MARKETING", language: "en_US", header: "none", template_body: "", footer: "", buttons: [], organization_id: 1, header_url: null });
      setHeaderFile(null); setHeaderPreviewUrl(null); setEditingId(null); setShowModal(false);
      setTemplates(await getTemplates());
    } catch (e: any) {
      const msg = (e as Error).message || "Failed to save template";
      notify("error", msg);
    }
    finally { setIsLoading(false); }
  };

  const handleEdit = (t: any) => {
    setTemplateData({ template_name: t.template_name, category: t.category, language: t.language, header: t.header || "none", template_body: t.template_body, footer: t.footer || "", buttons: t.buttons || [], organization_id: t.organization_id || 1, header_url: t.header_url || null });
    setEditingId(t.id); setHeaderPreviewUrl(t.header_url || null); setShowModal(true);
  };

  const handleDelete = async (id: any) => {
    if (!confirm("Delete this template?")) return;
    try { await deleteTemplate(id); notify("success", "Deleted!"); setTemplates(await getTemplates()); }
    catch (e: any) { notify("error", (e as Error).message || "Failed to delete"); }
  };

  const handleSync = async (id: any) => {
    const tid = Number(id);
    setSyncingIds(s => [...s, tid]);
    try {
      const result = await syncTemplateStatus(id);
      // result = { results: [...] }
      const item: any = result?.results
        ? (result.results.find((r: any) => Number(r.template_id) === tid) || result.results[0])
        : result;

      if (item?.meta_status) {
        setTemplates(p => p.map(t => Number(t.id) === tid ? { ...t, meta_status: item.meta_status, status: item.meta_status } : t));
      }

      if (item?.success) {
        notify("success", `Status: ${item.meta_status || "PENDING"} — ${item.message || "Synced with Meta"}`);
      } else {
        // Show the real Meta error — but template still exists locally
        const errMsg = item?.message || "Could not reach Meta";
        notify("error", errMsg);
      }
    } catch (e: any) {
      notify("error", (e as Error).message || "Sync failed");
    } finally {
      setSyncingIds(s => s.filter(x => x !== tid));
    }
  };

  const FILTER_TABS = [
    { key: "all", label: "All", count: stats.total },
    { key: "approved", label: "Approved", count: stats.approved },
    { key: "pending", label: "Pending", count: stats.pending },
    { key: "rejected", label: "Rejected", count: stats.rejected },
  ];

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-up">
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
          <h1 className="text-3xl font-bold text-white">Templates</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Manage your WhatsApp message templates</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-glow flex items-center gap-2 text-sm">
          <Plus size={15} /> Create Template
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatsCard title="Total Templates" value={stats.total} icon={<FileText size={18} />} gradient="linear-gradient(135deg,#7c3aed,#4f46e5)" glowClass="ring-violet" />
        <StatsCard title="Approved" value={stats.approved} icon={<CheckCircle size={18} />} gradient="linear-gradient(135deg,#10b981,#059669)" glowClass="ring-emerald" />
        <StatsCard title="Pending" value={stats.pending} icon={<Clock size={18} />} gradient="linear-gradient(135deg,#f59e0b,#d97706)" glowClass="ring-amber" />
        <StatsCard title="Rejected" value={stats.rejected} icon={<XCircle size={18} />} gradient="linear-gradient(135deg,#f43f5e,#e11d48)" glowClass="ring-rose" />
      </div>

      {/* Main grid */}
      <div className="grid xl:grid-cols-3 gap-5">
        {/* Table */}
        <div className="xl:col-span-2 rounded-2xl overflow-hidden" style={glass}>
          {/* Filter tabs */}
          <div className="flex gap-1 p-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
            {FILTER_TABS.map(tab => (
              <button key={tab.key} onClick={() => setFilterStatus(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ background: filterStatus === tab.key ? "linear-gradient(135deg,#7c3aed,#4f46e5)" : "rgba(255,255,255,0.04)", color: filterStatus === tab.key ? "#fff" : "rgba(255,255,255,0.4)", boxShadow: filterStatus === tab.key ? "0 4px 12px rgba(124,58,237,0.4)" : "none" }}>
                {tab.label}
                <span className="px-1.5 py-0.5 rounded-full text-[10px]" style={{ background: filterStatus === tab.key ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)" }}>{tab.count}</span>
              </button>
            ))}
          </div>

          <table className="data-table">
            <thead>
              <tr><th>Template</th><th>Category</th><th>Language</th><th>Status</th><th>Created</th><th className="text-center">Actions</th></tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={6} className="text-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>Loading templates…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12" style={{ color: "rgba(255,255,255,0.25)" }}>No templates found</td></tr>
              ) : filtered.map(t => (
                <tr key={t.id}>
                  <td><span className="text-white font-medium">{t.template_name}</span></td>
                  <td>{t.category}</td>
                  <td>{t.language}</td>
                  <td><StatusBadge status={t.status || t.meta_status || "PENDING"} /></td>
                  <td>{t.created_at ? new Date(t.created_at).toLocaleDateString() : "—"}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      {[
                        { Icon: Edit2, fn: () => handleEdit(t), col: "#a78bfa" },
                        { Icon: Trash2, fn: () => handleDelete(t.id), col: "#f43f5e" },
                        { Icon: RefreshCw, fn: () => handleSync(t.id), col: "#10b981", spin: syncingIds.includes(Number(t.id)) },
                      ].map(({ Icon, fn, col, spin }, k) => (
                        <button key={k} onClick={fn}
                          className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = col + "22")}
                          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}>
                          <Icon size={13} style={{ color: col }} className={(spin as any) ? "animate-spin" : ""} />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Recent activity */}
        <div className="rounded-2xl p-5" style={glass}>
          <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
            <Activity size={15} style={{ color: "#a78bfa" }} /> Recent Activity
          </h3>
          {recentActivities.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: "rgba(255,255,255,0.25)" }}>No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentActivities.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                  <span className="text-lg flex-shrink-0 mt-0.5">
                    {a.action === "created" ? "📝" : a.action === "updated" ? "✏️" : a.action === "deleted" ? "🗑️" : "🔄"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize text-white">{a.action}</p>
                    <p className="text-xs truncate" style={{ color: "rgba(255,255,255,0.4)" }}>{a.template_name}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <StatusBadge status={a.status || "PENDING"} />
                    <p className="text-[10px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>{new Date(a.created_at).toLocaleTimeString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl" style={{ background: "#13162b", border: "1px solid rgba(255,255,255,0.1)" }}>
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              <h2 className="text-lg font-semibold text-white">{editingId ? "Edit Template" : "Create Template"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={18} /></button>
            </div>

            <div className="grid grid-cols-2 gap-0 max-h-[75vh] overflow-y-auto">
              {/* Left — form */}
              <div className="p-6 space-y-4" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
                <div><span style={labelStyle}>Template Name</span><input value={templateData.template_name} onChange={e => setTemplateData({ ...templateData, template_name: e.target.value })} placeholder="e.g. order_confirmation" style={inputStyle} className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none" />
                  <p className="text-[11px] mt-1" style={{ color: "rgba(255,255,255,0.3)" }}>Lowercase, underscores only — e.g. <span style={{ color: "#a78bfa" }}>order_confirmation</span></p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><span style={labelStyle}>Category</span>
                    <select value={templateData.category} onChange={e => setTemplateData({ ...templateData, category: e.target.value })} style={inputStyle} className="focus:outline-none">
                      <option>MARKETING</option><option>UTILITY</option><option>AUTHENTICATION</option>
                    </select>
                  </div>
                  <div><span style={labelStyle}>Language</span>
                    <select value={templateData.language} onChange={e => setTemplateData({ ...templateData, language: e.target.value })} style={inputStyle} className="focus:outline-none">
                      <option>en_US</option><option>hi</option>
                    </select>
                  </div>
                </div>
                <div><span style={labelStyle}>Organization</span>
                  <select value={templateData.organization_id} onChange={e => setTemplateData({ ...templateData, organization_id: Number(e.target.value) })} style={inputStyle} className="focus:outline-none">
                    {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
                  </select>
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
                      className="w-full text-sm" style={{ color: "rgba(255,255,255,0.6)" }} />
                  </div>
                )}
                <div><span style={labelStyle}>Body Text</span>
                  <textarea rows={5} placeholder="Type your message..." value={templateData.template_body} onChange={e => setTemplateData({ ...templateData, template_body: e.target.value })}
                    style={{ ...inputStyle, resize: "none" }} className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none" />
                </div>
                <div><span style={labelStyle}>Footer (optional)</span>
                  <input value={templateData.footer} maxLength={60} onChange={e => setTemplateData({ ...templateData, footer: e.target.value })} placeholder="Optional footer (max 60 chars)" style={inputStyle} className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none" />
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
                          style={{ ...inputStyle, flex: 1, width: "auto" }} className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none text-xs" />
                        <button onClick={() => setTemplateData({ ...templateData, buttons: templateData.buttons.filter((_, j) => j !== i) })} style={{ color: "#f43f5e" }}><X size={15} /></button>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => setTemplateData({ ...templateData, buttons: [...templateData.buttons, { type: "QUICK_REPLY", text: "" }] })}
                    className="mt-2 text-xs font-medium" style={{ color: "#a78bfa" }}>+ Add Button</button>
                </div>
              </div>

              {/* Right — preview */}
              <div className="p-6 space-y-4">
                <span style={labelStyle}>Preview</span>
                <div className="rounded-2xl overflow-hidden" style={{ background: "#efeae2" }}>
                  <div className="px-3 py-2 text-xs font-semibold" style={{ background: "#128c7e", color: "white" }}>WhatsApp Preview</div>
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

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
              <button onClick={handleSave} disabled={isLoading} className="btn-glow text-sm px-5 py-2.5 disabled:opacity-60">
                {isLoading ? "Saving…" : editingId ? "Update" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

