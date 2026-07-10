  "use client";

  import { useEffect, useState } from "react";

  import { FaPlus, FaEye, FaEdit, FaTrash } from "react-icons/fa";

  import { getOrganizations } from "../../services/organizationService";

  import { getTemplates } from "../../services/templateService";

  import { getContacts } from "../../services/contactService";

  import {
    createCampaign,
    getCampaignAnalytics,
    getCampaignDetails,
    updateCampaign,
    deleteCampaign,
  } from "../../services/campaignService";

  import { getCampaigns } from "../../services/dashboardService";

  interface Organization {
  id: number;
  name: string;
}

interface Template {
  id: number;
  template_name: string;
  status?: string;
  meta_status?: string;
}

interface Contact {
  id: number;
  name: string;
  phone_number: string;
}

interface Campaign {
  id: number;
  name: string;
  campaign_name?: string;
  status: string;
  total: number;
  contact_count: number;
  template_name?: string;
}

interface CampaignAnalytics {
  campaign_name: string;
  contact_count: number;
  total_recipients: number;
  total_messages?: number;
  sent: number;
  delivered: number;
  read: number;
  failed: number;
}

  export default function CampaignsPage() {
    const [showModal, setShowModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [organizations, setOrganizations] = useState<Organization[]>([]);

    const [templates, setTemplates] = useState<Template[]>([]);

    const [contacts, setContacts] = useState<Contact[]>([]);

    
const [campaigns, setCampaigns] = useState<Campaign[]>([]);

    const [showAnalytics, setShowAnalytics] = useState(false);

    const [analytics, setAnalytics] = useState<CampaignAnalytics | null>(null);

    const [campaignData, setCampaignData] = useState({
  campaign_name: "",
  organization_id: "",
  template_id: "",
  contact_ids: [] as number[],
});

    const [editCampaignData, setEditCampaignData] = useState({
  campaign_name: "",
  template_id: "",
  contact_ids: [] as number[],
  id: null as number | null,
});

    const [statusMessage, setStatusMessage] = useState("");
    const [statusType, setStatusType] = useState(""); // 'success' or 'error'

    const showNotification = (
  message: string,
  type: "success" | "error" = "success"
) => {
      setStatusMessage(message);
      setStatusType(type);
      setTimeout(() => {
        setStatusMessage("");
        setStatusType("");
      }, 3000);
    };

    const loadData = async () => {
      const campaignList = await getCampaigns();
      setCampaigns(campaignList);
    };

    useEffect(() => {
      let isMounted = true;

      const fetchData = async () => {
        try {
          const [orgs, temps, conts, campaignList] = await Promise.all([
            getOrganizations(),
            getTemplates(),
            getContacts(),
            getCampaigns(),
          ]);

          if (!isMounted) {
            return;
          }

          setCampaigns(campaignList);
          setOrganizations(orgs);
          setTemplates(temps);
          setContacts(conts);
        } catch (error) {
          console.error(error);
        }
      };

      void fetchData();

      return () => {
        isMounted = false;
      };
    }, []);

    const handleCreateCampaign = async () => {
      try {
        const result = await createCampaign(campaignData);

        console.log(result);

        showNotification("Campaign Created Successfully", "success");

        setShowModal(false);
        setCampaignData({
          campaign_name: "",
          organization_id: "",
          template_id: "",
          contact_ids: [],
        });
        loadData();
      } catch (error) {
        console.error(error);
      }
    };

    const handleEditCampaign = async (campaignId: number) => {
      try {
        const details = await getCampaignDetails(campaignId);
        if (details.success) {
          const campaign = details.campaign;
          setEditCampaignData({
            campaign_name: campaign.campaign_name,
            template_id: campaign.template_id,
            contact_ids: campaign.contact_ids,
            id: campaign.id,
          });
          setShowEditModal(true);
        } else {
          showNotification("Failed to load campaign details", "error");
        }
      } catch (error) {
        console.error(error);
        showNotification("Error loading campaign details", "error");
      }
    };

    const handleUpdateCampaign = async () => {
      try {
        const result = await updateCampaign(editCampaignData.id, {
          campaign_name: editCampaignData.campaign_name,
          template_id: editCampaignData.template_id,
          contact_ids: editCampaignData.contact_ids,
        });

        if (result.success) {
          showNotification("Campaign Updated Successfully", "success");
          setShowEditModal(false);
          setEditCampaignData({
            campaign_name: "",
            template_id: "",
            contact_ids: [],
            id: null,
          });
          loadData();
        } else {
          showNotification("Failed to update campaign: " + result.error, "error");
        }
      } catch (error) {
        console.error(error);
        showNotification("Error updating campaign", "error");
      }
    };

    const handleViewAnalytics = async (campaignId: number) => {
      try {
        const data = await getCampaignAnalytics(campaignId);

        setAnalytics(data);

        setShowAnalytics(true);
      } catch (error) {
        console.error(error);
      }
    };

    const handleDeleteCampaign = async (campaignId: number) => {
      try {
        const result = await deleteCampaign(campaignId);
        if (result.success) {
          showNotification("Campaign deleted successfully", "success");
          loadData();
        } else {
          showNotification("Failed to delete campaign: " + result.error, "error");
        }
      } catch (error) {
        console.error(error);
        showNotification("Error deleting campaign", "error");
      }
    };
    return (
      <div className="p-8 bg-slate-100 min-h-screen">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-4xl font-bold">Campaigns</h1>

            <p className="text-gray-500 mt-2">Manage WhatsApp Campaigns</p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 bg-[#25D366] text-white px-5 py-3 rounded-lg"
          >
            <FaPlus />
            Create Campaign
          </button>
        </div>

        <div className="bg-white rounded-2xl shadow-md p-6">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3">Campaign Name</th>

                <th className="text-left py-3">Status</th>

                <th className="text-left py-3">Total Recipients</th>

                <th className="text-left py-3">Contacts</th>

                <th className="text-center py-3">Actions</th>
              </tr>
            </thead>

            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id} className="border-b">
                  <td className="py-4">{campaign.name}</td>

                  <td>
                    <span
                      className={
                        campaign.status === "completed"
                          ? "bg-green-100 text-green-700 px-3 py-1 rounded-full"
                          : "bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full"
                      }
                    >
                      {campaign.status}
                    </span>
                  </td>

                  <td>{campaign.total}</td>

                  <td className="font-semibold text-blue-600">{campaign.contact_count}</td>

                  <td className="text-center">
                    <div className="flex gap-3 justify-center items-center">
                      <button
                        onClick={() => handleViewAnalytics(campaign.id)}
                        className="flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-600 rounded hover:bg-blue-100 hover:text-blue-600 transition"
                        title="View"
                      >
                        <FaEye size={16} />
                      </button>
                      <button
                        onClick={() => handleEditCampaign(campaign.id)}
                        className="flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-600 rounded hover:bg-orange-100 hover:text-orange-600 transition"
                        title="Edit"
                      >
                        <FaEdit size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteCampaign(campaign.id)}
                        className="flex items-center justify-center w-8 h-8 bg-gray-100 text-gray-600 rounded hover:bg-red-100 hover:text-red-600 transition"
                        title="Delete"
                      >
                        <FaTrash size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {showModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 w-[700px]">
              <h2 className="text-2xl font-bold mb-6">Create Campaign</h2>

              <div className="space-y-4">
                <input
                  placeholder="Campaign Name"
                  value={campaignData.campaign_name}
                  onChange={(e) =>
                    setCampaignData({
                      ...campaignData,
                      campaign_name: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-4 py-3"
                />

                  <select
                    value={campaignData.organization_id}
                    onChange={(e) =>
                      setCampaignData({
                        ...campaignData,
                        organization_id: Number(e.target.value),
                      })
                    }
                    className="w-full border rounded-lg px-4 py-3"
                  >
                    <option value="">Select Organization</option>

                    {organizations.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name}
                      </option>
                    ))}
                  </select>

                  <select
                    value={campaignData.template_id}
                    onChange={(e) =>
                      setCampaignData({
                        ...campaignData,
                        template_id: Number(e.target.value),
                      })
                    }
                    className="w-full border rounded-lg px-4 py-3"
                  >
                    <option value="">Select Template</option>

                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.template_name}
                      </option>
                    ))}
                  </select>

                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-3">Select Contacts</h3>

                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className="flex items-center gap-2 py-2"
                      >
                        <input
                          type="checkbox"
                          value={contact.id}
                          onChange={(e) => {
                            const contactId = Number(e.target.value);

                            if (e.target.checked) {
                              setCampaignData({
                                ...campaignData,
                                contact_ids: [
                                  ...campaignData.contact_ids,
                                  contactId,
                                ],
                              });
                            } else {
                              setCampaignData({
                                ...campaignData,
                                contact_ids: campaignData.contact_ids.filter(
                                  (id) => id !== contactId,
                                ),
                              });
                            }
                          }}
                        />

                        <span>
                          {contact.name} - {contact.phone_number}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-sm text-gray-500">
                    Selected Contacts: {campaignData.contact_ids.length}
                  </p>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={() => setShowModal(false)}
                    className="border px-5 py-2 rounded-lg"
                  >
                    Cancel
                  </button>

                  <button
                    onClick={handleCreateCampaign}
                    className="bg-[#25D366] text-white px-5 py-2 rounded-lg"
                  >
                    Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {showEditModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-white rounded-2xl p-8 w-[700px] max-h-[90vh] overflow-y-auto">
              <h2 className="text-2xl font-bold mb-6">Edit Campaign</h2>

              <div className="space-y-4">
                <input
                  placeholder="Campaign Name"
                  value={editCampaignData.campaign_name}
                  onChange={(e) =>
                    setEditCampaignData({
                      ...editCampaignData,
                      campaign_name: e.target.value,
                    })
                  }
                  className="w-full border rounded-lg px-4 py-3"
                />

                <select
                  value={editCampaignData.template_id}
                  onChange={(e) =>
                    setEditCampaignData({
                      ...editCampaignData,
                      template_id: Number(e.target.value),
                    })
                  }
                  className="w-full border rounded-lg px-4 py-3"
                >
                  <option value="">Select Template</option>

                  {templates
                    .filter(
                      (template) =>
                        (template.status || template.meta_status || "")
                          .toUpperCase() === "APPROVED"
                    )
                    .map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.template_name}
                      </option>
                    ))}
                </select>

                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Select Contacts</h3>

                  {contacts.map((contact) => (
                    <div
                      key={contact.id}
                      className="flex items-center gap-2 py-2"
                    >
                      <input
                        type="checkbox"
                        checked={editCampaignData.contact_ids.includes(contact.id)}
                        onChange={(e) => {
                          const contactId = contact.id;

                          if (e.target.checked) {
                            setEditCampaignData({
                              ...editCampaignData,
                              contact_ids: [
                                ...editCampaignData.contact_ids,
                                contactId,
                              ],
                            });
                          } else {
                            setEditCampaignData({
                              ...editCampaignData,
                              contact_ids: editCampaignData.contact_ids.filter(
                                (id) => id !== contactId,
                              ),
                            });
                          }
                        }}
                      />

                      <span>
                        {contact.name} - {contact.phone_number}
                      </span>
                    </div>
                  ))}
                </div>

                <p className="text-sm text-gray-500">
                  Selected Contacts: {editCampaignData.contact_ids.length}
                </p>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditModal(false);
                    setEditCampaignData({
                      campaign_name: "",
                      template_id: "",
                      contact_ids: [],
                      id: null,
                    });
                  }}
                  className="border px-5 py-2 rounded-lg"
                >
                  Cancel
                </button>

                <button
                  onClick={handleUpdateCampaign}
                  className="bg-[#25D366] text-white px-5 py-2 rounded-lg"
                >
                  Update
                </button>
              </div>
            </div>
          </div>
        )}

        {showAnalytics && analytics && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-white rounded-2xl p-8 w-[600px]">
              <h2 className="text-2xl font-bold mb-6">Campaign Analytics</h2>

              <div className="space-y-4">
                <div className="flex justify-between">
                  <span>Campaign</span>
                  <span className="font-semibold">{analytics.campaign_name}</span>
                </div>

                <div className="flex justify-between">
                  <span>Total Contacts</span>
                  <span className="font-semibold text-blue-600">{analytics.contact_count}</span>
                </div>

                <div className="flex justify-between">
                  <span>Total Recipients</span>
                  <span>{analytics.total_recipients}</span>
                </div>

                <div className="flex justify-between">
                  <span>Sent</span>
                  <span>{analytics.sent}</span>
                </div>

                <div className="flex justify-between">
                  <span>Delivered</span>
                  <span>{analytics.delivered}</span>
                </div>

                <div className="flex justify-between">
                  <span>Read</span>
                  <span>{analytics.read}</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="font-medium">Failed</span>
                  <span className="font-bold text-red-500">{analytics.failed}</span>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="flex justify-between">
                    <span className="font-medium">Delivery Rate</span>
                    <span className="font-bold text-green-600">
                      {(analytics.total_messages ?? analytics.total_recipients) > 0
                        ? (
                            (analytics.delivered /
                              (analytics.total_messages ?? analytics.total_recipients)) *
                            100
                          ).toFixed(1)
                        : 0}
                      %
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-6">
                <button
                  onClick={() => setShowAnalytics(false)}
                  className="bg-gray-500 text-white px-5 py-2 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {statusMessage && (
          <div
            className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg text-white shadow-lg animate-pulse ${
              statusType === "success" ? "bg-green-500" : "bg-red-500"
            }`}
          >
            {statusMessage}
          </div>
        )}
      </div>
    );
  } 
