import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api/whatsapp`;

type JsonRecord = Record<string, unknown>;

export const sendMessage = async (to: string, template_name: string) => {
  const response = await fetch(`${API_URL}/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to,
      template_name,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to send WhatsApp message: ${response.statusText}`);
  }

  return response.json();
};

export const getWhatsAppInfo = async () => {
  const response = await fetch(`${API_URL}/info`);

  if (!response.ok) {
    throw new Error(`Failed to fetch WhatsApp info: ${response.statusText}`);
  }

  return response.json();
};

export const getWhatsAppSettings = async () => {
  const urls = [
    `${API_URL}/settings`,
    "http://127.0.0.1:8000/api/whatsapp/settings",
    "http://localhost:8000/api/whatsapp/settings",
  ];

  if (typeof window !== "undefined") {
    try {
      const proto = window.location.protocol;
      const host = window.location.hostname;
      const candidate = `${proto}//${host}:8000/api/whatsapp/settings`;
      if (!urls.includes(candidate)) urls.push(candidate);
    } catch {
      // ignore
    }
  }

  let lastErr: unknown = null;
  const attempted: string[] = [];

  for (const url of urls) {
    attempted.push(url);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status} from ${url}`, attempted };
      }

      const json = await response.json();

      if (json && typeof json === "object") {
        return {
          ...(json as JsonRecord),
          _from_url: url,
          attempted,
        };
      }

      return { success: true, settings: json, _from_url: url, attempted };
    } catch (err) {
      lastErr = err;
    }
  }

  return {
    success: false,
    error: lastErr ? String(lastErr) : "Failed to fetch settings",
    attempted,
  };
};

export const updateWhatsAppSettings = async (payload: JsonRecord) => {
  const urls = [
    `${API_URL}/settings`,
    "http://127.0.0.1:8000/api/whatsapp/settings",
    "http://localhost:8000/api/whatsapp/settings",
  ];

  if (typeof window !== "undefined") {
    try {
      const proto = window.location.protocol;
      const host = window.location.hostname;
      const candidate = `${proto}//${host}:8000/api/whatsapp/settings`;
      if (!urls.includes(candidate)) urls.push(candidate);
    } catch {
      // ignore
    }
  }

  let lastErr: unknown = null;
  const attempted: string[] = [];

  for (const url of urls) {
    attempted.push(url);
    try {
      const response = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status} from ${url}`, attempted };
      }

      const json = await response.json();
      if (json && typeof json === "object") {
        return {
          ...(json as JsonRecord),
          _from_url: url,
          attempted,
        };
      }

      return { success: true, settings: json, _from_url: url, attempted };
    } catch (err) {
      lastErr = err;
    }
  }

  return {
    success: false,
    error: lastErr ? String(lastErr) : "Failed to update settings",
    attempted,
  };
};

export const rotateAccessToken = async () => {
  const response = await fetch(`${API_URL}/actions/rotate-token`, { method: "POST" });
  return response.json();
};

export const disconnectAccount = async () => {
  const response = await fetch(`${API_URL}/actions/disconnect`, { method: "POST" });
  return response.json();
};

export const getActivityLogs = async (limit = 25) => {
  const response = await fetch(`${API_URL}/activity-logs?limit=${limit}`);
  if (!response.ok) throw new Error("Failed to fetch activity logs");
  return response.json();
};
