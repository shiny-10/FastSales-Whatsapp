"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Eye, Edit2, Trash2, X, Megaphone, CheckCircle, Clock, Users, Check, CheckCheck, XCircle, RefreshCw, Loader2, Phone } from "lucide-react";
import { getTemplates } from "../../services/templateService";
import { getContacts } from "../../services/contactService";
import { createCampaign, getCampaignAnalytics, getCampaignDetails, updateCampaign, deleteCampaign, getCampaignRecipients } from "../../services/campaignService";
import { getCampaigns } from "../../services/dashboardService";

const card = { background: "#ffffff", border: "1px solid #ece9f8", borderRadius: "14px", boxShadow: "0 1px 6px rgba(100,80,200,0.07)" };
const inputStyle = { background: "#f5f4fb", border: "1px solid #e0ddf5", color: "#1a1040", borderRadius: "10px", padding: "10px 14px", width: "100%", fontSize: "14px", outline: "none" };

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

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    completed: { bg: "rgba(16,185,129,0.12)", color: "#10b981" },
    running:   { bg: "rgba(245,158,11,0.12)", color: "#f59e0b" },
    scheduled: { bg: "rgba(124,58,237,0.10)", color: "#7c3aed" },
  };
  const s = map[status] ?? map.scheduled;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function CampaignsPage() {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [deliveryData, setDeliveryData] = useState<any>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [deliveryFilter, setDeliveryFilter] = useState<string>("all");
  const [templates, setTemplates] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState("");
  const [campaignData, setCampaignData] = useState({ campaign_name: "", template_id: "", contact_ids: [] as number[] });
  const [editData, setEditData] = useState({ campaign_name: "", template_id: "", contact_ids: [] as number[], id: null as number | null });

  const notify = (msg: string, type = "success") => { setStatusMsg(msg); setStatusType(type); setTimeout(() => { setStatusMsg(""); setStatusType(""); }, 3000); };
  const loadData = async () => {
    try {
      const res = await getCampaigns();
      // dashboardService returns a plain array
      setCampaigns(Array.isArray(res) ? res : res?.campaigns ?? []);
    } catch { }
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [temps, conts, camp] = await Promise.all([getTemplates(), getContacts(), getCampaigns()]);
        if (!alive) return;
        setTemplates(temps);
        setContacts(conts);
        setCampaigns(Array.isArray(camp) ? camp : camp?.campaigns ?? []);
      } catch { }
    })();
    return () => { alive = false; };
  }, []);

  const handleCreate = async () => {
    try {
      const result = await createCampaign({ ...campaignData, organization_id: 1 });
      if (result?.success === false) {
        notify(result?.error ?? result?.message ?? "Failed to create campaign.", "error");
        return;
      }
      notify("Campaign created!");
      setShowModal(false);
      setCampaignData({ campaign_name: "", template_id: "", contact_ids: [] });
      loadData();
    } catch (e: any) {
      notify(e?.message ?? "Failed to create campaign.", "error");
    }
  };
  const handleEditOpen = async (id: number) => {
    try { const d = await getCampaignDetails(id); if (d.success) { const c = d.campaign; setEditData({ campaign_name: c.campaign_name, template_id: c.template_id, contact_ids: c.contact_ids, id: c.id }); setShowEditModal(true); } } catch { }
  };
  const handleUpdate = async () => {
    try { const r = await updateCampaign(editData.id!, { campaign_name: editData.campaign_name, template_id: editData.template_id, contact_ids: editData.contact_ids }); if (r.success) { notify("Campaign updated!"); setShowEditModal(false); loadData(); } else { notify(r.error, "error"); } } catch { }
  };
  const handleDelete = async (id: number) => {
    try { const r = await deleteCampaign(id); if (r.success) { notify("Deleted!"); loadData(); } } catch { }
  };
  const handleViewAnalytics = async (id: number) => {
    try { setAnalytics(await getCampaignAnalytics(id)); setShowAnalytics(true); } catch { }
  };

  const handleViewDelivery = async (id: number) => {
    setDeliveryLoading(true);
    setDeliveryFilter("all");
    setShowDelivery(true);
    try {
      const data = await getCampaignRecipients(id);
      setDeliveryData(data);
    } catch { setDeliveryData(null); }
    finally { setDeliveryLoading(false); }
  };

  const handleRefreshDelivery = async () => {
    if (!deliveryData?.campaign_id) return;
    setDeliveryLoading(true);
    try { setDeliveryData(await getCampaignRecipients(deliveryData.campaign_id)); }
    catch { } finally { setDeliveryLoading(false); }
  };

  const completed = campaigns.filter(c => c.status === "completed").length;
  const running   = campaigns.filter(c => c.status === "running").length;
  const scheduled = campaigns.filter(c => c.status === "scheduled").length;

  const ContactCheckList = ({ data, setData }: { data: any; setData: any }) => (
    <div className="rounded-xl p-3 max-h-44 overflow-y-auto space-y-1" style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}>
      <p className="text-xs font-semibold mb-2" style={{ color: "#9390b5" }}>Select Contacts</p>
      {contacts.map(c => (
        <label key={c.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
          <input type="checkbox" className="accent-violet-500" checked={data.contact_ids.includes(c.id)}
            onChange={e => setData({ ...data, contact_ids: e.target.checked ? [...data.contact_ids, c.id] : data.contact_ids.filter((x: number) => x !== c.id) })} />
          <span className="text-sm" style={{ color: "#4b4880" }}>{c.name} — {c.phone_number}</span>
        </label>
      ))}
    </div>
  );

  const modalCard = { background: "#fff", border: "1px solid #ece9f8", boxShadow: "0 20px 60px rgba(100,80,200,0.15)" };

  return (
    <div className="p-6 space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>Campaigns</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>Manage WhatsApp broadcast campaigns</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
          style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
          <Plus size={14} /> New Campaign
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Megaphone}    title="Total Campaigns" value={campaigns.length} color="#7c3aed" bg="rgba(124,58,237,0.10)" />
        <StatCard icon={CheckCircle}  title="Completed"       value={completed}        color="#10b981" bg="rgba(16,185,129,0.10)" />
        <StatCard icon={Clock}        title="Scheduled"       value={scheduled}        color="#06b6d4" bg="rgba(6,182,212,0.10)"  />
        <StatCard icon={Users}        title="Running"         value={running}          color="#f59e0b" bg="rgba(245,158,11,0.10)" />
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr><th>Campaign</th><th>Status</th><th>Recipients</th><th>Contacts</th><th className="text-center">Actions</th></tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12" style={{ color: "#b0aed0" }}>No campaigns yet</td></tr>
            ) : campaigns.map(c => (
              <tr key={c.id}>
                <td>
                  <button
                    className="font-semibold text-left hover:underline"
                    style={{ color: "#1a1040" }}
                    onClick={() => handleViewDelivery(c.id)}
                  >
                    {c.name ?? c.campaign_name ?? "—"}
                  </button>
                </td>
                <td><StatusBadge status={c.status || "scheduled"} /></td>
                <td style={{ color: "#4b4880" }}>{c.total ?? "—"}</td>
                <td><span style={{ color: "#7c3aed" }}>{c.contact_count ?? "—"}</span></td>
                <td>
                  <div className="flex items-center justify-center gap-2">
                    {[{ Icon: Eye, fn: () => handleViewDelivery(c.id), col: "#06b6d4" }, { Icon: Edit2, fn: () => handleEditOpen(c.id), col: "#7c3aed" }, { Icon: Trash2, fn: () => handleDelete(c.id), col: "#f43f5e" }].map(({ Icon, fn, col }, k) => (
                      <button key={k} onClick={fn} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                        style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                        onMouseEnter={e => (e.currentTarget.style.background = col + "15")}
                        onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}>
                        <Icon size={13} style={{ color: col }} />
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showModal && typeof document !== "undefined" && createPortal(
        <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px", background:"rgba(26,16,64,0.45)", backdropFilter:"blur(6px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={modalCard}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>Create Campaign</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9390b5" }}><X size={18} /></button>
            </div>
            <input placeholder="Campaign Name" value={campaignData.campaign_name} onChange={e => setCampaignData({ ...campaignData, campaign_name: e.target.value })} className="placeholder:text-[#c0bed8] focus:outline-none" style={inputStyle} />
            <select value={campaignData.template_id} onChange={e => setCampaignData({ ...campaignData, template_id: e.target.value })} className="focus:outline-none" style={inputStyle}>
              <option value="">Select Template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
            </select>
            <ContactCheckList data={campaignData} setData={setCampaignData} />
            <p className="text-xs" style={{ color: "#9390b5" }}>Selected: {campaignData.contact_ids.length} contacts</p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>Cancel</button>
              <button onClick={handleCreate} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>Create</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {showEditModal && typeof document !== "undefined" && createPortal(
        <div style={{ position:"fixed", inset:0, zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:"16px", background:"rgba(26,16,64,0.45)", backdropFilter:"blur(6px)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={modalCard}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>Edit Campaign</h2>
              <button onClick={() => setShowEditModal(false)} style={{ color: "#9390b5" }}><X size={18} /></button>
            </div>
            <input placeholder="Campaign Name" value={editData.campaign_name} onChange={e => setEditData({ ...editData, campaign_name: e.target.value })} className="placeholder:text-[#c0bed8] focus:outline-none" style={inputStyle} />
            <select value={editData.template_id} onChange={e => setEditData({ ...editData, template_id: e.target.value })} className="focus:outline-none" style={inputStyle}>
              <option value="">Select Template</option>
              {templates.filter(t => (t.status || t.meta_status || "").toUpperCase() === "APPROVED").map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
            </select>
            <ContactCheckList data={editData} setData={setEditData} />
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>Cancel</button>
              <button onClick={handleUpdate} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>Update</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delivery Report Modal — rendered into document.body to escape overflow:hidden parents */}
      {showDelivery && typeof document !== "undefined" && createPortal(
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            zIndex: 9999,
            background: "rgba(26,16,64,0.55)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "center",
            paddingTop: "72px",
            paddingLeft: "16px",
            paddingRight: "16px",
            paddingBottom: "24px",
            boxSizing: "border-box",
            overflowY: "auto",
          }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowDelivery(false); setDeliveryData(null); } }}
        >
          <div style={{
            width: "100%",
            maxWidth: "880px",
            background: "#fff",
            border: "1px solid #ece9f8",
            boxShadow: "0 24px 80px rgba(100,80,200,0.25)",
            borderRadius: "20px",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            flexShrink: 0,
          }}>

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: "1px solid #f0eefb" }}>
              <div>
                <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>
                  {deliveryLoading ? "Loading…" : deliveryData?.campaign_name ?? "Delivery Report"}
                </h2>
                {deliveryData && (
                  <p className="text-xs mt-0.5" style={{ color: "#9390b5" }}>
                    Template: <span style={{ color: "#7c3aed" }}>{deliveryData.template_name ?? "—"}</span>
                    {deliveryData.created_at && (
                      <> · {new Date(deliveryData.created_at).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}</>
                    )}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={handleRefreshDelivery} disabled={deliveryLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ background: "#f5f4fb", color: "#7c3aed", border: "1px solid #e0ddf5" }}>
                  {deliveryLoading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Refresh
                </button>
                <button onClick={() => { setShowDelivery(false); setDeliveryData(null); }} style={{ color: "#9390b5" }}>
                  <X size={18} />
                </button>
              </div>
            </div>

            {deliveryLoading && !deliveryData ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-6 w-6 animate-spin" style={{ color: "#7c3aed" }} />
              </div>
            ) : deliveryData ? (
              <>
                {/* Summary cards */}
                {(() => {
                  const s = deliveryData.summary ?? {};
                  const total = s.total || 1;
                  const cards = [
                    { label: "Total Sent",  value: s.total,     icon: Users,      color: "#7c3aed", bg: "rgba(124,58,237,0.08)", filter: "all",       desc: "All recipients" },
                    { label: "Delivered",   value: s.delivered, icon: CheckCheck, color: "#06b6d4", bg: "rgba(6,182,212,0.08)",  filter: "delivered", desc: "Double grey tick" },
                    { label: "Read",        value: s.read,      icon: CheckCheck, color: "#10b981", bg: "rgba(16,185,129,0.08)", filter: "read",      desc: "Blue ticks" },
                    { label: "Sent (1 ✓)",  value: s.sent,      icon: Check,      color: "#f59e0b", bg: "rgba(245,158,11,0.08)", filter: "sent",      desc: "Single grey tick" },
                    { label: "Failed",      value: s.failed,    icon: XCircle,    color: "#f43f5e", bg: "rgba(239,68,68,0.08)",  filter: "failed",    desc: "Not delivered" },
                  ];
                  return (
                    <div className="px-6 py-4 grid grid-cols-5 gap-3 flex-shrink-0" style={{ borderBottom: "1px solid #f0eefb" }}>
                      {cards.map(({ label, value, icon: Icon, color, bg, filter, desc }) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setDeliveryFilter(filter)}
                          className="rounded-2xl p-3 text-left transition-all"
                          style={{
                            background: deliveryFilter === filter ? bg : "#fafafa",
                            border: `1.5px solid ${deliveryFilter === filter ? color + "40" : "#f0eefb"}`,
                            boxShadow: deliveryFilter === filter ? `0 2px 10px ${color}18` : "none",
                          }}
                        >
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ background: bg }}>
                              <Icon size={12} style={{ color }} />
                            </div>
                            {value !== undefined && value > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: color + "15", color }}>
                                {Math.round((value / total) * 100)}%
                              </span>
                            )}
                          </div>
                          <p className="text-[18px] font-bold tabular-nums" style={{ color: "#1a1040" }}>{value ?? 0}</p>
                          <p className="text-[11px] font-semibold" style={{ color: "#4b4880" }}>{label}</p>
                          <p className="text-[10px]" style={{ color: "#b0aed0" }}>{desc}</p>
                        </button>
                      ))}
                    </div>
                  );
                })()}

                {/* Filter tabs */}
                <div className="px-6 py-3 flex items-center gap-2 flex-shrink-0" style={{ borderBottom: "1px solid #f0eefb" }}>
                  <span className="text-xs font-medium mr-1" style={{ color: "#9390b5" }}>Filter:</span>
                  {[
                    { key: "all",       label: "All" },
                    { key: "read",      label: "Seen (🔵)" },
                    { key: "delivered", label: "Delivered (✓✓)" },
                    { key: "sent",      label: "Sent (✓)" },
                    { key: "failed",    label: "Failed" },
                  ].map(({ key, label }) => {
                    const count = key === "all"
                      ? deliveryData.summary?.total
                      : deliveryData.summary?.[key];
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setDeliveryFilter(key)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background: deliveryFilter === key ? "#7c3aed" : "#f5f4fb",
                          color: deliveryFilter === key ? "#fff" : "#4b4880",
                          border: deliveryFilter === key ? "none" : "1px solid #e0ddf5",
                        }}
                      >
                        {label}
                        {count !== undefined && (
                          <span className="ml-1 min-w-[18px] h-4 flex items-center justify-center rounded-full text-[10px] font-bold px-1"
                            style={{ background: deliveryFilter === key ? "rgba(255,255,255,0.25)" : "#ede9fe", color: deliveryFilter === key ? "#fff" : "#7c3aed" }}>
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Recipients table */}
                <div className="overflow-y-auto" style={{ maxHeight: "340px" }}>
                  {(() => {
                    const all: any[] = deliveryData.recipients ?? [];
                    const filtered = deliveryFilter === "all" ? all : all.filter((r: any) => r.status === deliveryFilter);

                    const statusCfg: Record<string, { label: string; color: string; bg: string; icon: any; desc: string }> = {
                      read:      { label: "Seen",      color: "#10b981", bg: "rgba(16,185,129,0.10)", icon: CheckCheck, desc: "Customer opened the message" },
                      delivered: { label: "Delivered", color: "#06b6d4", bg: "rgba(6,182,212,0.10)",  icon: CheckCheck, desc: "Reached device, not yet seen" },
                      sent:      { label: "Sent",      color: "#f59e0b", bg: "rgba(245,158,11,0.10)", icon: Check,      desc: "Sent, waiting for delivery" },
                      failed:    { label: "Failed",    color: "#f43f5e", bg: "rgba(239,68,68,0.10)",  icon: XCircle,    desc: "Could not be delivered" },
                      pending:   { label: "Pending",   color: "#9390b5", bg: "rgba(147,144,181,0.10)",icon: Clock,      desc: "Queued, not yet sent" },
                    };

                    if (filtered.length === 0) return (
                      <div className="flex flex-col items-center justify-center py-14 gap-2">
                        <Users className="h-8 w-8" style={{ color: "#e0ddf5" }} />
                        <p className="text-sm" style={{ color: "#b0aed0" }}>No contacts in this category</p>
                      </div>
                    );

                    return (
                      <table className="w-full">
                        <thead>
                          <tr style={{ borderBottom: "1px solid #f0eefb", background: "#fafafa" }}>
                            {["Contact", "Phone", "Status", "Message ID", "Sent At"].map(h => (
                              <th key={h} className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-wider" style={{ color: "#9390b5" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((r: any, i: number) => {
                            const cfg = statusCfg[r.status] ?? statusCfg.sent;
                            const StatusIcon = cfg.icon;
                            const initials = (r.contact_name ?? r.phone_number ?? "?")
                              .split(" ").map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
                            return (
                              <tr key={i} style={{ borderBottom: "1px solid #f9f8ff" }}
                                onMouseEnter={e => (e.currentTarget.style.background = "#faf9ff")}
                                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                                <td className="px-5 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                      style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                                      {initials}
                                    </div>
                                    <span className="font-medium text-sm" style={{ color: "#1a1040" }}>
                                      {r.contact_name ?? "Unknown"}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-5 py-3">
                                  <span className="flex items-center gap-1.5 text-sm" style={{ color: "#4b4880" }}>
                                    <Phone size={11} style={{ color: "#25d366" }} />
                                    {r.phone_number}
                                  </span>
                                </td>
                                <td className="px-5 py-3">
                                  <div className="flex flex-col gap-0.5">
                                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold w-fit"
                                      style={{ background: cfg.bg, color: cfg.color }}>
                                      <StatusIcon size={11}
                                        style={{ color: r.status === "read" ? "#10b981" : cfg.color }}
                                        className={r.status === "read" ? "" : ""}
                                      />
                                      {cfg.label}
                                    </span>
                                    <span className="text-[10px]" style={{ color: "#b0aed0" }}>{cfg.desc}</span>
                                  </div>
                                </td>
                                <td className="px-5 py-3">
                                  {r.message_id ? (
                                    <span className="text-[11px] font-mono px-2 py-0.5 rounded" style={{ background: "#f5f4fb", color: "#7c3aed" }}>
                                      {r.message_id.slice(0, 20)}…
                                    </span>
                                  ) : (
                                    <span style={{ color: "#c0bed8" }}>—</span>
                                  )}
                                </td>
                                <td className="px-5 py-3 text-xs" style={{ color: "#9390b5" }}>
                                  {r.sent_at ? new Date(r.sent_at).toLocaleString(undefined, {
                                    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                                  }) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                </div>

                {/* Footer */}
                <div className="px-6 py-3 flex-shrink-0 flex items-center justify-between" style={{ borderTop: "1px solid #f0eefb" }}>
                  <p className="text-xs" style={{ color: "#b0aed0" }}>
                    Showing {deliveryFilter === "all" ? "all" : deliveryFilter} · {
                      deliveryFilter === "all"
                        ? deliveryData.summary?.total
                        : (deliveryData.summary?.[deliveryFilter] ?? 0)
                    } contacts
                  </p>
                  <p className="text-xs" style={{ color: "#b0aed0" }}>
                    Delivery rate: <span className="font-semibold" style={{ color: "#10b981" }}>
                      {deliveryData.summary?.total > 0
                        ? (((deliveryData.summary.delivered + deliveryData.summary.read) / deliveryData.summary.total) * 100).toFixed(1)
                        : 0}%
                    </span>
                  </p>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center py-16 text-sm" style={{ color: "#b0aed0" }}>
                No delivery data available.
              </div>
            )}
          </div>
        </div>,
        document.body
      )}

      {statusMsg && (
        <div className="fixed bottom-5 right-5 px-5 py-3 rounded-xl text-sm font-semibold text-white shadow-xl z-50"
          style={{ background: statusType === "success" ? "linear-gradient(135deg,#059669,#10b981)" : "linear-gradient(135deg,#e11d48,#f43f5e)" }}>
          {statusMsg}
        </div>
      )}
    </div>
  );
}
