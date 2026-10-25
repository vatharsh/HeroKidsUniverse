import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(Array.isArray(body.message) ? body.message.join(", ") : (body.message ?? "Request failed"));
  return (body.data ?? body) as T;
}

export type SupportReason = "credits_missing" | "charged_twice" | "story_wrong" | "other";
export type SupportStatus = "open" | "credited" | "refunded" | "declined" | "resolved";

export interface SupportRequest {
  id: string;
  orderId: string | null;
  storyId: string | null;
  reason: SupportReason;
  reasonText: string;
  message: string;
  status: SupportStatus;
  statusText: string;
  adminReply: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface AdminSupportRequest extends SupportRequest {
  user: { id: string; name: string | null; email: string; credits: number } | null;
  order: { id: string; orderNumber: string; total: number; status: string; isCreditPack: boolean } | null;
  story: { id: string; title: string | null; isPreview: boolean; status: string; createdAt: string } | null;
}

export const SUPPORT_REASONS: Array<{ value: SupportReason; label: string; forOrder: boolean; forStory: boolean }> = [
  { value: "story_wrong",     label: "A story came out wrong (hero doesn't look right, broken pictures, text doesn't make sense)", forOrder: true, forStory: true },
  { value: "credits_missing", label: "I was charged but my credits didn't arrive", forOrder: true, forStory: false },
  { value: "charged_twice",   label: "I was charged twice", forOrder: true, forStory: false },
  { value: "other",           label: "Something else", forOrder: true, forStory: true },
];

export const supportApi = {
  create: (body: { orderId?: string; storyId?: string; reason: SupportReason; message: string }) =>
    req<SupportRequest>("/support/requests", { method: "POST", body: JSON.stringify(body) }),
  mine: () => req<SupportRequest[]>("/support/requests/mine"),
  myStories: () => req<Array<{ id: string; title: string | null; createdAt: string; status: string }>>("/stories"),
  adminList: (status = "open") => req<{ open: number; items: AdminSupportRequest[] }>(`/admin/support-requests?status=${status}`),
  resolve: (id: string, action: "credit" | "refunded" | "declined" | "resolved", reply: string) =>
    req<SupportRequest>(`/admin/support-requests/${id}/resolve`, { method: "POST", body: JSON.stringify({ action, reply }) }),
};
