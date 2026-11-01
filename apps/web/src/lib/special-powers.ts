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

export interface PowerLevel { sets: number; key: "bronze" | "silver" | "gold" | "platinum"; name: string; badge: string; reward: string; rewardText: string }
export interface Progress {
  count: number;
  total: number;
  completeSets: number;
  level: PowerLevel | null;
  next: PowerLevel | null;
  closest: { name: string; emoji: string; missing: number } | null;
}
export interface PowerDrop { id: string; name: string; emoji: string; description: string; collection: { name: string; emoji: string } | null }

export type StoryPowerSpot =
  | { active: false }
  | ({ active: true; drop: PowerDrop; found: boolean; foundToday: number | null; pageIndex: number; x: number; y: number } & Progress);

export interface ClaimResult extends Progress {
  power: { name: string; emoji: string; description: string };
  heroName: string;
  isBonus: boolean;
  addedToUniverse: boolean;
  completedCollection: { name: string; emoji: string } | null;
  newLevel: { name: string; badge: string } | null;
  reward: string | null;
}

export interface HeroToday extends Progress { id: string; name: string | null; foundToday: boolean }

export interface PowerBook extends Progress {
  hero: { id: string; name: string | null };
  levels: PowerLevel[];
  collections: Array<{
    key: string; name: string; emoji: string; have: number; total: number; complete: boolean;
    powers: Array<{ key: string; found: true; name: string; emoji: string; description: string; foundAt: string } | { key: string; found: false }>;
  }>;
  bonus: Array<{ name: string; emoji: string; description: string; foundAt: string }>;
}

export interface LibraryPower { key: string; collection: string; name: string; emoji: string; description: string }
export interface AdminDrop { id: string; day: string; powerKey: string | null; name: string; emoji: string; description: string; finds: number }

let todayOnce: Promise<{ drop: { name: string; emoji: string; foundToday: number | null } | null; heroes: HeroToday[] }> | null = null;

export const specialPowersApi = {
  /** No login needed — for the home page announcement. */
  publicToday: () => req<{ name: string; emoji: string; foundToday: number | null } | null>("/special-powers/public-today"),
  /** Shared per page load: the banner and every hero frame use the same request. */
  today: () => (todayOnce ??= req<{ drop: { name: string; emoji: string; foundToday: number | null } | null; heroes: HeroToday[] }>("/special-powers/today").catch((e) => { todayOnce = null; throw e; })),
  book: (heroId: string) => req<PowerBook>(`/special-powers/book/${heroId}`),
  forStory: (storyId: string) => req<StoryPowerSpot>(`/special-powers/story/${storyId}`),
  claim: (storyId: string, dropId: string) => { todayOnce = null; return req<ClaimResult>(`/special-powers/story/${storyId}/claim`, { method: "POST", body: JSON.stringify({ dropId }) }); },
  adminList: () => req<{ today: string; drops: AdminDrop[]; totals: { finds: number; heroes: number }; levels: PowerLevel[]; collections: Array<{ key: string; name: string; emoji: string }> }>("/admin/special-powers"),
  library: () => req<{ collections: Array<{ key: string; name: string; emoji: string }>; powers: LibraryPower[] }>("/admin/special-powers/library"),
  create: (body: { day: string; powerKey?: string | null; name?: string; emoji?: string; description?: string }) => req<AdminDrop>("/admin/special-powers", { method: "POST", body: JSON.stringify(body) }),
  plan: (weeks = 2) => req<{ created: number }>("/admin/special-powers/plan", { method: "POST", body: JSON.stringify({ weeks }) }),
  remove: (id: string) => req<{ ok: true }>(`/admin/special-powers/${id}`, { method: "DELETE" }),
};
