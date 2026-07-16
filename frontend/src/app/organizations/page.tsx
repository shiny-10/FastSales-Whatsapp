"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { getOrganizations, getOrganization, createOrganization, updateOrganization, deleteOrganization } from "../../services/organizationService";
import { getDashboardSummary } from "../../services/dashboardService";
import { Plus, Eye, Edit2, Trash2, Search, Building2, CheckCircle, Users, Megaphone, X } from "lucide-react";

const glass = { background: "linear-gradient(145deg,rgba(255,255,255,0.055) 0%,rgba(255,255,255,0.015) 100%)", border: "1px solid rgba(255,255,255,0.08)" };
const inputStyle = { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.09)", color: "white", borderRadius: "10px", padding: "10px 14px", width: "100%", fontSize: "14px", outline: "none" };

function StatCard({ icon: Icon, title, value, delta, color }: any) {
  return (
    <div className="rounded-2xl p-5 hover-lift" style={{ ...glass, position: "relative", overflow: "hidden" }}>
      <div className="absolute -right-4 -top-4 w-20 h-20 rounded-full opacity-15 blur-xl pointer-events-none" style={{ background: color }} />
      <div className="flex items-start justify-between relative">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "rgba(255,255,255,0.35)" }}>{title}</p>
          <p className="text-3xl font-bold text-white tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
          {delta && <p className="text-xs mt-2" style={{ color: "#10b981" }}>↑ {delta}</p>}
        </div>
        <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: color + "33" }}>
          <Icon size={18} style={{ color }} />
        </div>
      </div>
    </div>
  );
}

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [filters, setFilters] = useState({ q: "", status: "all", sort: "newest" });
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("add");
  const [selectedOrg, setSelectedOrg] = useState<any>(null);
  const [formData, setFormData] = useState({ name: "", email: "", industry: "", status: "Active" });
  const [summary, setSummary] = useState({ total_contacts: 0, total_campaigns: 0 });
  const [loading, setLoading] = useState(true);

  const loadOrganizations = useCallback(async () => {
    setLoading(true);
    try { setOrganizations(await getOrganizations(filters) || []); } catch { /* ignore */ } finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { loadOrganizations(); }, [loadOrganizations]);
  useEffect(() => {
    getDashboardSummary().then(d => setSummary({ total_contacts: d.total_contacts, total_campaigns: d.total_campaigns })).catch(() => { });
  }, []);

  const openAddModal = () => { setModalMode("add"); setSelectedOrg(null); setFormData({ name: "", email: "", industry: "", status: "Active" }); setShowModal(true); };
  const openEditModal = async (id: any) => {
    try { const o = await getOrganization(id); setModalMode("edit"); setSelectedOrg(o); setFormData({ name: o.name || "", email: o.email || "", industry: o.industry || "", status: o.status || "Active" }); setShowModal(true); } catch { /* ignore */ }
  };
  const openViewModal = async (id: any) => {
    try { const o = await getOrganization(id); setModalMode("view"); setSelectedOrg(o); setFormData({ name: o.name || "", email: o.email || "", industry: o.industry || "", status: o.status || "Active" }); setShowModal(true); } catch { /* ignore */ }
  };
  const handleSave = async () => {
    if (!formData.name.trim()) return;
    try { if (modalMode === "edit" && selectedOrg) { await updateOrganization(selectedOrg.id, formData); } else { await createOrganization(formData); } setShowModal(false); loadOrganizations(); } catch { /* ignore */ }
  };
  const handleDelete = async (id: any) => {
    if (!confirm("Delete organization?")) return;
    try { await deleteOrganization(id); loadOrganizations(); } catch { /* ignore */ }
  };

  const active = organizations.filter(o => (o.status || "").toLowerCase() === "active").length;

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Organizations</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Manage your business organizations</p>
        </div>
        <button onClick={openAddModal} className="btn-glow flex items-center gap-2 text-sm"><Plus size={15} /> Add Organization</button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Building2} title="Total Organizations" value={organizations.length} delta="20% this month" color="#7c3aed" />
        <StatCard icon={CheckCircle} title="Active" value={active} delta="16.7% this month" color="#10b981" />
        <StatCard icon={Users} title="Total Contacts" value={summary.total_contacts} delta="18.4% this month" color="#06b6d4" />
        <StatCard icon={Megaphone} title="Total Campaigns" value={summary.total_campaigns} delta="12.5% this month" color="#f59e0b" />
      </div>

      {/* Search + filters */}
      <div className="rounded-2xl p-4 flex flex-wrap items-center gap-3" style={glass}>
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
          <input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value })} placeholder="Search organizations…"
            className="pl-9 pr-4 py-2 text-sm rounded-xl w-full focus:outline-none placeholder:text-[rgba(255,255,255,0.2)]"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }} />
        </div>
        {[{ key: "status", opts: [["all", "All Status"], ["Active", "Active"], ["Inactive", "Inactive"]] }, { key: "sort", opts: [["newest", "Newest"], ["oldest", "Oldest"]] }].map(({ key, opts }) => (
          <select key={key} value={(filters as any)[key]} onChange={e => setFilters({ ...filters, [key]: e.target.value })}
            className="px-3 py-2 text-sm rounded-xl focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
            {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={glass}>
        <table className="data-table">
          <thead>
            <tr><th>Organization</th><th>Industry</th><th>Contacts</th><th>Campaigns</th><th>Status</th><th>Created</th><th className="text-center">Actions</th></tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: "rgba(255,255,255,0.3)" }}>Loading…</td></tr>
            ) : organizations.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12" style={{ color: "rgba(255,255,255,0.25)" }}>No organizations found</td></tr>
            ) : organizations.map(o => (
              <tr key={o.id}>
                <td>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                      style={{ background: "linear-gradient(135deg,#10b981,#059669)" }}>
                      {(o.name || "?").split(" ").map((p: string) => p[0]).slice(0, 2).join("")}
                    </div>
                    <div>
                      <p className="text-white font-medium text-sm">{o.name}</p>
                      <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{o.email || "—"}</p>
                    </div>
                  </div>
                </td>
                <td>{o.industry || "—"}</td>
                <td>{o.contacts_count ?? "—"}</td>
                <td>{o.campaigns_count ?? "—"}</td>
                <td>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                    style={{ background: o.status === "Active" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.06)", color: o.status === "Active" ? "#10b981" : "rgba(255,255,255,0.45)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: o.status === "Active" ? "#10b981" : "rgba(255,255,255,0.3)" }} />
                    {o.status || "Active"}
                  </span>
                </td>
                <td>{o.created_at ? new Date(o.created_at).toLocaleDateString() : "—"}</td>
                <td>
                  <div className="flex items-center justify-center gap-2">
                    {[{ Icon: Eye, fn: () => openViewModal(o.id), c: "#06b6d4" }, { Icon: Edit2, fn: () => openEditModal(o.id), c: "#a78bfa" }, { Icon: Trash2, fn: () => handleDelete(o.id), c: "#f43f5e" }].map(({ Icon, fn, c }, k) => (
                      <button key={k} onClick={fn} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                        onMouseEnter={e => (e.currentTarget.style.background = c + "22")}
                        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}>
                        <Icon size={13} style={{ color: c }} />
                      </button>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-lg rounded-2xl p-6 space-y-4" style={{ background: "#13162b", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">{modalMode === "edit" ? "Edit Organization" : modalMode === "view" ? "View Organization" : "Add Organization"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[["name", "Organization Name", "text"], ["email", "Email Address", "email"], ["industry", "Industry", "text"]].map(([key, ph, type]) => (
                <input key={key} type={type} placeholder={ph as string} value={(formData as any)[key as string]}
                  onChange={e => setFormData({ ...formData, [key]: e.target.value })} disabled={modalMode === "view"}
                  className={`placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none ${key === "industry" ? "col-span-2" : ""}`}
                  style={inputStyle} />
              ))}
              <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} disabled={modalMode === "view"}
                className="col-span-2 focus:outline-none" style={inputStyle}>
                <option>Active</option><option>Inactive</option>
              </select>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>Close</button>
              {modalMode !== "view" && <button onClick={handleSave} className="btn-glow text-sm px-5 py-2.5">Save</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
