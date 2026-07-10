import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api/dashboard`;

export const getDashboardOverview = async () => {
  const response = await fetch(`${API_URL}/overview`);
  return response.json();
};

export const getCampaigns = async () => {
  const response = await fetch(`${API_URL}/campaigns`);
  return response.json();
};

export const getDashboardSummary = async () => {
  const response = await fetch(`${API_URL}/summary`);
  return response.json();
};

export const getDashboardMessages = async () => {
  const response = await fetch(`${API_URL}/messages`);
  return response.json();
};

export const getTemplateOverview = async () => {
  const response = await fetch(`${API_URL}/template-overview`);

  return response.json();
};
