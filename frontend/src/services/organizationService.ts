import BASE_URL from "./api";

const API_URL = `${BASE_URL}/api/organizations`;

type OrganizationQuery = {
  q?: string;
  status?: string;
  sort?: string;
};

export const getOrganizations = async ({ q, status, sort }: OrganizationQuery = {}) => {
  const query = new URLSearchParams();

  if (q) query.append("q", q);
  if (status) query.append("status", status);
  if (sort) query.append("sort", sort);

  const response = await fetch(`${API_URL}/?${query.toString()}`);
  return response.json();
};

export const getOrganization = async (id: string | number) => {
  const response = await fetch(`${API_URL}/${id}`);
  return response.json();
};

export const createOrganization = async (data: Record<string, unknown>) => {
  const response = await fetch(`${API_URL}/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const updateOrganization = async (id: string | number, data: Record<string, unknown>) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
  return response.json();
};

export const deleteOrganization = async (id: string | number) => {
  const response = await fetch(`${API_URL}/${id}`, {
    method: "DELETE",
  });
  return response.json();
};
