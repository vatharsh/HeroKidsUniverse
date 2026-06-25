import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Design (still used by create flow) ──────────────────────────────────────

export interface MerchandiseDesign {
  id: string;
  userId: string;
  productId: string;
  productName: string;
  fulfillmentType: "digital" | "physical";
  universeId: string | null;
  storyId: string | null;
  heroId: string | null;
  displayName: string | null;
  titleText: string | null;
  subtitle: string | null;
  message: string | null;
  themeColor: string | null;
  quantity: number;
  data: Record<string, unknown>;
  previewUrl: string | null;
  selectedVariants: Record<string, string> | null;
  createdAt: string;
  updatedAt: string;
}

export async function createMerchandiseDesign(payload: Record<string, unknown>): Promise<MerchandiseDesign> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/merchandise/designs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(errBody.message) ? errBody.message.join(", ") : (errBody.message ?? "Failed to create merchandise design");
    throw new Error(msg);
  }
  const body = await res.json();
  return (body.data ?? body) as MerchandiseDesign;
}

export async function generateMerchandisePreview(designId: string): Promise<MerchandiseDesign> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/merchandise/designs/${designId}/preview`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(errBody.message) ? errBody.message.join(", ") : (errBody.message ?? "Failed to generate preview");
    throw new Error(msg);
  }
  const body = await res.json();
  return (body.data ?? body) as MerchandiseDesign;
}

// ─── Catalog v2 types ─────────────────────────────────────────────────────────

export interface CatalogProductAttributeValue {
  id: string;
  attributeId: string;
  value: string;
  label: string;
  priceModifier: number;
  metadataJson: Record<string, unknown> | null;
  isActive: boolean;
  sortOrder: number;
}

export interface CatalogProductAttribute {
  id: string;
  productId: string;
  name: string;
  slug: string;
  inputType: string;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  values: CatalogProductAttributeValue[];
}

export interface CatalogSizeChartEntry {
  id: string;
  productId: string;
  sizeLabel: string;
  ageRange: string | null;
  chestInches: number | null;
  lengthInches: number | null;
  shoulderInches: number | null;
  chestCm: number | null;
  lengthCm: number | null;
  shoulderCm: number | null;
  sortOrder: number;
  isActive: boolean;
}

export interface CatalogProduct {
  id: string;
  categoryId: string;
  name: string;
  slug: string;
  description: string | null;
  productType: "digital" | "physical";
  basePrice: number;
  salePrice: number | null;
  previewImageUrl: string | null;
  requiredAssetType: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  attributes?: CatalogProductAttribute[];
  sizeChart?: CatalogSizeChartEntry[];
}

export interface OrderV2Item {
  productSlug: string;
  quantity: number;
  designId?: string;
  heroId?: string;
  storyId?: string;
  universeId?: string;
  selectedAttributes?: Record<string, string>;
}

export interface CreateOrderV2Dto {
  items: OrderV2Item[];
  paymentMethod: "cash" | "card" | "upi";
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingName?: string;
  shippingPhone?: string;
  shippingAddressLine1?: string;
  shippingAddressLine2?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPincode?: string;
  shippingCountry?: string;
  couponCode?: string;
}

export interface OrderV2Detail {
  id: string;
  orderNumber: string;
  userId: string;
  orderType: string;
  status: string;
  subtotalAmount: number;
  discountAmount: number;
  shippingAmount: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  paymentMethod: string | null;
  couponCode: string | null;
  couponType: string | null;
  couponDiscountType: string | null;
  couponDiscountValue: number | null;
  couponDiscountAmount: number | null;
  items: Array<Record<string, unknown>>;
  paymentSummary: Record<string, unknown> | null;
  statusHistory: Array<Record<string, unknown>>;
  createdAt: string;
  updatedAt: string;
}

export interface OrderV2ListResponse {
  items: Array<{
    id: string;
    orderNumber: string;
    status: string;
    orderType: string;
    totalAmount: number;
    currency: string;
    itemCount: number;
    createdAt: string;
    items: Array<{
      productNameSnapshot: string;
      categoryNameSnapshot: string | null;
      quantity: number;
      unitPrice: number;
      totalPrice: number;
      previewUrl: string | null;
      attributeSummary: string;
    }>;
  }>;
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Catalog v2 API functions ─────────────────────────────────────────────────

export async function fetchCatalogProducts(categorySlug?: string): Promise<CatalogProduct[]> {
  const params = categorySlug ? `?categorySlug=${encodeURIComponent(categorySlug)}` : "";
  const res = await fetch(`${BASE}/merchandise/catalog/products${params}`);
  if (!res.ok) throw new Error("Failed to load catalog products");
  const body = await res.json();
  return (body.data ?? body) as CatalogProduct[];
}

export async function fetchCatalogProductBySlug(slug: string): Promise<CatalogProduct> {
  const res = await fetch(`${BASE}/merchandise/catalog/products/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Product not found");
  const body = await res.json();
  return (body.data ?? body) as CatalogProduct;
}

export async function fetchMyOrdersV2(): Promise<OrderV2ListResponse> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/merchandise/v2/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load orders");
  const body = await res.json();
  return (body.data ?? body) as OrderV2ListResponse;
}

export async function fetchOrderV2Detail(id: string): Promise<OrderV2Detail> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/merchandise/v2/orders/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to load order");
  const body = await res.json();
  return (body.data ?? body) as OrderV2Detail;
}

export async function createOrderV2(payload: CreateOrderV2Dto): Promise<OrderV2Detail> {
  const token = getAccessToken();
  const res = await fetch(`${BASE}/merchandise/v2/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(errBody.message) ? errBody.message.join(", ") : (errBody.message ?? "Failed to place order");
    throw new Error(msg);
  }
  const body = await res.json();
  return (body.data ?? body) as OrderV2Detail;
}
