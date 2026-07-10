"use client";

import { useState, useEffect } from "react";
import { getContacts } from "../../services/contactService";
import { getTemplates } from "../../services/templateService";
import { sendMessage } from "../../services/whatsappService";
import { listCampaigns, runCampaign } from "../../services/campaignService";

export default function WhatsAppPage() {
  const [contacts, setContacts] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedContact, setSelectedContact] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [statusMessageType, setStatusMessageType] = useState("success");
  const [campaignStatusMessage, setCampaignStatusMessage] = useState("");
  const [campaignStatusType, setCampaignStatusType] = useState("success");
  const [isSending, setIsSending] = useState(false);
  const [isCampaignSending, setIsCampaignSending] = useState(false);

  const approvedTemplates = templates.filter(
    (template) =>
      (template.status || template.meta_status || "").toUpperCase() === "APPROVED"
  );

  const statusClass =
    statusMessageType === "success"
      ? "rounded-2xl px-4 py-3 text-sm border border-emerald-100 bg-emerald-50 text-emerald-700"
      : "rounded-2xl px-4 py-3 text-sm border border-red-100 bg-red-50 text-red-700";

  const campaignStatusClass =
    campaignStatusType === "success"
      ? "rounded-2xl px-4 py-3 text-sm border border-emerald-100 bg-emerald-50 text-emerald-700"
      : "rounded-2xl px-4 py-3 text-sm border border-red-100 bg-red-50 text-red-700";

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const [conts, temps, campaignsData] = await Promise.all([
          getContacts(),
          getTemplates(),
          listCampaigns(),
        ]);

        if (!isMounted) return;

        setContacts(conts);
        setTemplates(temps);
        
        if (campaignsData.success) {
          setCampaigns(campaignsData.campaigns || []);
        } else {
          setCampaigns([]);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      }
    };

    void fetchData();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSend = async () => {
    if (!selectedContact || !selectedTemplate) {
      alert("Select Contact and Template");
      return;
    }

    setIsSending(true);
    try {
      const result = await sendMessage(selectedContact, selectedTemplate);

      if (result.success === false) {
        setStatusMessageType("error");
        setStatusMessage(result.meta_response?.error || "Message send failed.");
        return;
      }

      setStatusMessageType("success");
      setStatusMessage("Message sent successfully.");
      setSelectedContact("");
      setSelectedTemplate("");
    } catch (error) {
      console.error(error);
      setStatusMessageType("error");
      setStatusMessage(error.message || "Message send failed.");
    } finally {
      setIsSending(false);
    }
  };

  const handleRunCampaign = async () => {
    if (!selectedCampaign) {
      alert("Select a campaign");
      return;
    }

    const campaign = campaigns.find(c => c.id === parseInt(selectedCampaign));
    if (!campaign) {
      alert("Campaign not found");
      return;
    }

    setIsCampaignSending(true);
    try {
      const result = await runCampaign(parseInt(selectedCampaign), campaign.template_name);

      if (result.success === false) {
        setCampaignStatusType("error");
        setCampaignStatusMessage(result.error || "Campaign send failed.");
        return;
      }

      setCampaignStatusType("success");
      setCampaignStatusMessage(`Messages sent successfully to ${result.message_count || 0} contacts.`);
      setSelectedCampaign("");
    } catch (error) {
      console.error(error);
      setCampaignStatusType("error");
      setCampaignStatusMessage(error.message || "Campaign send failed.");
    } finally {
      setIsCampaignSending(false);
    }
  };

  return (
    <div className="p-8 bg-slate-100 min-h-screen">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">WhatsApp</h1>
          <p className="text-gray-500 mt-2">Manage conversations, send messages and track WhatsApp activity.</p>
        </div>
      </div>

      <div className="flex gap-6">
        <div className="w-96">
          <div className="space-y-6">
            {/* Send Message Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Send Message</h2>
                <p className="text-sm text-slate-500">Send a WhatsApp message using a template.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Contact</label>
                  <select
                    value={selectedContact}
                    onChange={(e) => setSelectedContact(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <option value="">Select contact...</option>
                    {contacts.map((contact) => (
                      <option key={contact.id} value={contact.phone_number}>
                        {contact.name} - {contact.phone_number}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Template</label>
                  <select
                    value={selectedTemplate}
                    onChange={(e) => setSelectedTemplate(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <option value="">Select template...</option>
                    {approvedTemplates.map((template) => (
                      <option key={template.id} value={template.template_name}>
                        {template.template_name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleSend}
                  disabled={isSending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-white font-semibold shadow-sm hover:bg-emerald-600 disabled:bg-emerald-400"
                >
                  {isSending ? "Sending..." : "Send WhatsApp Message"}
                </button>

                {statusMessage && (
                  <div className={statusClass}>
                    {statusMessage}
                  </div>
                )}
              </div>
            </div>

            {/* Run Campaign Card */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
              <div>
                <h2 className="text-xl font-semibold mb-2">Run Campaign</h2>
                <p className="text-sm text-slate-500">Send messages to all contacts in a campaign.</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Select Campaign</label>
                  <select
                    value={selectedCampaign}
                    onChange={(e) => setSelectedCampaign(e.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <option value="">Select campaign...</option>
                    {campaigns.map((campaign) => (
                      <option key={campaign.id} value={campaign.id}>
                        {campaign.campaign_name} ({campaign.contact_count} contacts) - Template: {campaign.template_name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  onClick={handleRunCampaign}
                  disabled={isCampaignSending}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-5 py-3 text-white font-semibold shadow-sm hover:bg-emerald-600 disabled:bg-emerald-400"
                >
                  {isCampaignSending ? "Sending..." : "Send Campaign"}
                </button>

                {campaignStatusMessage && (
                  <div className={campaignStatusClass}>
                    {campaignStatusMessage}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
