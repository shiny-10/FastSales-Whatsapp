"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaSearch, FaPlus, FaEye, FaEdit, FaTrash, FaWhatsapp, FaFilter, FaUsers, FaCheckCircle, FaCalendarAlt, FaTags } from "react-icons/fa";
import {
  getContacts,
  createContact,
  updateContact,
  deleteContactApi,
  importContacts,
} from "../../services/contactService";
import { getOrganizations } from "../../services/organizationService";

const StatCard = ({ icon, title, value, delta }: { icon: any, title: any, value: any, delta: any }) => (
  <div className="bg-white rounded-lg p-4 shadow-sm w-full md:w-1/4">
    <div className="flex items-center gap-4">
      <div className="h-14 w-14 rounded-full bg-green-50 flex items-center justify-center">
        <div className="text-green-600 text-2xl">{icon}</div>
      </div>
      <div>
        <div className="text-sm text-gray-500">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
        {delta && <div className="text-sm text-green-500 mt-1">{delta}</div>}
      </div>
    </div>
  </div>
);

export default function ContactsPage() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [filters, setFilters] = useState({ organization_id: "all", status: "all" });
  const [showModal, setShowModal] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [viewContact, setViewContact] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadOrganizations = useCallback(async () => {
    try {
      const data = await getOrganizations();
      setOrganizations(data || []);
    } catch (error) {
      console.error(error);
    }
  }, []);

  const loadContacts = useCallback(async () => {
    try {
      const data = await getContacts({
        q: searchTerm,
        organization_id: filters.organization_id,
        status: filters.status,
      });

      const formattedContacts = data.map((contact: any) => ({
        id: contact.id,
        name: contact.name,
        email: contact.email || "",
        phone: contact.phone_number,
        organization_id: contact.organization_id ?? null,
        organization: contact.organization_name || "-",
        status: contact.status || "Active",
        created_at: contact.created_at,
      }));

      setContacts(formattedContacts);
    } catch (error) {
      console.error(error);
    }
  }, [filters.organization_id, filters.status, searchTerm]);

  useEffect(() => {
    loadOrganizations();
  }, [loadOrganizations]);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  // Derived stats
  const totalContacts = contacts.length;
  const activeContacts = contacts.filter((c) => (c.status || "").toLowerCase() === "active").length;
  const contactsThisMonth = contacts.filter((c) => {
    try {
      if (!c.created_at) return false;
      const d = new Date(c.created_at);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    } catch (e) {
      return false;
    }
  }).length;
  // groups not implemented server-side; show dash if unknown
  const groupsCount = "-";

  const [newContact, setNewContact] = useState({
    name: "",
    phone: "",
    email: "",
    organization_id: "",
    status: "Active",
  });

  const handleSaveContact = async () => {
    if (!newContact.name || !newContact.phone) {
      alert("Name and Phone are required");
      return;
    }
    try {
      if (editingIndex !== null) {
        await updateContact(contacts[editingIndex].id, newContact);
        setEditingIndex(null);
      } else {
        await createContact(newContact);
      }

      await loadContacts();
    } catch (error) {
      console.error(error);
      alert(editingIndex !== null ? "Failed to update contact" : "Failed to create contact");
      return;
    }

    setNewContact({
      name: "",
      phone: "",
      email: "",
      organization_id: "",
      status: "Active",
    });

    setShowModal(false);
  };
  const handleDeleteContact = async (id: any) => {
    try {
      await deleteContactApi(id);

      loadContacts();
    } catch (error) {
      console.error(error);

      alert("Failed to delete contact");
    }
  };
  const handleEditContact = (index: number) => {
    setNewContact(contacts[index]);
    setEditingIndex(index);
    setShowModal(true);
  };

  const handleViewContact = (contact: any) => {
    setViewContact(contact);
  };

  const handleImportContacts = async (event: any) => {
    const file = event.target.files[0];

    if (!file) return;

    try {
      const result = await importContacts(file);

      if (!result.success) {
        alert(`Import failed: ${result.message || result.error || "Unknown error"}`);
        return;
      }

      await loadContacts();
    } catch (error) {
      console.error(error);
      alert("Failed to import contacts");
    } finally {
      event.target.value = null;
    }
  };
  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between lg:items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Contacts</h1>

          <p className="text-gray-500 mt-2">Manage all WhatsApp contacts</p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="bg-[#25D366] text-white px-5 py-3 rounded-xl inline-flex items-center gap-3 shadow-lg hover:bg-[#22b85b] transition"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#25D366] shadow-sm">
            <FaPlus className="text-xl" />
          </span>
          Add Contact
        </button>
      </div>

      {/* Stats row */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <StatCard icon={<FaUsers size={24} />} title="Total Contacts" value={totalContacts} delta="18.4% from last month" />
          <StatCard icon={<FaCheckCircle size={24} />} title="Active Contacts" value={activeContacts} delta="16.7% from last month" />
          <StatCard icon={<FaCalendarAlt size={24} />} title="Contacts This Month" value={contactsThisMonth} delta="12.1% from last month" />
          <StatCard icon={<FaTags size={24} />} title="Groups" value={groupsCount} delta="8.3% from last month" />
        </div>
      </div>

      {/* White Card */}
      <div className="bg-white rounded-[32px] shadow-sm p-6">
        {/* Search + Filters */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-6">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search contacts by name, phone, email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-full border border-slate-200 bg-slate-50 px-14 py-3 text-sm shadow-sm focus:border-slate-300 focus:ring-0"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filters.organization_id}
              onChange={(e) => setFilters({ ...filters, organization_id: e.target.value })}
              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
            >
              <option value="all">All Organizations</option>
              {organizations.map((org) => (
                <option key={org.id} value={org.id}>{org.name}</option>
              ))}
            </select>

            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm"
            >
              <option value="all">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>

            <button
              onClick={() => setFilters({ organization_id: "all", status: "all" })}
              className="rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm"
            >
              Clear
            </button>
          </div>

          <div className="flex gap-3">
            <button className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
              <FaFilter /> Filter
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-sm"
            >
              <FaPlus /> Import
            </button>
          </div>

          <input
            type="file"
            accept=".csv,.xlsx"
            ref={fileInputRef}
            onChange={handleImportContacts}
            className="hidden"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <div className="max-h-[520px] overflow-y-auto border-t border-slate-100">
            <table className="w-full min-w-[960px] text-left table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-sm uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4">Contact Name</th>
                <th className="px-6 py-4">Phone Number</th>
                <th className="px-6 py-4">Organization</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Added On</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {contacts.map((contact, index) => (
                <tr key={contact.id || index} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-6 py-5 align-top">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-sm shadow-sm">
                        {contact.name
                          .split(" ")
                          .map((part: string) => part[0])
                          .slice(0, 2)
                          .join("")}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{contact.name}</div>
                        <div className="text-xs text-slate-400">{contact.email || ""}</div>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-5 align-top text-slate-700">
                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-2 text-sm text-slate-700">
                      <FaWhatsapp className="text-green-600" />
                      {contact.phone}
                    </div>
                  </td>

                  <td className="px-6 py-5 align-top text-slate-700">
                    {contact.organization || "-"}
                  </td>

                  <td className="px-6 py-5 align-top">
                    <span className={
                      contact.status === "Active"
                        ? "inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-700"
                        : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-600"
                    }>
                      {contact.status}
                    </span>
                  </td>

                  <td className="px-6 py-5 align-top text-slate-700 text-sm">
                    {contact.created_at ? new Date(contact.created_at).toLocaleDateString() : "-"}
                  </td>

                  <td className="px-6 py-5 align-top">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewContact(contact)}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                      >
                        <FaEye className="text-lg" />
                      </button>
                      <button
                        onClick={() => handleEditContact(index)}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                      >
                        <FaEdit className="text-lg" />
                      </button>
                      <button
                        onClick={() => handleDeleteContact(contact.id)}
                        className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-slate-100 text-rose-500 transition hover:bg-rose-100"
                      >
                        <FaTrash className="text-lg" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>
      </div>
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl shadow-2xl p-8 w-[550px] border border-gray-100">
            <h2 className="text-3xl font-bold text-[#075E54] mb-6">
              Add Contact
            </h2>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Full Name"
                value={newContact.name}
                onChange={(e) =>
                  setNewContact({
                    ...newContact,
                    name: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              />

              <input
                type="text"
                placeholder="Phone Number"
                value={newContact.phone}
                onChange={(e) =>
                  setNewContact({
                    ...newContact,
                    phone: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              />

              <select
                value={newContact.organization_id}
                onChange={(e) =>
                  setNewContact({
                    ...newContact,
                    organization_id: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              >
                <option value="">Select Organization</option>
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>{org.name}</option>
                ))}
              </select>

              <input
                type="email"
                placeholder="Email address"
                value={newContact.email}
                onChange={(e) =>
                  setNewContact({
                    ...newContact,
                    email: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              />

              <select
                value={newContact.status}
                onChange={(e) =>
                  setNewContact({
                    ...newContact,
                    status: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-3"
              >
                <option>Active</option>
                <option>Inactive</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="border border-gray-300 px-5 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveContact}
                className="bg-[#25D366] hover:bg-[#1ebe5d] text-white px-5 py-2 rounded-lg font-medium transition"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
      {viewContact && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 w-[500px]">
            <h2 className="text-2xl font-bold mb-6">Contact Details</h2>

            <div className="space-y-4">
              <p>
                <strong>Name:</strong> {viewContact.name}
              </p>

              <p>
                <strong>Phone:</strong> {viewContact.phone}
              </p>

              <p>
                <strong>Organization:</strong> {viewContact.organization || "-"}
              </p>

              <p>
                <strong>Status:</strong> {viewContact.status}
              </p>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setViewContact(null)}
                className="bg-gray-500 text-white px-5 py-2 rounded-lg"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
