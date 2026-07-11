const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

function _authHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("jwt");
  if (token) return { Authorization: `Bearer ${token}` };
  return {};
}

export async function listConversations() {
  const res = await fetch(`${API_BASE}/api/conversations`, { headers: { ..._authHeaders() } });
  return res.json();
}

export async function getConversation(id: string | number) {
  const res = await fetch(`${API_BASE}/api/conversations/${id}`, { headers: { ..._authHeaders() } });
  return res.json();
}

export async function listMessages(conversationId: string | number) {
  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}/messages`, { headers: { ..._authHeaders() } });
  return res.json();
}

export async function sendMessage(payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/messages/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ..._authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function createConversation(payload: Record<string, unknown>) {
  const res = await fetch(`${API_BASE}/api/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ..._authHeaders() },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export default {
  listConversations,
  getConversation,
  listMessages,
  sendMessage,
  createConversation,
};
