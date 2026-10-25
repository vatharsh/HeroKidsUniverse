import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

export interface CreditPack {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: number;
  salePrice: number | null;
  currency: string;
  packType: "story_credits" | "character_slots" | "avatar_refreshes";
  credits: number;
  bonusCredits: number;
  characterSlots: number;
  avatarRefreshTokens: number;
  totalCredits: number;
  promotionName: string | null;
  promotionType: "percentage" | "flat_amount" | null;
  promotionValue: number | null;
  promotionStart: string | null;
  promotionEnd: string | null;
  badge: string | null;
  isFeatured: boolean;
  isMostPopular: boolean;
  isBestValue: boolean;
  sortOrder: number;
  isActive: boolean;
  // Computed by backend
  effectivePrice: number;
  isOnSale: boolean;
  /** True only while the promotion's sale price applies — show promotionName only then. */
  promotionActive?: boolean;
  /** Price after the promotion ends (e.g. ₹599 after a ₹499 launch offer). */
  afterPromotionPrice?: number | null;
  /** Launch offer: promotion ends this many days after go-live. */
  endsDaysAfterLaunch?: number | null;
  savingsAmount: number;
  savingsPct: number;
}

/** "🔥 Launch offer · ends 24 Dec" — only while the promotion's price applies. */
export function promotionLabel(pack: Pick<CreditPack, "promotionName" | "promotionEnd"> & { promotionActive?: boolean }): string | null {
  if (!pack.promotionName || pack.promotionActive === false) return null;
  const end = pack.promotionEnd ? new Date(pack.promotionEnd) : null;
  return end && !Number.isNaN(end.getTime())
    ? `${pack.promotionName} · ends ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
    : pack.promotionName;
}

export interface CreditWallet {
  balance: number;
  characterSlotsTotal: number;
  characterSlotsUsed: number;
  characterSlotsRemaining: number | null;
  avatarRefreshTokens: number;
  transactions: CreditTransaction[];
}

export interface CreditTransaction {
  id: string;
  userId: string;
  delta: number;
  reason: string;
  referenceId: string | null;
  bonusCredits: number;
  characterSlotsDelta: number;
  avatarRefreshTokensDelta: number;
  packId: string | null;
  packName: string | null;
  pricePaid: number | null;
  createdAt: string;
}

export async function fetchActivePacks(): Promise<CreditPack[]> {
  const res = await fetch(`${BASE}/credits/packs`);
  if (!res.ok) throw new Error("Failed to load credit packs");
  const body = await res.json();
  return (body.data ?? body) as CreditPack[];
}

export async function fetchAllPacksAdmin(): Promise<CreditPack[]> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/admin/credit-packs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load credit packs");
  const body = await res.json();
  return (body.data ?? body) as CreditPack[];
}

export async function createPackAdmin(payload: Record<string, unknown>): Promise<CreditPack> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/admin/credit-packs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(err.message) ? err.message.join(", ") : (err.message ?? "Failed to create pack");
    throw new Error(msg);
  }
  const body = await res.json();
  return (body.data ?? body) as CreditPack;
}

export async function updatePackAdmin(id: string, payload: Record<string, unknown>): Promise<CreditPack> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/admin/credit-packs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(err.message) ? err.message.join(", ") : (err.message ?? "Failed to update pack");
    throw new Error(msg);
  }
  const body = await res.json();
  return (body.data ?? body) as CreditPack;
}

export async function deletePackAdmin(id: string): Promise<void> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/admin/credit-packs/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete pack");
}

export async function initiatePurchase(packId: string): Promise<{
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/credits/packs/${packId}/purchase/initiate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Failed to initiate purchase");
  }
  const body = await res.json();
  return (body.data ?? body) as { razorpayOrderId: string; amount: number; currency: string; keyId: string };
}

export async function verifyPurchase(
  packId: string,
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
): Promise<{ newBalance: number }> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/credits/packs/${packId}/purchase/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ razorpayOrderId, razorpayPaymentId, razorpaySignature }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(err.message ?? "Payment verification failed");
  }
  const body = await res.json();
  return (body.data ?? body) as { newBalance: number };
}
