import { create } from "zustand";

export interface User {
  id: string;
  company_id: string;
  email: string;
  name: string;
  role: "ADMIN" | "MANAGER" | "AGENT";
}

interface UserState {
  user: User;
  setUser: (user: User) => void;
}

export const useAuthStore = create<UserState>()((set) => ({
  user: {
    id: "dev",
    company_id: "ffffffff-ffff-ffff-ffff-ffffffffffff",
    email: "admin@dev.local",
    name: "Developer",
    role: "ADMIN",
  },
  setUser: (user) => set({ user }),
}));
