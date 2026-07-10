import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api/contacts`;

type ContactQuery = {
  q?: string;
  organization_id?: string | number;
  status?: string;
};

type ContactPayload = {
  name: string;
  phone: string;
  email?: string;
  organization_id?: string | number | null;
  status?: string;
};

const normalizeOrganizationId = (organization_id?: string | number | null) => {
  if (organization_id === undefined || organization_id === null || organization_id === "") {
    return null;
  }

  const parsed = Number(organization_id);
  return Number.isNaN(parsed) ? null : parsed;
};

export const getContacts = async ({ q, organization_id, status }: ContactQuery = {}) => {
  const query = new URLSearchParams();
  if (q) query.append("q", q);
  if (organization_id && organization_id !== "all") query.append("organization_id", String(organization_id));
  if (status && status !== "all") query.append("status", status);
  const url = query.toString() ? `${API_URL}/?${query.toString()}` : API_URL;
  const response = await fetch(url);
  return response.json();
};

export const createContact = async (contact: ContactPayload) => {
  const response = await fetch(`${API_URL}/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: contact.name,
      phone_number: contact.phone,
      email: contact.email,
      organization_id: normalizeOrganizationId(contact.organization_id),
      status: contact.status || "Active",
    }),
  });

  return response.json();
};

export const updateContact = async (id: string | number, contact: ContactPayload) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: contact.name,
      phone_number: contact.phone,
      email: contact.email,
      organization_id: normalizeOrganizationId(contact.organization_id),
      status: contact.status || "Active",
    }),
  });

  return response.json();
};

export const importContacts = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_URL}/import`, {
    method: "POST",
    body: formData,
  });

  return response.json();
};

export const deleteContactApi = async (id: string | number) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });

  return response.json();
};
