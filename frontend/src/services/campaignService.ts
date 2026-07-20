import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api/campaign`;

type CampaignPayload = Record<string, unknown>;

type CampaignResult = Record<string, unknown> | { success: boolean; error?: string; campaigns?: unknown[] };

export const createCampaign = async (data: CampaignPayload) => {
  const response = await fetch(`${API_URL}/create-campaign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });

  return response.json();
};

export const getCampaign = async (id: string | number) => {
  const response = await fetch(`${API_URL}/${id}`);

  return response.json();
};

export const getCampaignAnalytics = async (id: string | number) => {
  const response = await fetch(`${API_URL}/${id}/analytics`);

  return response.json();
};

export const getCampaignDetails = async (id: string | number) => {
  try {
    const response = await fetch(`${API_URL}/details/${id}`);
    const data = await response.json();
    console.log("Campaign details loaded:", data);
    return data;
  } catch (error) {
    console.error("Error fetching campaign details:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

export const updateCampaign = async (id: string | number, data: CampaignPayload) => {
  try {
    const response = await fetch(`${API_URL}/update/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    const result = await response.json();
    console.log("Campaign updated:", result);
    return result;
  } catch (error) {
    console.error("Error updating campaign:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

export const listCampaigns = async () => {
  try {
    const response = await fetch(`${API_URL}/list`);
    const data = await response.json();
    console.log("Campaigns loaded:", data);
    return data;
  } catch (error) {
    console.error("Error fetching campaigns:", error);
    return { success: false, campaigns: [], error: error instanceof Error ? error.message : "Unknown error" };
  }
};

export const runCampaign = async (campaignId: string | number) => {
  const response = await fetch(`${API_URL}/run-campaign`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      campaign_id: campaignId,
    }),
  });

  return response.json();
};

export const deleteCampaign = async (id: string | number) => {
  try {
    const response = await fetch(`${API_URL}/delete/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const result = await response.json();
    console.log("Campaign deleted:", result);
    return result;
  } catch (error) {
    console.error("Error deleting campaign:", error);
    return { success: false, error: error instanceof Error ? error.message : "Unknown error" };
  }
};

export const getCampaignRecipients = async (id: string | number) => {
  const response = await fetch(`${API_URL}/${id}/recipients`);
  return response.json();
};
