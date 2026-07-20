"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Plus, Eye, Edit2, Trash2, Users, CheckCircle, CalendarDays, Upload, X, Phone } from "lucide-react";
import { getContacts, createContact, updateContact, deleteContactApi, importContacts } from "../../services/contactService";

const card = { background: "#ffffff", border: "1px solid #ece9f8", borderRadius: "14px", boxShadow: "0 1px 6px rgba(100,80,200,0.07)" };
const inputStyle = { background: "#f5f4fb", border: "1px solid #e0ddf5", color: "#1a1040", borderRadius: "10px", padding: "10px 14px", width: "100%", fontSize: "14px", outline: "none" };

function StatCard({ icon: Icon, title, value, delta, color, bg }: any) {
  return (
    <div className="rounded-2xl p-5 flex items-center justify-between" style={card}>
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: "#9390b5" }}>{title}</p>
        <p className="text-[28px] font-bold tabular-nums" style={{ color: "#1a1040" }}>{typeof value === "number" ? value.toLocaleString() : value}</p>
        {delta && <p className="text-[11px] mt-1.5 font-medium" style={{ color: "#10b981" }}>↑ {delta}</p>}
      </div>
      <div className="flex items-center justify-center w-12 h-12 rounded-xl flex-shrink-0" style={{ background: bg }}>
        <Icon size={22} style={{ color }} />
      </div>
    </div>
  );
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [filters, setFilters] = useState({ status: "all" });
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewContact, setViewContact] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", status: "Active" });

  const loadContacts = useCallback(async () => {
    try {
      const data = await getContacts({ q: searchTerm, status: filters.status });
      setContacts(data.map((c: any) => ({ id: c.id, name: c.name, email: c.email || "", phone: c.phone_number, status: c.status || "Active", created_at: c.created_at })));
    } catch { }
  }, [filters, searchTerm]);

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
      setNewContact({ name: "", phone: "", email: "", status: "Active" });
      setShowModal(false);
    } catch { alert("Failed to save contact"); }
  };

  const handleDelete = async (id: any) => { try { await deleteContactApi(id); loadContacts(); } catch { alert("Failed to delete"); } };
  const handleEdit = (index: number) => { setNewContact(contacts[index]); setEditingIndex(index); setShowModal(true); };
  const handleImport = async (e: any) => {
    const file = e.target.files[0]; if (!file) return;
    try { const r = await importContacts(file); if (!r.success) { alert(`Import failed: ${r.message || r.error}`); return; } await loadContacts(); }
    catch { alert("Failed to import"); } finally { e.target.value = null; }
  };

  return (
    <div className="p-6 space-y-5 animate-fade-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: "#1a1040" }}>Contacts</h1>
          <p className="text-sm mt-0.5" style={{ color: "#9390b5" }}>Manage all WhatsApp contacts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
            style={{ background: "#fff", border: "1px solid #e0ddf5", color: "#7c3aed" }}>
            <Upload size={14} /> Import
          </button>
          <button onClick={() => { setEditingIndex(null); setNewContact({ name: "", phone: "", email: "", status: "Active" }); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>
            <Plus size={14} /> Add Contact
          </button>
          <input type="file" accept=".csv,.xlsx" ref={fileInputRef} onChange={handleImport} className="hidden" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Users}        title="Total Contacts" value={total}      delta="18.4% this month" color="#7c3aed" bg="rgba(124,58,237,0.10)" />
        <StatCard icon={CheckCircle}  title="Active"         value={active}     delta="16.7% this month" color="#10b981" bg="rgba(16,185,129,0.10)" />
        <StatCard icon={CalendarDays} title="This Month"     value={thisMonth}  delta="12.1% this month" color="#06b6d4" bg="rgba(6,182,212,0.10)"  />
        <StatCard icon={Users}        title="Total"          value={total}      color="#f59e0b"           bg="rgba(245,158,11,0.10)" />
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        {/* Toolbar */}
        <div className="px-5 py-3.5 flex flex-wrap items-center gap-3" style={{ borderBottom: "1px solid #ece9f8" }}>
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: "#b0aed0" }} />
            <input type="text" placeholder="Search contacts…" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm rounded-xl w-full focus:outline-none"
              style={{ background: "#f5f4fb", border: "1px solid #e0ddf5", color: "#1a1040" }} />
          </div>
          <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })}
            className="px-3 py-2 text-sm rounded-xl focus:outline-none"
            style={{ background: "#f5f4fb", border: "1px solid #e0ddf5", color: "#4b4880" }}>
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
          <button onClick={() => setFilters({ status: "all" })}
            className="px-3 py-2 text-sm rounded-xl"
            style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>
            Clear
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr><th>Contact</th><th>Phone</th><th>Status</th><th>Added</th><th className="text-center">Actions</th></tr>
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
                        <p className="font-semibold text-sm" style={{ color: "#1a1040" }}>{c.name}</p>
                        <p className="text-xs" style={{ color: "#9390b5" }}>{c.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="flex items-center gap-1.5 text-sm" style={{ color: "#4b4880" }}>
                      <Phone size={12} style={{ color: "#25d366" }} />{c.phone}
                    </span>
                  </td>
                  <td>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold"
                      style={{ background: c.status === "Active" ? "rgba(16,185,129,0.12)" : "rgba(100,80,200,0.07)", color: c.status === "Active" ? "#10b981" : "#9390b5" }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.status === "Active" ? "#10b981" : "#9390b5" }} />
                      {c.status}
                    </span>
                  </td>
                  <td style={{ color: "#9390b5" }}>{c.created_at ? new Date(c.created_at).toLocaleDateString() : "—"}</td>
                  <td>
                    <div className="flex items-center justify-center gap-2">
                      {[{ Icon: Eye, fn: () => setViewContact(c), color: "#06b6d4" }, { Icon: Edit2, fn: () => handleEdit(i), color: "#7c3aed" }, { Icon: Trash2, fn: () => handleDelete(c.id), color: "#f43f5e" }].map(({ Icon, fn, color }, k) => (
                        <button key={k} onClick={fn} className="w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
                          style={{ background: "#f5f4fb", border: "1px solid #e0ddf5" }}
                          onMouseEnter={e => (e.currentTarget.style.background = color + "15")}
                          onMouseLeave={e => (e.currentTarget.style.background = "#f5f4fb")}>
                          <Icon size={13} style={{ color }} />
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
              {contacts.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12" style={{ color: "#b0aed0" }}>No contacts found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(26,16,64,0.4)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ background: "#fff", border: "1px solid #ece9f8", boxShadow: "0 20px 60px rgba(100,80,200,0.15)" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>{editingIndex !== null ? "Edit Contact" : "Add Contact"}</h2>
              <button onClick={() => setShowModal(false)} style={{ color: "#9390b5" }}><X size={18} /></button>
            </div>
            {[{ ph: "Full Name", key: "name", type: "text" }, { ph: "919876543210 (no + or spaces)", key: "phone", type: "text" }, { ph: "Email Address", key: "email", type: "email" }].map(({ ph, key, type }) => (
              <input key={key} type={type} placeholder={ph} value={(newContact as any)[key]}
                onChange={e => setNewContact({ ...newContact, [key]: e.target.value })}
                className="placeholder:text-[#c0bed8] focus:outline-none" style={inputStyle} />
            ))}
            <select value={newContact.status} onChange={e => setNewContact({ ...newContact, status: e.target.value })}
              className="focus:outline-none" style={inputStyle}>
              <option>Active</option><option>Inactive</option>
            </select>
            <div className="flex justify-end gap-3 pt-1">
              <button onClick={() => setShowModal(false)} className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ background: "#f5f4fb", color: "#9390b5", border: "1px solid #e0ddf5" }}>Cancel</button>
              <button onClick={handleSave} className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "linear-gradient(90deg,#7c3aed,#4f46e5)", boxShadow: "0 4px 14px rgba(124,58,237,0.3)" }}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* View Modal */}
      {viewContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(26,16,64,0.4)", backdropFilter: "blur(6px)" }}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: "#fff", border: "1px solid #ece9f8", boxShadow: "0 20px 60px rgba(100,80,200,0.15)" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold" style={{ color: "#1a1040" }}>Contact Details</h2>
              <button onClick={() => setViewContact(null)} style={{ color: "#9390b5" }}><X size={18} /></button>
            </div>
            <div className="space-y-1">
              {[["Name", viewContact.name], ["Phone", viewContact.phone], ["Email", viewContact.email || "—"], ["Status", viewContact.status]].map(([k, v]) => (
                <div key={k} className="flex justify-between py-2.5" style={{ borderBottom: "1px solid #f0eefb" }}>
                  <span className="text-sm" style={{ color: "#9390b5" }}>{k}</span>
                  <span className="text-sm font-semibold" style={{ color: "#1a1040" }}>{v}</span>
                </div>
              ))}
            </div>
            <button onClick={() => setViewContact(null)} className="mt-5 w-full py-2.5 rounded-xl text-sm font-medium"
              style={{ background: "#f5f4fb", color: "#7c3aed", border: "1px solid #e0ddf5" }}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
