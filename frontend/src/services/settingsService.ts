const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export async function getAutoReplies() {
  const res = await fetch(`${API_BASE}/api/settings/auto-replies`);
  return res.json();
}

export async function createAutoReply(payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/settings/auto-replies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateAutoReply(id: string | number, payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/settings/auto-replies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteAutoReply(id: string | number) {
  const res = await fetch(`${API_BASE}/api/settings/auto-replies/${id}`, {
    method: "DELETE",
  });
  return res.json();
}

export async function getChatbotRules() {
  const res = await fetch(`${API_BASE}/api/settings/chatbot-rules`);
  return res.json();
}

export async function createChatbotRule(payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/settings/chatbot-rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function updateChatbotRule(id: string | number, payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/settings/chatbot-rules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function deleteChatbotRule(id: string | number) {
  const res = await fetch(`${API_BASE}/api/settings/chatbot-rules/${id}`, {
    method: "DELETE",
  });
  return res.json();
}

const settingsService = {
  getAutoReplies,
  createAutoReply,
  updateAutoReply,
  deleteAutoReply,
  getChatbotRules,
  createChatbotRule,
  updateChatbotRule,
  deleteChatbotRule,
};

export default settingsService;
