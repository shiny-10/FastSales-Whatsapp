"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, Eye, Edit2, Trash2, Filter, Users, CheckCircle, CalendarDays, Tag, Upload, X, Phone } from "lucide-react";
import { getContacts, createContact, updateContact, deleteContactApi, importContacts } from "../../services/contactService";
import { getOrganizations } from "../../services/organizationService";

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

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [filters, setFilters] = useState({ organization_id: "all", status: "all" });
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewContact, setViewContact] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", organization_id: "", status: "Active" });

  const loadOrganizations = useCallback(async () => {
    try { setOrganizations(await getOrganizations() || []); } catch { /* ignore */ }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const data = await getContacts({ q: searchTerm, organization_id: filters.organization_id, status: filters.status });
      setContacts(data.map((c: any) => ({ id: c.id, name: c.name, email: c.email || "", phone: c.phone_number, organization_id: c.organization_id ?? null, organization: c.organization_name || "—", status: c.status || "Active", created_at: c.created_at })));
    } catch { /* ignore */ }
  }, [filters, searchTerm]);

  useEffect(() => { loadOrganizations(); }, [loadOrganizations]);
  useEffect(() => { const t = setTimeout(loadContacts, 200); return () => clearTimeout(t); }, [loadContacts]);

  const total = contacts.length;
  const active = contacts.filter(c => (c.status || "").toLowerCase() === "active").length;
  const thisMonth = contacts.filter(c => { try { const d = new Date(c.created_at), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); } catch { return false; } }).length;

  const handleSave = async () => {
    if (!newContact.name || !newContact.phone) { alert("Name and Phone required"); return; }
    try {
      if (editingIndex !== null) { await updateContact(contacts[editingIndex].id, newContact); setEditingIndex(null); }
      else { await createContact(newContact); }
      await loadContacts();
      setNewContact({ name: "", phone: "", email: "", organization_id: "", status: "Active" });
      setShowModal(false);
    } catch { alert("Failed to save contact"); }
  };

  const handleDelete = async (id: any) => {
    try { await deleteContactApi(id); loadContacts(); } catch { alert("Failed to delete"); }
  };

  const handleEdit = (index: number) => { setNewContact(contacts[index]); setEditingIndex(index); setShowModal(true); };

  const handleImport = async (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const result = await importContacts(file);
      if (!result.success) { alert(`Import failed: ${result.message || result.error}`); return; }
      await loadContacts();
    } catch { alert("Failed to import"); } finally { e.target.value = null; }
  };

  return (
    <div className="min-h-screen p-6 space-y-6 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Contacts</h1>
          <p className="text-sm mt-1" style={{ color: "rgba(255,255,255,0.4)" }}>Manage all WhatsApp contacts</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
            style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.7)" }}>
            <Upload size={15} /> Import
          </button>
          <button onClick={() => setShowModal(true)} className="btn-glow flex items-center gap-2 text-sm">
            <Plus size={15} /> Add Contact
          </button>
          <input type="file" accept=".csv,.xlsx" ref={fileInputRef} onChange={handleImport} className="hidden" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users} title="Total Contacts" value={total} delta="18.4% this month" color="#7c3aed" />
        <StatCard icon={CheckCircle} title="Active" value={active} delta="16.7% this month" color="#10b981" />
        <StatCard icon={CalendarDays} title="This Month" value={thisMonth} delta="12.1% this month" color="#06b6d4" />
        <StatCard icon={Tag} title="Groups" value="—" color="#f59e0b" />
      </div>

      {/* Table card */}
      <div className="rounded-2xl overflow-hidden" style={glass}>
        {/* Toolbar */}
        <div className="px-5 py-4 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "rgba(255,255,255,0.3)" }} />
            <input type="text" placeholder="Search contacts…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-xl w-full focus:outline-none placeholder:text-[rgba(255,255,255,0.2)]"
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }} />
          </div>
          <select value={filters.organization_id} onChange={e => setFilters({ ...filters, organization_id: e.target.value })}
            className="px-3 py-2 text-sm rounded-xl focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
            <option value="all">All Organizations</option>
            {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 text-sm rounded-xl focus:outline-none"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.7)" }}>
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button onClick={() => setFilters({ organization_id: "all", status: "all" })}
            className="px-3 py-2 text-sm rounded-xl transition-colors" style={{ background: "rgba(255,255,255,0.04)", color: "rgba(255,255,255,0.4)", border: "1px solid rgba(255,255,255,0.07)" }}>
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contact</th><th>Phone</th><th>Organization</th><th>Status</th><th>Added</th><th className="text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c, i) => (
                <tr key={c.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                        style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)" }}>
                        {c.name.split(" ").map((p: string) => p[0]).slice(0, 2).join("")}
                      </div>
                      <div>
                        <p className="text-white font-medium text-sm">{c.name}</p>
                        <p className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: "rgba(255,255,255,0.6)" }}>
                      <Phone size={12} style={{ color: "#25d366" }} />{c.phone}
                    </span>
                  </td>
                  <td>{c.organization}</td>
                  <td>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: c.status === "Active" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.07)", color: c.status === "Active" ? "#10b981" : "rgba(255,255,255,0.45)" }}>
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: c.status === "Active" ? "#10b981" : "rgba(255,255,255,0.3)" }} />
                      {c.status}
                    </span>
                  </td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      {[{ Icon: Eye, fn: () => setViewContact(c), color: "#06b6d4" }, { Icon: Edit2, fn: () => handleEdit(i), color: "#a78bfa" }, { Icon: Trash2, fn: () => handleDelete(c.id), color: "#f43f5e" }].map(({ Icon, fn, color }, k) => (
                        <button key={k} onClick={fn} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}
                          onMouseEnter={e => (e.currentTarget.style.background = color + "22")}
                          onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.05)")}>
                          <Icon size={13} style={{ color }} />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr><td colSpan={6} className="text-center py-12" style={{ color: "rgba(255,255,255,0.25)" }}>No contacts found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "#13162b", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">{editingIndex !== null ? "Edit Contact" : "Add Contact"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={18} /></button>
            </div>
            {[{ ph: "Full Name", key: "name", type: "text" }, { ph: "919876543210  (no + or spaces)", key: "phone", type: "text" }, { ph: "Email Address", key: "email", type: "email" }].map(({ ph, key, type }) => (
              <input key={key} type={type} placeholder={ph} value={(newContact as any)[key]}
                onChange={e => setNewContact({ ...newContact, [key]: e.target.value })}
                className="placeholder:text-[rgba(255,255,255,0.2)] focus:outline-none"
                style={inputStyle} />
            ))}
            <select value={newContact.organization_id} onChange={e => setNewContact({ ...newContact, organization_id: e.target.value })}
              className="focus:outline-none" style={inputStyle}>
              <option value="">Select Organization</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
            <select value={newContact.status} onChange={e => setNewContact({ ...newContact, status: e.target.value })}
              className="focus:outline-none" style={inputStyle}>
              <option>Active</option><option>Inactive</option>
            </select>
            <div className="flex justify-end gap-3 pt-2">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm"
                style={{ background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>Cancel</button>
              <button onClick={handleSave} className="btn-glow text-sm px-5 py-2.5">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#13162b", border: "1px solid rgba(255,255,255,0.1)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-xl font-semibold text-white">Contact Details</h2>
              <button onClick={() => setViewContact(null)} style={{ color: "rgba(255,255,255,0.4)" }}><X size={18} /></button>
            </div>
            <div className="space-y-3">
              {[["Name", viewContact.name], ["Phone", viewContact.phone], ["Email", viewContact.email || "—"], ["Organization", viewContact.organization], ["Status", viewContact.status]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                  <span className="text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>{k}</span>
                  <span className="text-sm font-medium text-white">{v}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setViewContact(null)} className="mt-5 w-full py-2.5 rounded-xl text-sm"
              style={{ background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
