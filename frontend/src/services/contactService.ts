import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api/contacts`;

type ContactQuery = {
  q?: string;
  status?: string;
};

type ContactPayload = {
  name: string;
  phone: string;
  email?: string;
  status?: string;
};

export const getContacts = async ({ q, status }: ContactQuery = {}) => {
  const query = new URLSearchParams();
  if (q) query.append("q", q);
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
