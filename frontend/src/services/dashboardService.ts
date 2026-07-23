import { api } from "@/lib/api";
import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api/dashboard`;

export const getUnifiedDashboard = async () => {
  const { data } = await api.get("/api/dashboard");
  return data;
};

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

export const getMessageAnalytics = async () => {
  const { data } = await api.get("/api/dashboard");
  const s = data?.summary || {};
  const sent = s.sent || s.total_messages || 0;
  const delivered = s.delivered || 0;
  const read = s.read || 0;
  const failed = s.failed || 0;
  return {
    delivery_rate: sent > 0 ? (delivered / sent) * 100 : 0,
    read_rate: delivered > 0 ? (read / delivered) * 100 : 0,
    failure_rate: sent > 0 ? (failed / sent) * 100 : 0,
    ...s,
  };
};

export const getTemplateOverview = async () => {
  const response = await fetch(`${API_URL}/template-overview`);
  return response.json();
};
