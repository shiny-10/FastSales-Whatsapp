"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import StatsCard from "../../components/StatsCard";

import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  syncTemplateStatus,
  getRecentActivities,
} from "../../services/templateService";
import { getOrganizations } from "../../services/organizationService";
export default function TemplatesPage() {
  console.log("TEMPLATES PAGE LOADED");
  const [templates, setTemplates] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");
  const [notification, setNotification] = useState({ type: "", message: "" });
  const [isLoading, setIsLoading] = useState(false);

  const [showModal, setShowModal] = useState(false);

  const [editingId, setEditingId] = useState(null);

  const [templateData, setTemplateData] = useState({
    template_name: "",
    category: "MARKETING",
    language: "en_US",
    header: "none",
    template_body: "",
    footer: "",
    buttons: [],
    organization_id: 1,
  });
  const [organizations, setOrganizations] = useState([]);
  const [headerFile, setHeaderFile] = useState(null);
  const [headerPreviewUrl, setHeaderPreviewUrl] = useState(null);

  const loadOrganizations = async () => {
    try {
      const data = await getOrganizations();
      setOrganizations(data || []);
    } catch (error) {
      console.error("Failed to load organizations", error);
    }
  };

  const loadTemplates = async () => {
    try {
      setIsLoading(true);

      const data = await getTemplates();

      console.log("Templates API Response:", data);

      setTemplates(data);

    } catch (error) {
      console.error("Template Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentActivities = async () => {
    try {
      const data = await getRecentActivities(10);
      setRecentActivities(data);
    } catch (error) {
      console.error(error);
      // Don't show error notification for activities as it's not critical
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [templatesData, activitiesData, orgsData] = await Promise.all([
            getTemplates(),
            getRecentActivities(10),
            getOrganizations(),
          ]);

        if (!isMounted) {
          return;
        }

        setTemplates(templatesData);
        setRecentActivities(activitiesData);
        setOrganizations(orgsData || []);
      } catch (error) {
        console.error(error);
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification({ type: "", message: "" });
    }, 3000);
  };

  const getFilteredTemplates = () => {
    if (filterStatus === "all") {
      return templates;
    }
    return templates.filter((t) => {
      const status = (t.status || t.meta_status || "PENDING").toLowerCase();
      return status === filterStatus.toLowerCase();
    });
  };

  const handleSaveTemplate = async () => {
    try {
      if (!templateData.template_name.trim()) {
        showNotification("error", "Template name is required");
        return;
      }

      setIsLoading(true);

      if (editingId) {
        await updateTemplate(editingId, templateData);
        showNotification("success", "Template updated successfully!");
      } else {
        // If a file was selected, send as multipart/form-data
        if (headerFile) {
          const formData = new FormData();
          formData.append("template_name", templateData.template_name);
          formData.append("category", templateData.category);
          formData.append("language", templateData.language);
          formData.append("header", templateData.header);
          formData.append("template_body", templateData.template_body);
          if (templateData.footer) formData.append("footer", templateData.footer);
          formData.append("organization_id", templateData.organization_id);
          formData.append("buttons", JSON.stringify(templateData.buttons || []));
          formData.append("file", headerFile);

          await createTemplate(formData);
        } else {
          await createTemplate(templateData);
        }
        showNotification("success", "Template created successfully!");
      }

      setTemplateData({
        template_name: "",
        category: "MARKETING",
        language: "en_US",
        header: "none",
        template_body: "",
        footer: "",
        buttons: [],
        organization_id: 1,
      });

      setHeaderFile(null);
      setHeaderPreviewUrl(null);

      setEditingId(null);
      setShowModal(false);
      await loadTemplates();
      await fetchRecentActivities();
    } catch (error) {
      console.error(error);
      showNotification(
        "error",
        error.message || "Failed to save template. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditTemplate = (template) => {
    setTemplateData({
      template_name: template.template_name,
      category: template.category,
      language: template.language,
      header: template.header || "none",
      template_body: template.template_body,
      footer: template.footer || "",
      buttons: template.buttons || [],
      organization_id: template.organization_id || 1,
      header_url: template.header_url || null,
    });

    setEditingId(template.id);

    setHeaderFile(null);
    setHeaderPreviewUrl(template.header_url || null);
    setShowModal(true);
  };  
  

  const handleDeleteTemplate = async (id) => {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      await deleteTemplate(id);
      showNotification("success", "Template deleted successfully!");
      await loadTemplates();
      await fetchRecentActivities();
    } catch (error) {
      console.error(error);
      showNotification(
        "error",
        error.message || "Failed to delete template. Please try again."
      );
    }
  };

  const handleSyncStatus = async (id) => {
    try {
      const result = await syncTemplateStatus(id);
      if (result.success) {
        showNotification(
          "success",
          `Template synced! Status: ${result.meta_status}`
        );
        await loadTemplates();
        await fetchRecentActivities();
      } else {
        showNotification("error", result.message || "Failed to sync template");
      }
    } catch (error) {
      console.error(error);
      showNotification(
        "error",
        error.message || "Failed to sync template status. Please try again."
      );
    }
  };
  // Calculate stats
  const stats = {
    total: templates.length,
    approved: templates.filter(
      (t) => (t.status || t.meta_status || "").toUpperCase() === "APPROVED"
    ).length || 0,
    pending: templates.filter(
      (t) => (t.status || t.meta_status || "").toUpperCase() === "PENDING"
    ).length || 0,
    rejected: templates.filter(
      (t) => (t.status || t.meta_status || "").toUpperCase() === "REJECTED"
    ).length || 0,
  };

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      {/* Notification Toast */}
      {notification.message && (
        <div
          className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg text-white font-semibold z-50 animation ${
            notification.type === "success"
              ? "bg-green-500"
              : notification.type === "error"
                ? "bg-red-500"
                : "bg-blue-500"
          }`}
        >
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-4xl font-bold">Templates</h1>
          <p className="text-gray-500 mt-2">
            Manage and track your WhatsApp message templates.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-[#25D366] text-white px-6 py-3 rounded-lg font-semibold"
        >
          + Create Template
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatsCard
          title="Total Templates"
          value={stats.total}
          icon="📋"
          growth="8.3% from last month"
        />
        <StatsCard
          title="Approved"
          value={stats.approved}
          icon="✓"
          growth="10.2% from last month"
        />
        <StatsCard
          title="Pending"
          value={stats.pending}
          icon="⏳"
          growth="12.5% from last month"
        />
        <StatsCard
          title="Rejected"
          value={stats.rejected}
          icon="✕"
          growth="5.1% from last month"
        />
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        {/* Table Section - takes 1 column with scrolling */}
        <div className="col-span-1 bg-white rounded-2xl shadow-md p-6 flex flex-col">
          <div className="mb-6">
            <h2 className="text-xl font-bold mb-4">All Templates</h2>
            <div className="flex gap-4 mb-4 flex-wrap">
              <button
                onClick={() => setFilterStatus("all")}
                className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors ${
                  filterStatus === "all"
                    ? "bg-[#25D366] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All Templates
              </button>
              <button
                onClick={() => setFilterStatus("approved")}
                className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors ${
                  filterStatus === "approved"
                    ? "bg-[#25D366] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Approved ({stats.approved})
              </button>
              <button
                onClick={() => setFilterStatus("pending")}
                className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors ${
                  filterStatus === "pending"
                    ? "bg-[#25D366] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Pending ({stats.pending})
              </button>
              <button
                onClick={() => setFilterStatus("rejected")}
                className={`px-4 py-2 text-sm rounded-lg font-semibold transition-colors ${
                  filterStatus === "rejected"
                    ? "bg-[#25D366] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Rejected ({stats.rejected})
              </button>
            </div>
          </div>
          {/* Scrollable Table Container */}
          <div className="flex-1 overflow-y-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b">
                  <th className="text-left py-3 font-semibold">Template Name</th>
                  <th className="text-left py-3 font-semibold">Category</th>
                  <th className="text-left py-3 font-semibold">Language</th>
                  <th className="text-left py-3 font-semibold">Status</th>
                  <th className="text-left py-3 font-semibold">Created At</th>
                  <th className="text-left py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-500 mr-3"></div>
                      Loading templates...
                    </div>
                  </td>
                </tr>
              ) : getFilteredTemplates().length > 0 ? (
                getFilteredTemplates().map((template) => (
                <tr key={template.id} className="border-b hover:bg-gray-50">
                  <td className="py-4">{template.template_name}</td>
                  <td className="py-4">{template.category}</td>
                  <td className="py-4">{template.language}</td>
                  <td className="py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        (template.status || template.meta_status || "").toUpperCase() === "APPROVED"
                          ? "bg-green-100 text-green-700"
                          : (template.status || template.meta_status || "").toUpperCase() === "PENDING"
                            ? "bg-yellow-100 text-yellow-700"
                            : (template.status || template.meta_status || "").toUpperCase() === "REJECTED"
                              ? "bg-red-100 text-red-700"
                              : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {(template.status || template.meta_status || "PENDING").toUpperCase()}
                    </span>
                  </td>
                  <td className="py-4 text-gray-600">
                    {new Date(
                      template.created_at || new Date()
                    ).toLocaleDateString()}
                  </td>
                  <td className="py-4">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                      title="Edit"
                    >
                      ✎
                    </button>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="text-red-600 hover:text-red-800 mr-3"
                      title="Delete"
                    >
                      🗑
                    </button>
                    <button
                      onClick={() => handleSyncStatus(template.id)}
                      className="text-green-600 hover:text-green-800"
                      title="Sync"
                    >
                      ⟳
                    </button>
                  </td>
                </tr>
              ))
              ) : (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-gray-500">
                    No templates found for this filter.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>

        {/* Right Sidebar - Recent Activity Only */}
        <div className="col-span-1 bg-white rounded-2xl shadow-md p-6 flex flex-col overflow-hidden">
          <h2 className="text-xl font-bold mb-6">Recent Activity</h2>
          {recentActivities.length > 0 ? (
            <div className="space-y-4 overflow-y-auto max-h-[600px]">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-center justify-between border-b pb-4"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-lg">
                      {activity.action === "created" && "📝"}
                      {activity.action === "updated" && "✏️"}
                      {activity.action === "deleted" && "🗑️"}
                      {activity.action === "synced" && "⟳"}
                    </div>
                    <div>
                      <p className="font-semibold capitalize">{activity.action}</p>
                      <p className="text-sm text-gray-600">
                        Template: <strong>{activity.template_name}</strong>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      {activity.status && activity.status.toUpperCase() === "APPROVED"
                        ? "✓ Approved"
                        : activity.status && activity.status.toUpperCase() === "REJECTED"
                          ? "✕ Rejected"
                          : "⏳ Pending"}
                    </p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.created_at).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">
              No recent activity
            </p>
          )}
          <div className="mt-4 text-center pt-4 border-t">
            <button className="text-green-600 hover:text-green-800 font-semibold text-sm">
              View All Activity
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 w-[1000px]">
            <h2 className="text-2xl font-bold mb-6">
              {editingId ? "Edit Template" : "Add Template"}
            </h2>

            <div className="grid grid-cols-2 gap-8">
              {/* LEFT SIDE FORM */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2">Template Name</label>
                  <input
                    type="text"
                    placeholder="Template Name"
                    value={templateData.template_name}
                    onChange={(e) =>
                      setTemplateData({
                        ...templateData,
                        template_name: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Category</label>
                    <select
                      value={templateData.category}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          category: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-3"
                    >
                      <option>MARKETING</option>
                      <option>UTILITY</option>
                      <option>AUTHENTICATION</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold mb-2">Language</label>
                    <select
                      value={templateData.language}
                      onChange={(e) =>
                        setTemplateData({
                          ...templateData,
                          language: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-4 py-3"
                    >
                      <option>en_US</option>
                      <option>hi</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Organization</label>
                  <select
                    value={templateData.organization_id}
                    onChange={(e) =>
                      setTemplateData({
                        ...templateData,
                        organization_id: Number(e.target.value),
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  >
                    {organizations.length === 0 && <option value="">Select Organization</option>}
                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Header</label>
                  <select
                    value={templateData.header}
                    onChange={(e) =>
                      setTemplateData({
                        ...templateData,
                        header: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  >
                    <option value="none">none</option>
                    <option value="text">text</option>
                    <option value="image">image</option>
                    <option value="video">video</option>
                    <option value="document">document</option>
                  </select>
                </div>

                {/* File input when header is image/video/document */}
                {templateData.header && templateData.header !== "none" && (
                  <div>
                    <label className="block text-sm font-semibold mb-2">Upload {templateData.header}</label>
                    <input
                      type="file"
                      accept={
                        templateData.header === "image"
                          ? "image/*"
                          : templateData.header === "video"
                          ? "video/mp4"
                          : ".pdf,.doc,.docx"
                      }
                      onChange={(e) => {
                        const file = e.target.files && e.target.files[0];
                        setHeaderFile(file || null);
                        if (file) {
                          try {
                            const url = URL.createObjectURL(file);
                            setHeaderPreviewUrl(url);
                          } catch (err) {
                            setHeaderPreviewUrl(null);
                          }
                        } else {
                          setHeaderPreviewUrl(null);
                        }
                      }}
                      className="w-full"
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-semibold mb-2">Body Text</label>
                  <textarea
                    rows="6"
                    placeholder="Type your template message here..."
                    value={templateData.template_body}
                    onChange={(e) =>
                      setTemplateData({
                        ...templateData,
                        template_body: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Footer (optional)</label>
                  <input
                    type="text"
                    placeholder="Optional footer text (max 60 chars)"
                    value={templateData.footer}
                    maxLength="60"
                    onChange={(e) =>
                      setTemplateData({
                        ...templateData,
                        footer: e.target.value,
                      })
                    }
                    className="w-full border border-gray-300 rounded-lg px-4 py-3"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Buttons (optional)</label>
                  <div className="space-y-3 max-h-[150px] overflow-y-auto">
                    {templateData.buttons.map((btn, idx) => (
                      <div key={idx} className="flex gap-2 items-end">
                        <select
                          value={btn.type}
                          onChange={(e) => {
                            const newButtons = [...templateData.buttons];
                            newButtons[idx].type = e.target.value;
                            setTemplateData({
                              ...templateData,
                              buttons: newButtons,
                            });
                          }}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        >
                          <option value="QUICK_REPLY">QUICK_REPLY</option>
                          <option value="CALL_TO_ACTION">CALL_TO_ACTION</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Button label"
                          maxLength="20"
                          value={btn.text}
                          onChange={(e) => {
                            const newButtons = [...templateData.buttons];
                            newButtons[idx].text = e.target.value;
                            setTemplateData({
                              ...templateData,
                              buttons: newButtons,
                            });
                          }}
                          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                        />
                        <button
                          onClick={() => {
                            const newButtons = templateData.buttons.filter((_, i) => i !== idx);
                            setTemplateData({
                              ...templateData,
                              buttons: newButtons,
                            });
                          }}
                          className="text-red-600 hover:text-red-800 text-xl"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setTemplateData({
                        ...templateData,
                        buttons: [...templateData.buttons, { type: "QUICK_REPLY", text: "" }],
                      });
                    }}
                    className="mt-2 text-sm text-green-600 hover:text-green-800 font-semibold"
                  >
                    + Add Button
                  </button>
                </div>
              </div>

              {/* RIGHT SIDE PREVIEW */}
              <div className="border rounded-xl overflow-hidden bg-gray-100">
                <div className="bg-[#128C7E] text-white p-4 font-semibold">
                  WhatsApp Preview
                </div>
                <div className="p-4 bg-[#efeae2] min-h-[600px] overflow-y-auto">
                  <div className="bg-[#128C7E] text-white p-3 rounded-t-lg flex justify-between">
                    <div>
                      <div className="font-semibold">{(organizations.find(o => o.id === templateData.organization_id) || {}).name || 'Organization'}</div>
                      <div className="text-xs">Online</div>
                    </div>
                    <div>⋮</div>
                  </div>

                  <div className="bg-white rounded-b-lg p-4 w-full shadow">
                    {/* Header Section */}
                    {templateData.header && templateData.header !== "none" && (
                      <div className="mb-3 bg-gray-200 h-32 flex items-center justify-center rounded text-gray-600 text-sm">
                        {/* If a local preview is available show it, otherwise show placeholder or remote URL */}
                        {templateData.header === "image" && (headerPreviewUrl || templateData.header_url) ? (
                          <div className="relative h-28 w-full">
                            <Image
                              loader={({ src }) => src}
                              src={headerPreviewUrl || templateData.header_url}
                              alt="header"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                        ) : templateData.header === "video" && (headerPreviewUrl || templateData.header_url) ? (
                          <video controls className="max-h-28">
                            <source src={headerPreviewUrl || templateData.header_url} type="video/mp4" />
                            Your browser does not support the video tag.
                          </video>
                        ) : templateData.header === "document" && (headerPreviewUrl || templateData.header_url) ? (
                          // For documents, if it's a PDF show embed, otherwise show filename/link
                          (headerPreviewUrl || templateData.header_url).endsWith('.pdf') ? (
                            <iframe src={headerPreviewUrl || templateData.header_url} className="w-full h-28" />
                          ) : (
                            <a href={headerPreviewUrl || templateData.header_url} target="_blank" rel="noreferrer" className="text-sm text-blue-600">Open Document</a>
                          )
                        ) : (
                          <div className="text-sm text-gray-600">[{templateData.header.toUpperCase()}]</div>
                        )}
                      </div>
                    )}

                    {/* Body Section */}
                    <p className="whitespace-pre-wrap text-gray-800 mb-3">
                      {(
                        templateData.template_body ||
                        "Type your template message here..."
                      )
                        .replace(/{{1}}/g, "Rahul")
                        .replace(/{{2}}/g, "#12345")
                        .replace(/{{3}}/g, "12-May-2026")}
                    </p>

                    {/* Footer Section */}
                    {templateData.footer && (
                      <p className="text-xs text-gray-500 border-t pt-2 mb-3">
                        {templateData.footer}
                      </p>
                    )}

                    {/* Buttons Section */}
                    {templateData.buttons.length > 0 && (
                      <div className="border-t pt-3 space-y-2">
                        {templateData.buttons.map((btn, idx) => (
                          <button
                            key={idx}
                            className="w-full bg-gray-100 border border-gray-300 text-gray-800 p-2 rounded text-sm hover:bg-gray-200"
                            disabled
                          >
                            {btn.text || `Button ${idx + 1}`}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="text-right text-xs text-gray-400 mt-4">
                      11:30 AM ✓✓
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="border border-gray-300 px-5 py-2 rounded-lg"
              >
                Cancel
              </button>

              <button
                onClick={handleSaveTemplate}
                disabled={isLoading}
                className="bg-[#25D366] text-white px-5 py-2 rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
