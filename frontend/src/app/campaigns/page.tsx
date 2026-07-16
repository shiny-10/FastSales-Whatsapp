"use client";
import { useEffect, useState } from "react";
import { Plus, Eye, Edit2, Trash2, X, Megaphone, CheckCircle, Clock, Users } from "lucide-react";
import { getOrganizations } from "../../services/organizationService";
import { getTemplates } from "../../services/templateService";
import { getContacts } from "../../services/contactService";
import { createCampaign, getCampaignAnalytics, getCampaignDetails, updateCampaign, deleteCampaign } from "../../services/campaignService";
import { getCampaigns } from "../../services/dashboardService";

const glass = { background: "linear-gradient(145deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.015) 100%)", border: "1px solid rgba(255,255,255,0.08)" };
const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "white", borderRadius: "10px", padding: "10px 14px", width: "100%", fontSize: "14px", outline: "none" };

function StatCard({ icon: Icon, title, value, color }: any) {
  return (
    <div className="rounded-2xl p-5 hover-lift" style={{ ...glass, position: "relative", overflow: "hidden" }}>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-15 blur-xl pointer-events-none" style={{ background: color }} />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>{title}</p>
          <p className="text-3xl font-bold text-white tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: color + "33" }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    completed: { bg: "rgba(16,185,129,0.15)", color: "#10b981" },
    running: { bg: "rgba(245,158,11,0.15)", color: "#f59e0b" },
    scheduled: { bg: "rgba(99,102,241,0.15)", color: "#818cf8" },
  };
  const s = map[status] ?? map.scheduled;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ background: s.bg, color: s.color }}>
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: s.color }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export default function CampaignsPage() {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [statusType, setStatusType] = useState("");
  const [campaignData, setCampaignData] = useState({ campaign_name: "", organization_id: "", template_id: "", contact_ids: [] as number[] });
  const [editData, setEditData] = useState({ campaign_name: "", template_id: "", contact_ids: [] as number[], id: null as number | null });

  const notify = (msg: string, type = "success") => { setStatusMsg(msg); setStatusType(type); setTimeout(() => { setStatusMsg(""); setStatusType(""); }, 3000); };
  const loadData = async () => { try { setCampaigns(await getCampaigns()); } catch { /* ignore */ } };

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [orgs, temps, conts, camp] = await Promise.all([getOrganizations(), getTemplates(), getContacts(), getCampaigns()]);
        if (!alive) return;
        setOrganizations(orgs); setTemplates(temps); setContacts(conts); setCampaigns(camp);
      } catch { /* ignore */ }
    })();
    return () => { alive = false; };
  }, []);

  const handleCreate = async () => {
    try { await createCampaign(campaignData); notify("Campaign created!"); setShowModal(false); setCampaignData({ campaign_name: "", organization_id: "", template_id: "", contact_ids: [] }); loadData(); } catch { /* ignore */ }
  };
  const handleEditOpen = async (id: number) => {
    try { const d = await getCampaignDetails(id); if (d.success) { const c = d.campaign; setEditData({ campaign_name: c.campaign_name, template_id: c.template_id, contact_ids: c.contact_ids, id: c.id }); setShowEditModal(true); } } catch { /* ignore */ }
  };
  const handleUpdate = async () => {
    try { const r = await updateCampaign(editData.id!, { campaign_name: editData.campaign_name, template_id: editData.template_id, contact_ids: editData.contact_ids }); if (r.success) { notify("Campaign updated!"); setShowEditModal(false); loadData(); } else { notify(r.error, "error"); } } catch { /* ignore */ }
  };
  const handleDelete = async (id: number) => {
    try { const r = await deleteCampaign(id); if (r.success) { notify("Deleted!"); loadData(); } } catch { /* ignore */ }
  };
  const handleViewAnalytics = async (id: number) => {
    try { setAnalytics(await getCampaignAnalytics(id)); setShowAnalytics(true); } catch { /* ignore */ }
  };

  const completed = campaigns.filter(c => c.status === "completed").length;
  const running = campaigns.filter(c => c.status === "running").length;
  const scheduled = campaigns.filter(c => c.status === "scheduled").length;

  const ContactCheckList = ({ data, setData }: { data: any; setData: any }) => (
    <div className="rounded-xl p-3 max-h-44 overflow-y-auto space-y-1" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <p className="text-xs font-semibold mb-2" style={{ color: "rgba(255,255,255,0.45)" }}>Select Contacts</p>
      {contacts.map(c => (
        <label key={c.id} className="flex items-center gap-2.5 py-1.5 cursor-pointer">
          <input type="checkbox" className="accent-violet-500" checked={data.contact_ids.includes(c.id)}
            onChange={e => setData({ ...data, contact_ids: e.target.checked ? [...data.contact_ids, c.id] : data.contact_ids.filter((x: number) => x !== c.id) })} />
          <span className="text-sm" style={{ color: "rgba(255,255,255,0.7)" }}>{c.name} — {c.phone_number}</span>
        </label>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Campaigns</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Manage WhatsApp broadcast campaigns</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-glow flex items-center gap-2 text-sm"><Plus size={15} /> New Campaign</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Megaphone} title="Total Campaigns" value={campaigns.length} color="#7c3aed" />
        <StatCard icon={CheckCircle} title="Completed" value={completed} color="#10b981" />
        <StatCard icon={Clock} title="Scheduled" value={scheduled} color="#06b6d4" />
        <StatCard icon={Users} title="Running" value={running} color="#f59e0b" />
      </div>

      <div className="rounded-2xl overflow-hidden" style={glass}>
        <table className="data-table">
          <thead>
            <tr><th>Campaign</th><th>Status</th><th>Recipients</th><th>Contacts</th><th className="text-center">Actions</th></tr>
          </thead>
          <tbody>
            {campaigns.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12" style={{ color: "rgba(255,255,255,0.25)" }}>No campaigns yet</td></tr>
            ) : campaigns.map(c => (
              <tr key={c.id}>
                <td><span className="text-white font-medium">{c.name ?? c.campaign_name ?? "—"}</span></td>
                <td><StatusBadge status={c.status || "scheduled"} /></td>
                <td>{c.total ?? "—"}</td>
                <td><span style={{ color: "#a78bfa" }}>{c.contact_count ?? "—"}</span></td>
                <td>
                  <div className="flex items-center justify-center gap-2">
                    {[{ Icon: Eye, fn: () => handleViewAnalytics(c.id), col: "#06b6d4" }, { Icon: Edit2, fn: () => handleEditOpen(c.id), col: "#a78bfa" }, { Icon: Trash2, fn: () => handleDelete(c.id), col: "#f43f5e" }].map(({ Icon, fn, col }, k) => (
                      <button key={k} onClick={fn} className="w-8 h-8 flex items-center justify-center rounded-lg"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = col + "22")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}>
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
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#13162b", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Create Campaign</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={18} /></button>
            </div>
            <input placeholder="Campaign Name" value={campaignData.campaign_name} onChange={e => setCampaignData({ ...campaignData, campaign_name: e.target.value })} className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none" style={inputStyle} />
            <select value={campaignData.organization_id} onChange={e => setCampaignData({ ...campaignData, organization_id: e.target.value })} className="focus:outline-none" style={inputStyle}>
              <option value="">Select Organization</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select value={campaignData.template_id} onChange={e => setCampaignData({ ...campaignData, template_id: e.target.value })} className="focus:outline-none" style={inputStyle}>
              <option value="">Select Template</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
            </select>
            <ContactCheckList data={campaignData} setData={setCampaignData} />
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Selected: {campaignData.contact_ids.length} contacts</p>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
              <button onClick={handleCreate} className="btn-glow text-sm px-5 py-2.5">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#13162b", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">Edit Campaign</h2>
              <button onClick={() => setShowEditModal(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={18} /></button>
            </div>
            <input placeholder="Campaign Name" value={editData.campaign_name} onChange={e => setEditData({ ...editData, campaign_name: e.target.value })} className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none" style={inputStyle} />
            <select value={editData.template_id} onChange={e => setEditData({ ...editData, template_id: e.target.value })} className="focus:outline-none" style={inputStyle}>
              <option value="">Select Template</option>
              {templates.filter(t => (t.status || t.meta_status || "").toUpperCase() === "APPROVED").map(t => <option key={t.id} value={t.id}>{t.template_name}</option>)}
            </select>
            <ContactCheckList data={editData} setData={setEditData} />
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShowEditModal(false)} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
              <button onClick={handleUpdate} className="btn-glow text-sm px-5 py-2.5">Update</button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Modal */}
      {showAnalytics && analytics && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6" style={{ background: "#13162b", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold text-white">Campaign Analytics</h2>
              <button onClick={() => setShowAnalytics(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {[["Campaign", analytics.campaign_name], ["Total Contacts", analytics.contact_count], ["Recipients", analytics.total_recipients], ["Sent", analytics.sent], ["Delivered", analytics.delivered], ["Read", analytics.read], ["Failed", analytics.failed]].map(([k, v]) => (
                <div key={k as string} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.45)" }}>{k}</span>
                  <span className={`text-sm font-semibold ${k === "Failed" ? "text-rose-400" : "text-white"}`}>{v}</span>
                </div>
              ))}
              <div className="flex justify-between pt-2">
                <span className="text-sm font-medium text-white">Delivery Rate</span>
                <span className="text-sm font-bold" style={{ color: "#10b981" }}>
                  {(analytics.total_messages ?? analytics.total_recipients) > 0 ? (((analytics.delivered / (analytics.total_messages ?? analytics.total_recipients)) * 100).toFixed(1)) : 0}%
                </span>
              </div>
            </div>
          </div>
        </div>
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
