"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import {
  getOrganizations,
  getOrganization,
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from "../../services/organizationService";
import { getDashboardSummary } from "../../services/dashboardService";
import { FaPlus, FaEye, FaEdit, FaTrash, FaSearch, FaBuilding, FaCheckCircle, FaUsers, FaBullhorn } from "react-icons/fa";

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
    try {
      const data = await getOrganizations(filters);
      setOrganizations(data || []);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    let isMounted = true;

    const fetchOrganizations = async () => {
      setLoading(true);
      try {
        const data = await getOrganizations(filters);
        if (isMounted) {
          setOrganizations(data || []);
        }
      } catch (error) {
        console.error(error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchOrganizations();

    return () => {
      isMounted = false;
    };
  }, [filters]);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const data = await getDashboardSummary();
        setSummary({ total_contacts: data.total_contacts, total_campaigns: data.total_campaigns });
      } catch (error) {
        console.error(error);
      }
    };

    void loadSummary();
  }, []);

  const openAddModal = () => {
    setModalMode("add");
    setSelectedOrg(null);
    setFormData({ name: "", email: "", industry: "", status: "Active" });
    setShowModal(true);
  };

  const openViewModal = async (id: any) => {
    try {
      const org = await getOrganization(id);
      setModalMode("view");
      setSelectedOrg(org);
      setFormData({
        name: org.name || "",
        email: org.email || "",
        industry: org.industry || "",
        status: org.status || "Active",
      });
      setShowModal(true);
    } catch (error) {
      console.error(error);
    }
  };

  const openEditModal = async (id: any) => {
    try {
      const org = await getOrganization(id);
      setModalMode("edit");
      setSelectedOrg(org);
      setFormData({
        name: org.name || "",
        email: org.email || "",
        industry: org.industry || "",
        status: org.status || "Active",
      });
      setShowModal(true);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    try {
      if (modalMode === "edit" && selectedOrg) {
        await updateOrganization(selectedOrg.id, formData);
      } else {
        await createOrganization(formData);
      }
      setShowModal(false);
      loadOrganizations();
    } catch (error) {
      console.error(error);
    }
  };

  const handleDelete = async (id: any) => {
    if (!confirm("Delete organization?")) return;
    try {
      await deleteOrganization(id);
      loadOrganizations();
    } catch (error) {
      console.error(error);
    }
  };

  const filteredOrgs = useMemo(() => organizations, [organizations]);

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between lg:items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Organizations</h1>
          <p className="text-gray-500 mt-2">Manage your business organizations</p>
        </div>

        <button
          onClick={openAddModal}
          className="bg-[#25D366] text-white px-5 py-3 rounded-xl inline-flex items-center gap-3 shadow-lg hover:bg-[#22b85b] transition"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#25D366] shadow-sm">
            <FaPlus className="text-xl" />
          </span>
          Add Organization
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
        <div className="bg-white rounded-[32px] p-6 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <FaBuilding className="text-3xl" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Organizations</p>
            <h3 className="text-2xl font-semibold mt-2">{organizations.length}</h3>
            <p className="text-sm text-emerald-500 mt-3">↑ 20% from last month</p>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-6 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <FaCheckCircle className="text-3xl" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Active Organizations</p>
            <h3 className="text-2xl font-semibold mt-2">{organizations.filter((org) => (org.status || "").toLowerCase() === "active").length}</h3>
            <p className="text-sm text-emerald-500 mt-3">↑ 16.7% from last month</p>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-6 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <FaUsers className="text-3xl" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Contacts</p>
            <h3 className="text-2xl font-semibold mt-2">{summary.total_contacts}</h3>
            <p className="text-sm text-emerald-500 mt-3">↑ 18.4% from last month</p>
          </div>
        </div>

        <div className="bg-white rounded-[32px] p-6 shadow-sm flex items-center gap-4">
          <div className="w-14 h-14 rounded-3xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-sm">
            <FaBullhorn className="text-3xl" />
          </div>
          <div>
            <p className="text-sm text-slate-400">Total Campaigns</p>
            <h3 className="text-2xl font-semibold mt-2">{summary.total_campaigns}</h3>
            <p className="text-sm text-emerald-500 mt-3">↑ 12.5% from last month</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-6 shadow-sm mb-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <span className="absolute inset-y-0 left-4 flex items-center text-slate-400">
                <FaSearch />
              </span>
              <input
                value={filters.q}
                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                placeholder="Search organization..."
                className="w-full rounded-3xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-sm shadow-sm focus:border-slate-300 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
            >
              <option value="all">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <select
              value={filters.sort}
              onChange={(e) => setFilters({ ...filters, sort: e.target.value })}
              className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <div className="max-h-[520px] overflow-y-auto border-t border-slate-100">
            <table className="w-full min-w-[960px] text-left table-fixed">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky top-0 z-10 px-6 py-4 text-sm font-semibold text-slate-500 bg-slate-50">Organization Name</th>
                  <th className="sticky top-0 z-10 px-6 py-4 text-sm font-semibold text-slate-500 bg-slate-50">Industry</th>
                  <th className="sticky top-0 z-10 px-6 py-4 text-sm font-semibold text-slate-500 bg-slate-50">Contacts</th>
                  <th className="sticky top-0 z-10 px-6 py-4 text-sm font-semibold text-slate-500 bg-slate-50">Campaigns</th>
                  <th className="sticky top-0 z-10 px-6 py-4 text-sm font-semibold text-slate-500 bg-slate-50">Status</th>
                  <th className="sticky top-0 z-10 px-6 py-4 text-sm font-semibold text-slate-500 bg-slate-50">Created Date</th>
                  <th className="sticky top-0 z-10 px-6 py-4 text-sm font-semibold text-slate-500 bg-slate-50">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">Loading organizations…</td>
                  </tr>
                ) : filteredOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-8 text-center text-slate-500">No organizations found.</td>
                  </tr>
                ) : (
                  filteredOrgs.map((org) => (
                    <tr key={org.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                      <td className="px-6 py-5 align-top">
                        <div className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-emerald-500 text-white flex items-center justify-center font-semibold shadow-sm text-sm">
                            {org.name?.split(" ").map((part: string) => part[0]).slice(0, 2).join("")}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{org.name}</div>
                            <div className="text-xs text-slate-400">{org.email || "info@example.com"}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 align-top text-slate-700">{org.industry || "—"}</td>
                      <td className="px-6 py-5 align-top text-slate-700">{org.contacts_count ?? "—"}</td>
                      <td className="px-6 py-5 align-top text-slate-700">{org.campaigns_count ?? "—"}</td>
                      <td className="px-6 py-5 align-top">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm ${org.status === "Active" ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>
                          {org.status || "Active"}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-top text-slate-700">{org.created_at ? new Date(org.created_at).toLocaleDateString() : "—"}</td>
                      <td className="px-6 py-5 align-top">
                        <div className="flex items-center gap-2">
                          <button onClick={() => openViewModal(org.id)} className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-600 transition hover:bg-slate-200">
                            <FaEye className="text-lg" />
                          </button>
                          <button onClick={() => openEditModal(org.id)} className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-600 transition hover:bg-slate-200">
                            <FaEdit className="text-lg" />
                          </button>
                          <button onClick={() => handleDelete(org.id)} className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-rose-600 transition hover:bg-rose-100">
                            <FaTrash className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
          <div className="w-full max-w-2xl rounded-[32px] bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-3xl font-semibold">{modalMode === "edit" ? "Edit Organization" : modalMode === "view" ? "Organization Details" : "Add Organization"}</h2>
                <p className="text-sm text-slate-500 mt-2">
                  {modalMode === "view"
                    ? "Review organization information."
                    : modalMode === "edit"
                    ? "Update organization details."
                    : "Create a new organization record."}
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">✕</button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Organization name</span>
                <input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={modalMode === "view"}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-slate-700">Email address</span>
                <input
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={modalMode === "view"}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Industry</span>
                <input
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  disabled={modalMode === "view"}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                />
              </label>
              <label className="space-y-2 md:col-span-2">
                <span className="text-sm font-medium text-slate-700">Status</span>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  disabled={modalMode === "view"}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-slate-300 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </label>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button onClick={() => setShowModal(false)} className="rounded-3xl border border-slate-200 px-6 py-3 text-sm text-slate-600 transition hover:bg-slate-50">
                Close
              </button>
              {modalMode !== "view" && (
                <button onClick={handleSave} className="rounded-3xl bg-[#25D366] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#22b85b]">
                  Save Organization
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
