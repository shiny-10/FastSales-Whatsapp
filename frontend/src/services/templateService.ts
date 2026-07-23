import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api/templates`;

type TemplatePayload = Record<string, unknown>;

export const getTemplates = async () => {
  try {
    const response = await fetch(API_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch templates: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error fetching templates:", error);
    throw error;
  }
};

export const syncAllTemplates = async () => {
  try {
    const response = await fetch(`${API_URL}/sync-all`, { method: "POST" });
    if (!response.ok) {
      throw new Error(`Failed to sync templates: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error syncing all templates:", error);
    throw error;
  }
};

export const createTemplate = async (template: TemplatePayload | FormData) => {
  try {
    let response: Response;

    if (template instanceof FormData) {
      response = await fetch(`${API_URL}/create`, {
        method: "POST",
        body: template,
      });
    } else {
      response = await fetch(`${API_URL}/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(template),
      });
    }

    let result: any = {};
    try { result = await response.json(); } catch { /* non-JSON body */ }

    if (!response.ok) {
      throw new Error(result?.error || result?.detail || `Server error ${response.status}`);
    }

    if (result.success === false) {
      throw new Error(result.error || "Template creation failed");
    }

    return result;
  } catch (error) {
    console.error("Error creating template:", error);
    throw error;
  }
};

export const updateTemplate = async (id: string | number, template: TemplatePayload) => {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(template),
    });

    if (!response.ok) {
      throw new Error(`Failed to update template: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.success === false) {
      throw new Error(result.message || "Failed to update template");
    }
    return result;
  } catch (error) {
    console.error("Error updating template:", error);
    throw error;
  }
};

export const deleteTemplate = async (id: string | number) => {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete template: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.success === false) {
      throw new Error(result.message || "Failed to delete template");
    }
    return result;
  } catch (error) {
    console.error("Error deleting template:", error);
    throw error;
  }
};

export const syncTemplateStatus = async (id: string | number) => {
  try {
    const response = await fetch(`${API_URL}/${id}/sync`, { method: "POST" });

    if (!response.ok) {
      throw new Error(`Failed to sync template status: ${response.statusText}`);
    }

    const result = await response.json();
    if (result.success === false) {
      return result;
    }
    return result;
  } catch (error) {
    console.error("Error syncing template status:", error);
    throw error;
  }
};

export const resubmitTemplate = async (id: string | number) => {
  try {
    const response = await fetch(`${API_URL}/resubmit/${id}`, { method: "POST" });
    let result: any = {};
    try { result = await response.json(); } catch { /* non-JSON */ }
    if (!response.ok || result.success === false) {
      const err: any = new Error(result.message || `Resubmit failed (${response.status})`);
      if (result.hint) err.hint = result.hint;
      throw err;
    }
    return result;
  } catch (error) {
    console.error("Error resubmitting template:", error);
    throw error;
  }
};

export const getRecentActivities = async (limit = 5) => {
  try {
    const response = await fetch(`${API_URL}/activity/recent?limit=${limit}`);

    if (!response.ok) {
      throw new Error(`Failed to fetch recent activities: ${response.statusText}`);
    }

    const activities = await response.json();
    return activities;
  } catch (error) {
    console.error("Error fetching recent activities:", error);
    throw error;
  }
};
