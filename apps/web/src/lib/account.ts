import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

function authHeaders() {
  const token = getAccessToken();
  return { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), ...init });
  const body = await res.json();
  if (!res.ok) {
    const msg = Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? "Request failed");
    throw new Error(msg);
  }
  return (body.data ?? body) as T;
}

// ── Profile ──────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profileImageUrl: string | null;
  role: string;
  plan: string;
  credits: number;
  characterSlotsTotal: number;
  characterSlotsUsed: number;
  avatarRefreshTokens: number;
  referralCode: string | null;
  createdAt: string;
}

export const profileApi = {
  get: () => req<UserProfile>("/users/me"),
  update: (body: { name?: string; phone?: string }) =>
    req<UserProfile>("/users/me", { method: "PATCH", body: JSON.stringify(body) }),
  changePassword: (body: { currentPassword: string; newPassword: string; confirmPassword: string }) =>
    req<{ message: string }>("/users/me/password", { method: "PATCH", body: JSON.stringify(body) }),
};

// ── Addresses ────────────────────────────────────────────────────────────────

export interface UserAddress {
  id: string;
  label: string | null;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
  isDefault: boolean;
  createdAt: string;
}

export type AddressPayload = Omit<UserAddress, "id" | "createdAt" | "isDefault"> & { isDefault?: boolean };

export const addressesApi = {
  list: () => req<UserAddress[]>("/users/me/addresses"),
  create: (body: AddressPayload) =>
    req<UserAddress>("/users/me/addresses", { method: "POST", body: JSON.stringify(body) }),
  update: (id: string, body: Partial<AddressPayload>) =>
    req<UserAddress>(`/users/me/addresses/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
  setDefault: (id: string) =>
    req<UserAddress>(`/users/me/addresses/${id}/set-default`, { method: "PATCH", body: JSON.stringify({}) }),
  delete: (id: string) =>
    req<{ message: string }>(`/users/me/addresses/${id}`, { method: "DELETE" }),
};

// ── Notification Preferences ─────────────────────────────────────────────────

export interface NotificationPrefs {
  id: string;
  orderUpdates: boolean;
  storyUpdates: boolean;
  promotionalEmails: boolean;
  specialOffers: boolean;
}

export const notifApi = {
  get: () => req<NotificationPrefs>("/users/me/notification-preferences"),
  update: (body: Partial<Omit<NotificationPrefs, "id">>) =>
    req<NotificationPrefs>("/users/me/notification-preferences", { method: "PATCH", body: JSON.stringify(body) }),
};

// ── Credit Transactions ──────────────────────────────────────────────────────

export interface CreditTransaction {
  id: string;
  delta: number;
  reason: string;
  packName: string | null;
  pricePaid: number | null;
  bonusCredits: number;
  createdAt: string;
}

export interface CreditTransactionsPage {
  items: CreditTransaction[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export const creditsApi = {
  getBalance: () => req<{ balance: number; characterSlotsTotal: number; characterSlotsUsed: number; avatarRefreshTokens: number; transactions: CreditTransaction[] }>("/credits"),
  getTransactions: (page = 1, limit = 20) =>
    req<CreditTransactionsPage>(`/credits/transactions?page=${page}&limit=${limit}`),
};
