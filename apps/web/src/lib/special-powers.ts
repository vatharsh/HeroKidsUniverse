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

export interface PowerLevel { at: number; name: string; badge: string; reward: string; rewardText: string }
export interface Progress { count: number; level: PowerLevel | null; next: PowerLevel | null; toNext: number }
export interface PowerDrop { id: string; name: string; emoji: string; description: string }

export type StoryPowerSpot =
  | { active: false }
  | ({ active: true; drop: PowerDrop; found: boolean; pageIndex: number; x: number; y: number } & Progress);

export interface ClaimResult extends Progress {
  power: { name: string; emoji: string; description: string };
  heroName: string;
  addedToUniverse: boolean;
  newLevel: { name: string; badge: string } | null;
  reward: string | null;
}

export interface AdminDrop { id: string; day: string; name: string; emoji: string; description: string; finds: number }

export const specialPowersApi = {
  today: () => req<{ drop: { name: string; emoji: string } | null; heroes: Array<{ id: string; name: string | null; foundToday: boolean } & Progress> }>("/special-powers/today"),
  forStory: (storyId: string) => req<StoryPowerSpot>(`/special-powers/story/${storyId}`),
  claim: (storyId: string, dropId: string) => req<ClaimResult>(`/special-powers/story/${storyId}/claim`, { method: "POST", body: JSON.stringify({ dropId }) }),
  adminList: () => req<{ today: string; drops: AdminDrop[]; totals: { finds: number; heroes: number }; levels: PowerLevel[] }>("/admin/special-powers"),
  suggestions: () => req<Array<{ name: string; emoji: string; description: string }>>("/admin/special-powers/suggestions"),
  create: (body: { day: string; name: string; emoji: string; description: string }) => req<AdminDrop>("/admin/special-powers", { method: "POST", body: JSON.stringify(body) }),
  plan: (weeks = 2) => req<{ created: number; ranOutOfIdeas: boolean }>("/admin/special-powers/plan", { method: "POST", body: JSON.stringify({ weeks }) }),
  remove: (id: string) => req<{ ok: true }>(`/admin/special-powers/${id}`, { method: "DELETE" }),
};
