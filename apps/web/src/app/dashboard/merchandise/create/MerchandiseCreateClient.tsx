"use client";

import {
  ArrowRight,
  Award,
  BadgeCheck,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  FileText,
  Image as ImageIcon,
  Info,
  Layers,
  Loader2,
  Palette,
  Package,
  Printer,
  Ruler,
  Shirt,
  ShoppingCart,
  Sparkles,
  Trash2,
  Truck,
  UserRound,
  X,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useMemo, useState } from "react";

import Footer from "@/components/layout/Footer";
import Navbar from "@/components/layout/Navbar";
import Breadcrumb from "@/components/shared/Breadcrumb";
import ProductMockup from "@/components/shared/ProductMockup";
import { useAuth } from "@/contexts/AuthContext";
import { usePublicPlatformSettings } from "@/lib/platform-settings";
import {
  createMerchandiseDesign,
  createOrderV2,
  fetchCatalogProducts,
  fetchCatalogProductBySlug,
  generateMerchandisePreview,
  type CatalogProduct,
  type CatalogSizeChartEntry,
  type MerchandiseDesign,
} from "@/lib/merchandise";
import { getAccessToken } from "@/lib/api";
import { addressesApi, type UserAddress } from "@/lib/account";
import { cn } from "@/lib/utils";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Local types ──────────────────────────────────────────────────────────────

interface Universe { id: string; name: string; heroTitle: string | null; tagline: string | null; }
interface Hero { id: string; name: string | null; avatarUrl: string | null; universeId: string | null; }
interface Character { id: string; name: string; role: string; avatarUrl: string | null; universeId: string | null; }
interface Story { id: string; title: string | null; coverImageUrl: string | null; universeId: string | null; hero?: { name: string | null } | null; }

type Step = "product" | "asset" | "customize" | "preview";
type SourceType = "universe" | "story" | "hero" | "manual";

interface CartItem {
  id: string;
  design: MerchandiseDesign;
  product: CatalogProduct;
  quantity: number;
  heroName: string;
  storyTitle: string;
  selectedVariants: Record<string, string>;
  variantLabel: string;
  effectiveUnitPrice: number;
}

// ─── Variant catalog (mirrors backend seed data, used for local pricing + UI) ─

interface VariantOption { value: string; label: string; priceModifier: number; description?: string; hex?: string; }
interface VariantDef { key: string; label: string; type: string; options: VariantOption[]; isRequired?: boolean; }

// Fallback constants — values MUST match backend seed (snake_case keys, lowercase values)
const PRODUCT_VARIANTS: Record<string, VariantDef[]> = {
  printed_storybook: [
    {
      key: "binding",
      label: "Edition",
      type: "binding",
      isRequired: true,
      options: [
        { value: "softcover",    label: "Softcover",            priceModifier: 0,    description: "Flexible paperback cover" },
        { value: "hardcover",    label: "Hardcover",            priceModifier: 700,  description: "Rigid durable cover" },
        { value: "premium_gift", label: "Premium Gift Edition", priceModifier: 1700, description: "Gift box with ribbon & sleeve" },
      ],
    },
  ],
  hero_apparel: [
    {
      key: "size",
      label: "Size",
      type: "size",
      isRequired: true,
      options: [
        { value: "2-3Y",   label: "2-3Y",   priceModifier: 0 },
        { value: "3-4Y",   label: "3-4Y",   priceModifier: 0 },
        { value: "5-6Y",   label: "5-6Y",   priceModifier: 0 },
        { value: "7-8Y",   label: "7-8Y",   priceModifier: 0 },
        { value: "9-10Y",  label: "9-10Y",  priceModifier: 0 },
        { value: "11-12Y", label: "11-12Y", priceModifier: 0 },
        { value: "13-14Y", label: "13-14Y", priceModifier: 0 },
        { value: "15-16Y", label: "15-16Y", priceModifier: 0 },
        { value: "S",      label: "S",      priceModifier: 0 },
        { value: "M",      label: "M",      priceModifier: 0 },
        { value: "L",      label: "L",      priceModifier: 0 },
        { value: "XL",     label: "XL",     priceModifier: 0 },
        { value: "XXL",    label: "XXL",    priceModifier: 0 },
      ],
    },
    {
      key: "color",
      label: "Color",
      type: "color",
      isRequired: true,
      options: [
        { value: "white",    label: "White",    priceModifier: 0, hex: "#FFFFFF" },
        { value: "black",    label: "Black",    priceModifier: 0, hex: "#111111" },
        { value: "purple",   label: "Purple",   priceModifier: 0, hex: "#7C3AED" },
        { value: "sky_blue", label: "Sky Blue", priceModifier: 0, hex: "#0EA5E9" },
        { value: "yellow",   label: "Yellow",   priceModifier: 0, hex: "#F59E0B" },
      ],
    },
    {
      key: "placement",
      label: "Print Placement",
      type: "placement",
      isRequired: true,
      options: [
        { value: "front_center", label: "Front Center", priceModifier: 0 },
        { value: "back_center",  label: "Back Center",  priceModifier: 0 },
        { value: "front_back",   label: "Front + Back", priceModifier: 0 },
      ],
    },
  ],
};

// ─── Size chart ───────────────────────────────────────────────────────────────

interface SizeRow { label: string; ageRange: string; chestIn: number; lengthIn: number; shoulderIn: number; }

const KIDS_SIZES: SizeRow[] = [
  { label: "2-3Y",   ageRange: "2–3 Years",   chestIn: 22, lengthIn: 15.5, shoulderIn: 10.5 },
  { label: "3-4Y",   ageRange: "3–4 Years",   chestIn: 24, lengthIn: 16.5, shoulderIn: 11   },
  { label: "5-6Y",   ageRange: "5–6 Years",   chestIn: 26, lengthIn: 18,   shoulderIn: 12   },
  { label: "7-8Y",   ageRange: "7–8 Years",   chestIn: 28, lengthIn: 19.5, shoulderIn: 12.5 },
  { label: "9-10Y",  ageRange: "9–10 Years",  chestIn: 30, lengthIn: 21,   shoulderIn: 13.5 },
  { label: "11-12Y", ageRange: "11–12 Years", chestIn: 32, lengthIn: 22.5, shoulderIn: 14   },
  { label: "13-14Y", ageRange: "13–14 Years", chestIn: 34, lengthIn: 24,   shoulderIn: 15   },
  { label: "15-16Y", ageRange: "15–16 Years", chestIn: 36, lengthIn: 25,   shoulderIn: 15.5 },
];

const ADULT_SIZES: SizeRow[] = [
  { label: "S",   ageRange: "Adult", chestIn: 38, lengthIn: 27, shoulderIn: 16.5 },
  { label: "M",   ageRange: "Adult", chestIn: 40, lengthIn: 28, shoulderIn: 17.5 },
  { label: "L",   ageRange: "Adult", chestIn: 42, lengthIn: 29, shoulderIn: 18.5 },
  { label: "XL",  ageRange: "Adult", chestIn: 44, lengthIn: 30, shoulderIn: 19.5 },
  { label: "XXL", ageRange: "Adult", chestIn: 46, lengthIn: 31, shoulderIn: 20.5 },
];

function inToCm(inches: number) { return Math.round(inches * 2.54 * 10) / 10; }

// ─── Constants ────────────────────────────────────────────────────────────────

const PAYMENT_METHODS: Array<{ value: "cash" | "card" | "upi"; label: string; hint: string }> = [
  { value: "cash", label: "Cash",  hint: "Pay manually on delivery / collection." },
  { value: "card", label: "Card",  hint: "Manual card confirmation handled by admin." },
  { value: "upi",  label: "UPI",   hint: "UPI payment marked manually for now." },
];

const PRODUCT_META: Record<string, { icon: React.ElementType; bandClass: string; iconClass: string }> = {
  hero_poster_pdf:            { icon: FileText,  bandClass: "bg-violet-50", iconClass: "text-violet-600" },
  hero_certificate_pdf:       { icon: Award,     bandClass: "bg-blue-50",   iconClass: "text-blue-600"   },
  sticker_sheet_pdf:          { icon: Layers,    bandClass: "bg-pink-50",   iconClass: "text-pink-600"   },
  sticker_sheet:              { icon: Layers,    bandClass: "bg-pink-50",   iconClass: "text-pink-600"   },
  printed_hero_poster:        { icon: Printer,   bandClass: "bg-amber-50",  iconClass: "text-amber-600"  },
  hero_poster:                { icon: Printer,   bandClass: "bg-amber-50",  iconClass: "text-amber-600"  },
  printed_story_cover_poster: { icon: ImageIcon, bandClass: "bg-rose-50",   iconClass: "text-rose-600"   },
  printed_storybook:          { icon: BookOpen,  bandClass: "bg-emerald-50",iconClass: "text-emerald-600"},
  hero_apparel:               { icon: Shirt,     bandClass: "bg-sky-50",    iconClass: "text-sky-600"    },
};

// ─── Helper: build variant summary label ─────────────────────────────────────

function buildVariantLabel(productSlug: string, variants: Record<string, string>): string {
  const defs = PRODUCT_VARIANTS[productSlug] ?? [];
  if (!defs.length) return "";
  return defs
    .map((def) => variants[def.key] ?? "")
    .filter(Boolean)
    .join(" · ");
}

function buildVariantLabelFromDefs(defs: VariantDef[], variants: Record<string, string>): string {
  if (!defs.length) return "";
  return defs
    .map((def) => {
      const opt = def.options.find((o) => o.value === variants[def.key]);
      return opt?.label ?? variants[def.key] ?? "";
    })
    .filter(Boolean)
    .join(" · ");
}

// ─── ProductCard ──────────────────────────────────────────────────────────────

function ProductCard({ product, selected, onSelect }: {
  product: CatalogProduct; selected: boolean; onSelect: () => void;
}) {
  const meta = PRODUCT_META[product.slug] ?? { icon: Package, bandClass: "bg-gray-50", iconClass: "text-gray-600" };
  const Icon = meta.icon;
  const isDigital = product.productType === "digital";
  const hasVariantPricing = (PRODUCT_VARIANTS[product.slug] ?? []).some((v) => v.options.some((o) => o.priceModifier > 0));
  const displayPrice = Number(product.salePrice ?? product.basePrice);
  const [imgError, setImgError] = useState(false);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "text-left rounded-2xl border overflow-hidden transition-all bg-white group",
        selected ? "border-brand ring-2 ring-brand/20 shadow-lg -translate-y-0.5" : "border-ink/10 hover:border-brand/30 hover:shadow-md hover:-translate-y-0.5",
      )}
    >
      <div className={cn("relative h-28 flex items-center px-5", meta.bandClass)}>
        {product.previewImageUrl && !imgError && (
          <img src={product.previewImageUrl} alt={product.name} className="absolute inset-0 w-full h-full object-cover opacity-20" onError={() => setImgError(true)} />
        )}
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/70 flex items-center justify-center shadow-sm">
            <Icon className={cn("w-6 h-6", meta.iconClass)} />
          </div>
          <span className={cn(
            "inline-flex text-[10px] font-black uppercase tracking-[0.18em] px-2.5 py-1 rounded-full",
            isDigital ? "bg-violet-100 text-violet-700" : "bg-amber-100 text-amber-700",
          )}>{isDigital ? "Digital" : "Physical"}</span>
        </div>
        {selected && (
          <div className="absolute top-3 right-3 w-6 h-6 rounded-full bg-brand flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        )}
      </div>
      <div className="px-5 py-4">
        <h3 className="font-[family-name:var(--font-display)] text-ink text-base leading-tight">{product.name}</h3>
        <p className="text-ink-muted text-sm mt-1.5 leading-relaxed line-clamp-2">{product.description}</p>
        <div className="flex items-center justify-between mt-4 pt-4 border-t border-ink/5">
          <p className="text-ink text-2xl font-black">
            {hasVariantPricing && <span className="text-sm font-normal text-ink-muted mr-1">from</span>}
            ₹{displayPrice.toLocaleString()}
          </p>
          <span className={cn("text-xs font-bold px-3 py-1.5 rounded-full transition", selected ? "bg-brand text-white" : "bg-ink/5 text-ink-muted group-hover:bg-brand/10 group-hover:text-brand")}>
            {selected ? "Selected" : "Select"}
          </span>
        </div>
      </div>
    </button>
  );
}

// ─── Size Chart Modal ─────────────────────────────────────────────────────────

function SizeChartModal({ selectedSize, sizeChart, onClose }: {
  selectedSize: string;
  sizeChart: CatalogSizeChartEntry[];
  onClose: () => void;
}) {
  const kidsRows = sizeChart.filter((r) => r.sizeLabel.endsWith("Y"));
  const adultRows = sizeChart.filter((r) => !r.sizeLabel.endsWith("Y"));
  const [tab, setTab] = useState<"kids" | "adult">(
    kidsRows.some((r) => r.sizeLabel === selectedSize) ? "kids" : "adult",
  );
  const rows = tab === "kids" ? kidsRows : adultRows;
  const selectedRow = rows.find((r) => r.sizeLabel === selectedSize);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl max-h-[88vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white z-10 px-6 py-4 border-b border-ink/5 flex items-center justify-between rounded-t-3xl">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-brand" />
            <h2 className="font-[family-name:var(--font-display)] text-ink text-xl">Size Chart</h2>
          </div>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-full border border-ink/10 flex items-center justify-center text-ink-muted hover:border-brand hover:text-brand transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-4">
          <div className="flex gap-2 mb-4">
            {(["kids", "adult"] as const).map((t) => (
              <button key={t} type="button" onClick={() => setTab(t)}
                className={cn("px-4 py-2 rounded-full text-sm font-semibold transition capitalize",
                  tab === t ? "bg-brand text-white" : "bg-ink/5 text-ink-muted hover:bg-ink/10")}>
                {t === "kids" ? "Kids (2Y–16Y)" : "Adult (S–XXL)"}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-ink/10">
            <table className="w-full text-sm">
              <thead className="bg-ink/[0.03]">
                <tr>
                  {["Size", "Age", "Chest", "Length", "Shoulder"].map((h) => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] font-black uppercase tracking-[0.16em] text-ink-muted">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.sizeLabel} className={cn("border-t border-ink/5", row.sizeLabel === selectedSize && "bg-brand/5")}>
                    <td className="px-3 py-2.5">
                      <span className={cn("font-black text-sm", row.sizeLabel === selectedSize ? "text-brand" : "text-ink")}>{row.sizeLabel}</span>
                      {row.sizeLabel === selectedSize && <span className="ml-1 text-[9px] font-bold text-brand bg-brand/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">Selected</span>}
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted text-xs">{row.ageRange}</td>
                    <td className="px-3 py-2.5 text-ink text-xs font-medium">{row.chestInches}&quot; / {row.chestCm}cm</td>
                    <td className="px-3 py-2.5 text-ink text-xs font-medium">{row.lengthInches}&quot; / {row.lengthCm}cm</td>
                    <td className="px-3 py-2.5 text-ink text-xs font-medium">{row.shoulderInches}&quot; / {row.shoulderCm}cm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {selectedRow && (
            <div className="mt-4 rounded-2xl border border-brand/20 bg-brand/5 p-4">
              <p className="text-xs font-bold text-brand uppercase tracking-[0.14em] mb-2">Selected: {selectedRow.sizeLabel}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                {[
                  { label: "Chest", inches: selectedRow.chestInches, cm: selectedRow.chestCm },
                  { label: "Length", inches: selectedRow.lengthInches, cm: selectedRow.lengthCm },
                  { label: "Shoulder", inches: selectedRow.shoulderInches, cm: selectedRow.shoulderCm },
                ].map((m) => (
                  <div key={m.label} className="rounded-xl bg-white border border-brand/10 p-2">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{m.label}</p>
                    <p className="text-sm font-black text-ink">{m.inches}&quot;</p>
                    <p className="text-[10px] text-ink-muted">{m.cm}cm</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 flex items-start gap-2">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-700 leading-relaxed">
              Sizes are approximate. Actual garment measurements may vary slightly depending on manufacturing batch and print vendor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MerchandiseCreatePage() {
  const { user, loading: authLoading } = useAuth();
  const { flags, loading: flagsLoading } = usePublicPlatformSettings();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<Step>("product");
  const [sourceType, setSourceType] = useState<SourceType>("manual");
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [productDetail, setProductDetail] = useState<CatalogProduct | null>(null);
  const [universes, setUniverses] = useState<Universe[]>([]);
  const [heroes, setHeroes] = useState<Hero[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedUniverseId, setSelectedUniverseId] = useState("");
  const [selectedHeroId, setSelectedHeroId] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState("");
  const [selectedStoryId, setSelectedStoryId] = useState("");
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  const [displayName, setDisplayName] = useState("");
  const [titleText, setTitleText] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [message, setMessage] = useState("");
  const [themeColor, setThemeColor] = useState("#6d28d9");
  const [quantity, setQuantity] = useState(1);

  const [design, setDesign] = useState<MerchandiseDesign | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewingUrl, setPreviewingUrl] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [showSizeChart, setShowSizeChart] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "upi">("upi");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState(user?.email ?? "");
  const [customerPhone, setCustomerPhone] = useState("");
  const [shippingAddress, setShippingAddress] = useState("");
  const [shippingAddressLine2, setShippingAddressLine2] = useState("");
  const [shippingCity, setShippingCity] = useState("");
  const [shippingState, setShippingState] = useState("");
  const [shippingPincode, setShippingPincode] = useState("");
  const [shippingCountry, setShippingCountry] = useState("India");
  const [shippingName, setShippingName] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [saveAddressChecked, setSaveAddressChecked] = useState(false);

  // Coupon state
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountType: "percentage" | "fixed_amount";
    discountValue: number;
  } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponError, setCouponError] = useState("");

  // ─── Derived ─────────────────────────────────────────────────────────────

  const selectedProduct   = useMemo(() => products.find((p) => p.id === selectedProductId) ?? null, [products, selectedProductId]);
  const selectedHero      = useMemo(() => heroes.find((h) => h.id === selectedHeroId) ?? null, [heroes, selectedHeroId]);
  const selectedCharacter = useMemo(() => characters.find((c) => c.id === selectedCharacterId) ?? null, [characters, selectedCharacterId]);
  const selectedStory     = useMemo(() => stories.find((s) => s.id === selectedStoryId) ?? null, [stories, selectedStoryId]);

  const selectedProductSlug = selectedProduct?.slug ?? "";
  const isStorybookProduct = selectedProductSlug === "printed_storybook";
  const isApparelProduct   = selectedProductSlug === "hero_apparel";
  // requiresVariants is true for any product with required attributes from backend OR known variants
  const requiresVariants   = useMemo(() => {
    if (isStorybookProduct || isApparelProduct) return true;
    // For any product with at least one required attribute loaded from backend
    if (productDetail?.attributes?.some((a) => a.isRequired)) return true;
    // Fall back to checking local PRODUCT_VARIANTS
    return (PRODUCT_VARIANTS[selectedProductSlug] ?? []).length > 0;
  }, [isStorybookProduct, isApparelProduct, productDetail, selectedProductSlug]);

  // Live attribute defs from backend (fallback to local constants while loading)
  const liveDefs = useMemo<VariantDef[]>(() => {
    const backendAttrs = productDetail?.attributes;
    if (!backendAttrs?.length) return PRODUCT_VARIANTS[selectedProductSlug] ?? [];
    return backendAttrs.map((attr) => ({
      key: attr.slug,
      label: attr.name,
      type: attr.slug,
      isRequired: attr.isRequired,
      options: attr.values.map((v) => ({
        value: v.value,
        label: v.label,
        priceModifier: Number(v.priceModifier),
        hex: v.metadataJson?.hex as string | undefined,
        description: v.metadataJson?.description as string | undefined,
      })),
    }));
  }, [productDetail, selectedProductSlug]);

  const filteredHeroes = useMemo(() => {
    if (!selectedUniverseId) return heroes;
    return heroes.filter((h) => h.universeId === selectedUniverseId || h.id === selectedHeroId);
  }, [heroes, selectedUniverseId, selectedHeroId]);

  const filteredCharacters = useMemo(() => {
    if (!selectedUniverseId) return characters;
    return characters.filter((c) => c.universeId === selectedUniverseId || c.universeId === null || c.id === selectedCharacterId);
  }, [characters, selectedUniverseId, selectedCharacterId]);

  const filteredStories = useMemo(() => {
    if (!selectedUniverseId) return stories;
    return stories.filter((s) => s.universeId === selectedUniverseId || s.id === selectedStoryId);
  }, [stories, selectedUniverseId, selectedStoryId]);

  // For storybook: only show stories that have a title AND cover (proxy for "completed")
  const completedStories = useMemo(
    () => filteredStories.filter((s) => s.title && s.coverImageUrl),
    [filteredStories],
  );

  // Heroes + characters merged for step 2
  const allCharacters = useMemo(() => [
    ...filteredHeroes.map((h) => ({ type: "hero" as const, id: h.id, name: h.name ?? "Hero", avatarUrl: h.avatarUrl, universeId: h.universeId, role: "Hero" })),
    ...filteredCharacters.map((c) => ({ type: "character" as const, id: c.id, name: c.name, avatarUrl: c.avatarUrl, universeId: c.universeId, role: c.role })),
  ], [filteredHeroes, filteredCharacters]);

  const merchEnabled   = flagsLoading ? true : flags.ENABLE_MERCHANDISE !== false;
  const physicalEnabled = flagsLoading ? true : flags.ENABLE_PHYSICAL_ORDERS !== false;
  const effectiveProducts = useMemo(
    () => products.filter((p) => physicalEnabled || p.productType === "digital"),
    [products, physicalEnabled],
  );

  const canContinueFromAssets = useMemo(() => {
    if (isStorybookProduct) return !!selectedStoryId;
    return !!(selectedHeroId || selectedCharacterId || selectedStoryId);
  }, [isStorybookProduct, selectedStoryId, selectedHeroId, selectedCharacterId]);

  const canContinueFromVariants = useMemo(() => {
    if (!requiresVariants) return true;
    // Only require selection for attrs that have selectable options
    return liveDefs
      .filter((def) => def.options.length > 0 && def.isRequired !== false)
      .every((def) => !!selectedVariants[def.key]);
  }, [requiresVariants, liveDefs, selectedVariants]);

  const variantPriceModifier = useMemo(() => {
    return liveDefs.reduce((sum, def) => {
      const opt = def.options.find((o) => o.value === selectedVariants[def.key]);
      return sum + (opt?.priceModifier ?? 0);
    }, 0);
  }, [liveDefs, selectedVariants]);

  const effectiveUnitPrice = Number(selectedProduct?.salePrice ?? selectedProduct?.basePrice ?? 0) + variantPriceModifier;

  // Prices inclusive of GST
  const cartTotal    = cartItems.reduce((sum, item) => sum + item.effectiveUnitPrice * item.quantity, 0);
  const couponDiscount = appliedCoupon
    ? appliedCoupon.discountType === "percentage"
      ? Math.round(cartTotal * appliedCoupon.discountValue / 100)
      : Math.min(appliedCoupon.discountValue, cartTotal)
    : 0;
  const cartTotalAfterDiscount = Math.max(0, cartTotal - couponDiscount);
  const cartGst      = Math.round(cartTotalAfterDiscount * 18 / 118);
  const cartSubtotal = cartTotalAfterDiscount - cartGst;
  const cartHasPhysical = cartItems.some((item) => item.product.productType === "physical");

  const minQtyForProduct = (productSlug: string) => productSlug === "sticker_sheet_pdf" ? 10 : 1;
  const currentMinQty = minQtyForProduct(selectedProductSlug);

  // ── Product mockup data ────────────────────────────────────────────────────
  const mockupAvatarUrl = useMemo(() => {
    if (selectedHeroId) return filteredHeroes.find(h => h.id === selectedHeroId)?.avatarUrl ?? null;
    if (selectedCharacterId) return filteredCharacters.find(c => c.id === selectedCharacterId)?.avatarUrl ?? null;
    return null;
  }, [selectedHeroId, selectedCharacterId, filteredHeroes, filteredCharacters]);

  const mockupStoryCoverUrl = useMemo(() => {
    if (!selectedStoryId) return null;
    return filteredStories.find(s => s.id === selectedStoryId)?.coverImageUrl ?? null;
  }, [selectedStoryId, filteredStories]);

  const mockupHeroName = useMemo(() => {
    if (selectedHeroId) return filteredHeroes.find(h => h.id === selectedHeroId)?.name ?? undefined;
    if (selectedCharacterId) return filteredCharacters.find(c => c.id === selectedCharacterId)?.name ?? undefined;
    return undefined;
  }, [selectedHeroId, selectedCharacterId, filteredHeroes, filteredCharacters]);

  const mockupStoryTitle = useMemo(() => {
    if (!selectedStoryId) return undefined;
    return filteredStories.find(s => s.id === selectedStoryId)?.title ?? undefined;
  }, [selectedStoryId, filteredStories]);

  const step3Done = requiresVariants ? canContinueFromVariants : !!design;
  const step3Label = isStorybookProduct ? "Choose Edition"
    : isApparelProduct  ? "Choose Size & Style"
    : requiresVariants  ? "Choose Options"
    : "Customize Design";

  // ─── Effects ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (authLoading || flagsLoading) return;
    if (!merchEnabled) return;
    if (!user) { router.push("/login"); return; }

    const token = getAccessToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    setLoading(true);
    Promise.all([
      fetchCatalogProducts().catch(() => [] as CatalogProduct[]),
      fetch(`${BASE}/universes/mine`, { headers }).then((r) => (r.ok ? r.json() : { data: [] })).then((b) => (Array.isArray(b.data) ? b.data : [])).catch(() => [] as Universe[]),
      fetch(`${BASE}/heroes`,         { headers }).then((r) => (r.ok ? r.json() : { data: [] })).then((b) => (Array.isArray(b.data) ? b.data : [])).catch(() => [] as Hero[]),
      fetch(`${BASE}/characters`,     { headers }).then((r) => (r.ok ? r.json() : { data: [] })).then((b) => (Array.isArray(b.data) ? b.data : [])).catch(() => [] as Character[]),
      fetch(`${BASE}/stories`,        { headers }).then((r) => (r.ok ? r.json() : { data: [] })).then((b) => (Array.isArray(b.data) ? b.data : [])).catch(() => [] as Story[]),
    ])
      .then(([productData, universeData, heroData, characterData, storyData]) => {
        setProducts(productData.length ? productData : []);
        setUniverses(universeData);
        setHeroes(heroData);
        setCharacters(characterData);
        setStories(storyData);

        const queryUniverseId = searchParams.get("universeId") ?? "";
        const queryStoryId    = searchParams.get("storyId")    ?? "";
        const queryHeroId     = searchParams.get("heroId")     ?? "";
        const querySource     = (searchParams.get("source") ?? "manual") as SourceType;

        if (querySource)     setSourceType(querySource);
        if (queryUniverseId) setSelectedUniverseId(queryUniverseId);
        if (queryStoryId)    setSelectedStoryId(queryStoryId);
        if (queryHeroId)     setSelectedHeroId(queryHeroId);

        const queryStory   = storyData.find((s: Story)    => s.id === queryStoryId);
        const queryHero    = heroData.find((h: Hero)       => h.id === queryHeroId);
        const queryUniverse = universeData.find((u: Universe) => u.id === queryUniverseId);
        const fallbackUniverseId = queryStory?.universeId ?? queryHero?.universeId ?? queryUniverse?.id ?? universeData[0]?.id ?? "";

        if (!queryUniverseId && fallbackUniverseId) setSelectedUniverseId(fallbackUniverseId);
        if (queryStory?.title) setTitleText(queryStory.title);
        if (queryHero?.name)   setDisplayName(queryHero.name);
        if (queryUniverse?.heroTitle) setDisplayName(queryUniverse.heroTitle);

        const heroName = queryHero?.name ?? queryStory?.hero?.name ?? queryUniverse?.heroTitle ?? user?.name ?? "Hero";
        setCustomerName(heroName);
        setShippingName(heroName);
        setCustomerEmail(user?.email ?? "");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load merchandise"))
      .finally(() => setLoading(false));
  }, [authLoading, flagsLoading, merchEnabled, router, searchParams, user]);

  // Load saved addresses for pre-fill at checkout
  useEffect(() => {
    if (!user) return;
    addressesApi.list()
      .then(list => {
        setSavedAddresses(list);
        // Auto-select default address
        const def = list.find(a => a.isDefault);
        if (def) {
          setSelectedSavedAddressId(def.id);
          setShippingName(def.fullName);
          setShippingAddress(def.addressLine1);
          setShippingAddressLine2(def.addressLine2 ?? "");
          setShippingCity(def.city);
          setShippingState(def.state);
          setShippingPincode(def.pincode);
          setShippingCountry(def.country);
        }
      })
      .catch(() => {});
  }, [user]);

  useEffect(() => {
    if (!selectedProductSlug) return;
    setProductDetail(null);
    void fetchCatalogProductBySlug(selectedProductSlug)
      .then((detail) => setProductDetail(detail))
      .catch(() => null);
  }, [selectedProductSlug]);

  useEffect(() => {
    if (!selectedStoryId) return;
    const story = stories.find((s) => s.id === selectedStoryId);
    if (story?.universeId) setSelectedUniverseId(story.universeId);
    if (story?.title && !titleText) setTitleText(story.title);
    if (story?.hero?.name && !displayName) setDisplayName(story.hero.name);
  }, [selectedStoryId, stories, titleText, displayName]);

  useEffect(() => {
    if (!selectedHeroId) return;
    const hero = heroes.find((h) => h.id === selectedHeroId);
    if (hero?.universeId) setSelectedUniverseId(hero.universeId);
    if (hero?.name && !displayName) setDisplayName(hero.name);
  }, [selectedHeroId, heroes, displayName]);

  useEffect(() => {
    if (!selectedCharacterId) return;
    const character = characters.find((c) => c.id === selectedCharacterId);
    if (character?.universeId) setSelectedUniverseId(character.universeId);
    if (character?.name && !displayName) setDisplayName(character.name);
  }, [selectedCharacterId, characters, displayName]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  async function goToPreview() {
    if (!selectedProduct) return;
    if (isStorybookProduct && !selectedStoryId) {
      setError("Please select a story for the storybook.");
      return;
    }
    if (isApparelProduct && !selectedHeroId && !selectedCharacterId) {
      setError("Please select a hero or character for the apparel.");
      return;
    }
    if (!isStorybookProduct && !isApparelProduct && !selectedHeroId && !selectedCharacterId && !selectedStoryId) {
      setError("Please choose at least a character or a story.");
      return;
    }
    try {
      setError("");
      setPreviewLoading(true);
      const created = await createMerchandiseDesign({
        productId:       selectedProduct.slug,
        universeId:      selectedUniverseId || undefined,
        storyId:         selectedStoryId    || undefined,
        heroId:          selectedHeroId     || undefined,
        characterId:     selectedCharacterId || undefined,
        displayName:     displayName        || undefined,
        titleText:       titleText          || undefined,
        subtitle:        subtitle           || undefined,
        message:         message            || undefined,
        themeColor:      themeColor         || undefined,
        quantity,
        selectedVariants: Object.keys(selectedVariants).length ? selectedVariants : undefined,
      });
      const preview = await generateMerchandisePreview(created.id);
      setDesign(preview);
      setPreviewingUrl(preview.previewUrl ?? null);
      setStep("preview");
      setShowPreviewModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the preview");
    } finally {
      setPreviewLoading(false);
    }
  }

  function addToCartAndReset() {
    if (!selectedProduct || !design) return;
    const variantLabel = buildVariantLabelFromDefs(liveDefs, selectedVariants);
    setCartItems((items) => {
      if (items.some((item) => item.design.id === design.id)) return items;
      return [...items, {
        id: design.id,
        design,
        product: selectedProduct,
        quantity,
        heroName:     selectedCharacter?.name ?? selectedHero?.name ?? (displayName || "Hero"),
        storyTitle:   selectedStory?.title ?? (titleText || ""),
        selectedVariants: { ...selectedVariants },
        variantLabel,
        effectiveUnitPrice,
      }];
    });
    setSelectedProductId("");
    setSelectedHeroId("");
    setSelectedCharacterId("");
    setSelectedStoryId("");
    setTitleText("");
    setSubtitle("");
    setMessage("");
    setQuantity(1);
    setDesign(null);
    setSelectedVariants({});
    setStep("product");
  }

  function removeCartItem(id: string) {
    setCartItems((items) => items.filter((item) => item.id !== id));
  }

  function updateCartItemQty(id: string, delta: number) {
    setCartItems((items) => items.map((item) => {
      if (item.id !== id) return item;
      const min = minQtyForProduct(item.product.id);
      return { ...item, quantity: Math.max(min, item.quantity + delta) };
    }));
  }

  async function applyCoupon() {
    if (!couponInput.trim()) return;
    setCouponLoading(true);
    setCouponError("");
    try {
      const token = getAccessToken();
      const res = await fetch(
        `${(process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api")}/influencers/coupon/validate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ code: couponInput.trim().toUpperCase() }),
        }
      );
      const j = await res.json() as { data?: { valid: boolean; errorMessage?: string; code?: string; discountType?: string; discountValue?: number } };
      const result = j.data ?? (j as { valid: boolean; errorMessage?: string; code?: string; discountType?: string; discountValue?: number });
      if (!result.valid) {
        setCouponError(result.errorMessage ?? "Invalid coupon code");
        setAppliedCoupon(null);
      } else {
        setAppliedCoupon({
          code: result.code!,
          discountType: result.discountType as "percentage" | "fixed_amount",
          discountValue: result.discountValue!,
        });
        setCouponError("");
      }
    } catch {
      setCouponError("Failed to validate coupon");
    } finally {
      setCouponLoading(false);
    }
  }

  function removeCoupon() {
    setAppliedCoupon(null);
    setCouponInput("");
    setCouponError("");
  }

  async function handlePlaceOrder() {
    if (cartItems.length === 0) return;
    try {
      setCheckoutLoading(true);
      setError("");
      const created = await createOrderV2({
        items: cartItems.map((item) => ({
          productSlug:        item.product.slug,
          quantity:           item.quantity,
          designId:           item.design.id,
          heroId:             item.design.heroId ?? undefined,
          storyId:            item.design.storyId ?? undefined,
          universeId:         item.design.universeId ?? undefined,
          selectedAttributes: Object.keys(item.selectedVariants).length ? item.selectedVariants : undefined,
        })),
        paymentMethod,
        couponCode: appliedCoupon?.code ?? undefined,
        customerName:         customerName  || undefined,
        customerEmail:        customerEmail || undefined,
        customerPhone:        customerPhone || undefined,
        shippingName:         cartHasPhysical ? (shippingName    || undefined) : undefined,
        shippingPhone:        cartHasPhysical ? (customerPhone   || undefined) : undefined,
        shippingAddressLine1: cartHasPhysical ? (shippingAddress || undefined) : undefined,
        shippingAddressLine2: cartHasPhysical ? (shippingAddressLine2 || undefined) : undefined,
        shippingCity:         cartHasPhysical ? (shippingCity    || undefined) : undefined,
        shippingState:        cartHasPhysical ? (shippingState   || undefined) : undefined,
        shippingPincode:      cartHasPhysical ? (shippingPincode || undefined) : undefined,
        shippingCountry:      cartHasPhysical ? (shippingCountry || "India")   : undefined,
      });
      // Save address if user checked the checkbox and it's a new address
      if (saveAddressChecked && cartHasPhysical && shippingName && shippingAddress && shippingCity) {
        addressesApi.create({
          label: null,
          fullName: shippingName,
          phone: customerPhone,
          addressLine1: shippingAddress,
          addressLine2: shippingAddressLine2 || null,
          city: shippingCity,
          state: shippingState,
          pincode: shippingPincode,
          country: shippingCountry || "India",
          isDefault: savedAddresses.length === 0,
        }).catch(() => {}); // non-blocking
      }
      router.push(`/dashboard/orders/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order");
    } finally {
      setCheckoutLoading(false);
    }
  }

  // ─── Loading / disabled states ────────────────────────────────────────────

  if (authLoading || flagsLoading) {
    return (
      <div className="min-h-screen bg-space-gradient flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (!merchEnabled) {
    return (
      <div className="min-h-screen bg-cream flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-4xl mx-auto px-6 py-24 w-full">
          <div className="rounded-3xl border border-ink/10 bg-white p-8 shadow-card">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-ink-muted mb-3">Merchandise</p>
            <h1 className="font-[family-name:var(--font-display)] text-ink text-3xl mb-3">Merchandise is currently hidden</h1>
            <p className="text-ink-muted text-sm">The merchandise flow is controlled from platform settings.</p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />
      <header className="bg-page-header pt-28 md:pt-32 pb-14 px-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-gold/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative max-w-5xl mx-auto">
          <Breadcrumb crumbs={[{ label: "Create Merchandise" }]} variant="dark" className="mb-4" />
          <h1 className="font-[family-name:var(--font-display)] text-white text-4xl md:text-5xl">Create Merchandise</h1>
          <p className="text-white/50 text-sm mt-2">Choose product, pick assets, and personalize your design.</p>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-5 py-8 w-full">
        {error && (
          <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 items-start">

          {/* ── LEFT: Steps ── */}
          <div className="space-y-2">

            {/* ── Step 1: Choose Product ── */}
            {(() => {
              const isOpen = step === "product";
              const isDone = !!selectedProductId;
              return (
                <div className={cn("rounded-2xl border overflow-hidden transition-colors", isOpen ? "border-brand/25 bg-white shadow-sm" : isDone ? "border-ink/10 bg-white" : "border-transparent bg-black/[0.02]")}>
                  <button type="button" onClick={() => setStep("product")} className="w-full flex items-center gap-3 px-5 py-4 text-left">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0", isOpen ? "bg-brand text-white" : isDone ? "bg-emerald-500 text-white" : "bg-ink/8 text-ink-muted")}>
                      {isDone && !isOpen ? <Check className="w-3.5 h-3.5" /> : "1"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-bold text-ink">Choose Product</span>
                      {isDone && !isOpen && selectedProduct && <span className="ml-2 text-xs text-ink-muted">· {selectedProduct.name}</span>}
                    </div>
                    <ChevronDown className={cn("w-4 h-4 text-ink/30 shrink-0 transition-transform", isOpen && "rotate-180")} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pt-1 pb-5 border-t border-ink/5">
                      {loading ? (
                        <div className="py-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-brand" /></div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                          {effectiveProducts.map((product) => (
                            <ProductCard
                              key={product.id}
                              product={product}
                              selected={selectedProductId === product.id}
                              onSelect={() => {
                                setSelectedProductId(product.id);
                                setSelectedStoryId("");
                                setSelectedHeroId("");
                                setSelectedCharacterId("");
                                setSelectedVariants({});
                                setDesign(null);
                                setQuantity(minQtyForProduct(product.slug));
                                setStep("asset");
                              }}
                            />
                          ))}
                        </div>
                      )}
                      <div className="flex justify-end mt-4">
                        <button type="button" disabled={!selectedProductId} onClick={() => setStep("asset")} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-40">
                          Continue <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Step 2: Pick Asset ── */}
            {(() => {
              const isOpen  = step === "asset";
              const isDone  = canContinueFromAssets;
              const isLocked = !selectedProductId;
              const charName = selectedHeroId ? (selectedHero?.name ?? null) : (selectedCharacter?.name ?? null);
              const summary  = isStorybookProduct
                ? (selectedStory?.title ?? undefined)
                : ([charName, selectedStory?.title].filter(Boolean).join(" · ") || undefined);
              return (
                <div className={cn("rounded-2xl border overflow-hidden transition-colors", isOpen ? "border-brand/25 bg-white shadow-sm" : isDone ? "border-ink/10 bg-white" : isLocked ? "border-transparent bg-black/[0.02]" : "border-ink/10 bg-white")}>
                  <button type="button" onClick={() => !isLocked && setStep("asset")} disabled={isLocked} className="w-full flex items-center gap-3 px-5 py-4 text-left disabled:cursor-not-allowed">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0", isOpen ? "bg-brand text-white" : isDone ? "bg-emerald-500 text-white" : isLocked ? "bg-ink/8 text-ink/30" : "bg-ink/8 text-ink-muted")}>
                      {isDone && !isOpen ? <Check className="w-3.5 h-3.5" /> : "2"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-bold", isLocked ? "text-ink/30" : "text-ink")}>
                        {isStorybookProduct ? "Pick Story" : "Pick Character or Story"}
                      </span>
                      {isDone && !isOpen && summary && <span className="ml-2 text-xs text-ink-muted truncate">· {summary}</span>}
                    </div>
                    {!isLocked && <ChevronDown className={cn("w-4 h-4 text-ink/30 shrink-0 transition-transform", isOpen && "rotate-180")} />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pt-4 pb-5 border-t border-ink/5">
                      {isStorybookProduct ? (
                        /* Storybook: story-only picker */
                        <>
                          <p className="text-xs text-ink-muted mb-3">Only completed stories with a cover image are shown.</p>
                          {completedStories.length === 0 ? (
                            <div className="rounded-2xl border-2 border-dashed border-ink/10 py-8 text-center">
                              <BookOpen className="w-8 h-8 mx-auto text-ink-muted mb-2" />
                              <p className="text-sm font-semibold text-ink/40">No completed stories found</p>
                              <p className="text-xs text-ink-muted mt-1">A story needs a title and cover image to be printed.</p>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {completedStories.map((story) => (
                                <button
                                  key={story.id}
                                  type="button"
                                  onClick={() => { setSelectedStoryId(story.id); if (story.universeId) setSelectedUniverseId(story.universeId); setDesign(null); }}
                                  className={cn("rounded-xl border p-3 text-left transition bg-white", selectedStoryId === story.id ? "border-brand ring-2 ring-brand/20" : "border-ink/10 hover:border-brand/30")}
                                >
                                  <div className="flex items-center gap-2">
                                    <div className="w-12 h-14 rounded-lg overflow-hidden bg-ink/5 flex items-center justify-center shrink-0">
                                      <img src={story.coverImageUrl!} alt={story.title ?? "Story"} className="w-full h-full object-cover" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-ink line-clamp-2">{story.title}</p>
                                      <p className="text-[11px] text-ink-muted line-clamp-1 mt-0.5">{story.hero?.name ?? "Story"}</p>
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </>
                      ) : (
                        /* Default: character + story picker */
                        <>
                          <div className="mb-4">
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">Universe</label>
                            <select
                              value={selectedUniverseId}
                              onChange={(e) => { setSelectedUniverseId(e.target.value); setDesign(null); }}
                              className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-3 text-sm text-ink focus:outline-none focus:border-brand"
                            >
                              <option value="">All universes</option>
                              {universes.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                            </select>
                          </div>

                          <div className="mb-4">
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">Character</label>
                            {allCharacters.length === 0 ? (
                              <p className="text-xs text-ink-muted py-2">No characters found.</p>
                            ) : (
                              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {allCharacters.map((char) => {
                                  const isSelected = char.type === "hero" ? selectedHeroId === char.id : selectedCharacterId === char.id;
                                  return (
                                    <button
                                      key={`${char.type}-${char.id}`}
                                      type="button"
                                      onClick={() => {
                                        if (char.type === "hero") { setSelectedHeroId(char.id); setSelectedCharacterId(""); }
                                        else { setSelectedCharacterId(char.id); setSelectedHeroId(""); }
                                        if (char.universeId) setSelectedUniverseId(char.universeId);
                                        setDesign(null);
                                      }}
                                      className={cn("rounded-xl border p-3 text-left transition bg-white", isSelected ? "border-brand ring-2 ring-brand/20" : "border-ink/10 hover:border-brand/30")}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-full overflow-hidden bg-brand/10 flex items-center justify-center shrink-0">
                                          {char.avatarUrl ? <img src={char.avatarUrl} alt={char.name} className="w-full h-full object-cover" /> : <UserRound className="w-4 h-4 text-brand" />}
                                        </div>
                                        <div className="min-w-0">
                                          <p className="text-xs font-semibold text-ink line-clamp-1">{char.name}</p>
                                          <p className="text-[10px] text-ink-muted capitalize line-clamp-1">{char.role}</p>
                                        </div>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>

                          <div className="mb-5">
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">Story</label>
                            {filteredStories.length === 0 ? (
                              <p className="text-xs text-ink-muted py-2">No stories found.</p>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {filteredStories.map((story) => (
                                  <button
                                    key={story.id}
                                    type="button"
                                    onClick={() => { setSelectedStoryId(story.id); if (story.universeId) setSelectedUniverseId(story.universeId); setDesign(null); }}
                                    className={cn("rounded-xl border p-3 text-left transition bg-white", selectedStoryId === story.id ? "border-brand ring-2 ring-brand/20" : "border-ink/10 hover:border-brand/30")}
                                  >
                                    <div className="flex items-center gap-2">
                                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-ink/5 flex items-center justify-center shrink-0">
                                        {story.coverImageUrl ? <img src={story.coverImageUrl} alt={story.title ?? "Story"} className="w-full h-full object-cover" /> : <FileText className="w-4 h-4 text-ink-muted" />}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-semibold text-ink line-clamp-1">{story.title ?? "Untitled"}</p>
                                        <p className="text-[11px] text-ink-muted line-clamp-1">{story.hero?.name ?? "Story"}</p>
                                      </div>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      <div className="flex justify-end">
                        <button type="button" disabled={!canContinueFromAssets} onClick={() => setStep("customize")} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-40">
                          Continue <ArrowRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Step 3: Customize / Variants ── */}
            {(() => {
              const isOpen  = step === "customize";
              const isDone  = step3Done;
              const isLocked = !canContinueFromAssets;
              const summary = requiresVariants
                ? buildVariantLabelFromDefs(liveDefs, selectedVariants) || undefined
                : (titleText || displayName || undefined);
              return (
                <div className={cn("rounded-2xl border overflow-hidden transition-colors", isOpen ? "border-brand/25 bg-white shadow-sm" : isDone ? "border-ink/10 bg-white" : isLocked ? "border-transparent bg-black/[0.02]" : "border-ink/10 bg-white")}>
                  <button type="button" onClick={() => !isLocked && setStep("customize")} disabled={isLocked} className="w-full flex items-center gap-3 px-5 py-4 text-left disabled:cursor-not-allowed">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0", isOpen ? "bg-brand text-white" : isDone ? "bg-emerald-500 text-white" : isLocked ? "bg-ink/8 text-ink/30" : "bg-ink/8 text-ink-muted")}>
                      {isDone && !isOpen ? <Check className="w-3.5 h-3.5" /> : "3"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-bold", isLocked ? "text-ink/30" : "text-ink")}>{step3Label}</span>
                      {isDone && !isOpen && summary && <span className="ml-2 text-xs text-ink-muted truncate">· {summary}</span>}
                    </div>
                    {!isLocked && <ChevronDown className={cn("w-4 h-4 text-ink/30 shrink-0 transition-transform", isOpen && "rotate-180")} />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pt-4 pb-5 border-t border-ink/5">

                      {/* ── Storybook: all attrs rendered generically ── */}
                      {isStorybookProduct && liveDefs.length > 0 && (
                        <div className="space-y-5">
                          {liveDefs.filter((def) => def.options.length > 0).map((def) => {
                            const basePrice = Number(selectedProduct?.salePrice ?? selectedProduct?.basePrice ?? 0);
                            return (
                              <div key={def.key}>
                                <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">
                                  {def.label}
                                  {def.isRequired !== false && <span className="text-red-400 ml-1">*</span>}
                                </label>
                                <div className="space-y-2">
                                  {def.options.map((opt) => {
                                    const finalPrice = basePrice + opt.priceModifier;
                                    const isSelected = selectedVariants[def.key] === opt.value;
                                    return (
                                      <button
                                        key={opt.value}
                                        type="button"
                                        onClick={() => { setSelectedVariants((v) => ({ ...v, [def.key]: opt.value })); setDesign(null); }}
                                        className={cn(
                                          "w-full rounded-2xl border p-4 text-left transition",
                                          isSelected ? "border-brand ring-2 ring-brand/20 bg-brand/5" : "border-ink/10 hover:border-brand/30 bg-white",
                                        )}
                                      >
                                        <div className="flex items-center justify-between gap-3">
                                          <div>
                                            <p className="font-bold text-ink text-sm">{opt.label}</p>
                                            {opt.description && <p className="text-[11px] text-ink-muted mt-0.5">{opt.description}</p>}
                                          </div>
                                          {finalPrice > 0 && (
                                            <div className="text-right shrink-0">
                                              <p className="font-black text-ink text-lg">₹{finalPrice.toLocaleString()}</p>
                                              {opt.priceModifier > 0 && <p className="text-[10px] text-ink-muted">+₹{opt.priceModifier.toLocaleString()}</p>}
                                            </div>
                                          )}
                                          {isSelected && (
                                            <div className="w-5 h-5 rounded-full bg-brand flex items-center justify-center shrink-0">
                                              <Check className="w-3 h-3 text-white" />
                                            </div>
                                          )}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })}
                          <div>
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Quantity</label>
                            <input type="number" min={1} value={quantity} onChange={(e) => { setQuantity(Math.max(1, Number(e.target.value) || 1)); setDesign(null); }} className="w-24 rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                          <div className="flex justify-end mt-2">
                            <button type="button" disabled={!canContinueFromVariants} onClick={() => setStep("preview")} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-40">
                              Continue to Preview <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Apparel: Size / Color / Placement ── */}
                      {isApparelProduct && (() => {
                        const sizeDef      = liveDefs.find((d) => d.key === "size");
                        const colorDef     = liveDefs.find((d) => d.key === "color");
                        const placementDef = liveDefs.find((d) => d.key === "placement");
                        if (!sizeDef || !colorDef || !placementDef) return null;
                        const kidsOpts  = sizeDef.options.filter((o) => o.value.endsWith("Y") || o.value.match(/^\d/));
                        const adultOpts = sizeDef.options.filter((o) => !o.value.endsWith("Y") && !o.value.match(/^\d/));
                        const sizeChart = productDetail?.sizeChart ?? [];
                        const selectedSizeRow = sizeChart.find((r) => r.sizeLabel === selectedVariants.size);
                        return (
                          <div className="space-y-6">

                            {/* Size */}
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted">Size</label>
                                <button type="button" onClick={() => setShowSizeChart(true)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline">
                                  <Ruler className="w-3 h-3" /> Size Chart
                                </button>
                              </div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">Kids</p>
                              <div className="flex flex-wrap gap-1.5 mb-2">
                                {kidsOpts.map((opt) => (
                                  <button key={opt.value} type="button"
                                    onClick={() => { setSelectedVariants((v) => ({ ...v, size: opt.value })); setDesign(null); }}
                                    className={cn("px-3 py-1.5 rounded-full border text-xs font-bold transition",
                                      selectedVariants.size === opt.value ? "border-brand bg-brand text-white" : "border-ink/15 bg-white text-ink hover:border-brand/40")}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted mb-1">Adult</p>
                              <div className="flex flex-wrap gap-1.5">
                                {adultOpts.map((opt) => (
                                  <button key={opt.value} type="button"
                                    onClick={() => { setSelectedVariants((v) => ({ ...v, size: opt.value })); setDesign(null); }}
                                    className={cn("px-3 py-1.5 rounded-full border text-xs font-bold transition",
                                      selectedVariants.size === opt.value ? "border-brand bg-brand text-white" : "border-ink/15 bg-white text-ink hover:border-brand/40")}>
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                              {selectedSizeRow && (
                                <div className="mt-2 flex gap-3 text-[10px]">
                                  <span className="text-ink-muted">Chest <strong className="text-ink">{selectedSizeRow.chestInches}&quot;</strong></span>
                                  <span className="text-ink-muted">Length <strong className="text-ink">{selectedSizeRow.lengthInches}&quot;</strong></span>
                                  <span className="text-ink-muted">Shoulder <strong className="text-ink">{selectedSizeRow.shoulderInches}&quot;</strong></span>
                                </div>
                              )}
                            </div>

                            {/* Color */}
                            <div>
                              <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">Color</label>
                              <div className="flex flex-wrap gap-2">
                                {colorDef.options.map((opt) => {
                                  const isSelected = selectedVariants.color === opt.value;
                                  return (
                                    <button key={opt.value} type="button"
                                      onClick={() => { setSelectedVariants((v) => ({ ...v, color: opt.value })); setDesign(null); }}
                                      className={cn("flex items-center gap-2 px-3 py-2 rounded-full border text-xs font-semibold transition",
                                        isSelected ? "border-brand ring-2 ring-brand/20" : "border-ink/15 hover:border-ink/30")}>
                                      <span
                                        className={cn("w-4 h-4 rounded-full inline-block shrink-0", opt.value === "White" && "border border-ink/15")}
                                        style={{ background: opt.hex }}
                                      />
                                      {opt.label}
                                      {isSelected && <Check className="w-3 h-3 text-brand" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Placement */}
                            <div>
                              <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">Print Placement</label>
                              <div className="grid grid-cols-3 gap-2">
                                {placementDef.options.map((opt) => {
                                  const isSelected = selectedVariants.placement === opt.value;
                                  return (
                                    <button key={opt.value} type="button"
                                      onClick={() => { setSelectedVariants((v) => ({ ...v, placement: opt.value })); setDesign(null); }}
                                      className={cn("rounded-xl border px-3 py-3 text-xs font-semibold text-center transition",
                                        isSelected ? "border-brand ring-2 ring-brand/20 bg-brand/5 text-brand" : "border-ink/15 bg-white text-ink hover:border-brand/30")}>
                                      {opt.label}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Quantity */}
                            <div>
                              <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Quantity</label>
                              <input type="number" min={1} value={quantity} onChange={(e) => { setQuantity(Math.max(1, Number(e.target.value) || 1)); setDesign(null); }} className="w-24 rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand" />
                            </div>

                            <div className="flex justify-end">
                              <button type="button" disabled={!canContinueFromVariants} onClick={() => setStep("preview")} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-40">
                                Continue to Preview <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Generic: any other product with required attrs (poster, sticker sheet, etc.) ── */}
                      {requiresVariants && !isStorybookProduct && !isApparelProduct && liveDefs.length > 0 && (
                        <div className="space-y-5">
                          {liveDefs.filter((def) => def.options.length > 0).map((def) => (
                            <div key={def.key}>
                              <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">
                                {def.label}
                                {def.isRequired !== false && <span className="text-red-400 ml-1">*</span>}
                              </label>
                              <div className="flex flex-wrap gap-2">
                                {def.options.map((opt) => {
                                  const isSelected = selectedVariants[def.key] === opt.value;
                                  return (
                                    <button key={opt.value} type="button"
                                      onClick={() => { setSelectedVariants((v) => ({ ...v, [def.key]: opt.value })); setDesign(null); }}
                                      className={cn(
                                        "px-4 py-2 rounded-full border text-xs font-semibold transition",
                                        isSelected ? "border-brand bg-brand text-white" : "border-ink/15 bg-white text-ink hover:border-brand/40",
                                      )}>
                                      {opt.label}
                                      {opt.priceModifier > 0 && <span className="ml-1 opacity-70">+₹{opt.priceModifier}</span>}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                          <div>
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Quantity</label>
                            <input type="number" min={1} value={quantity} onChange={(e) => { setQuantity(Math.max(1, Number(e.target.value) || 1)); setDesign(null); }} className="w-24 rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                          <div className="flex justify-end">
                            <button type="button" disabled={!canContinueFromVariants} onClick={() => setStep("preview")} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-40">
                              Continue to Preview <ArrowRight className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Digital: Text customization (existing behavior) ── */}
                      {!requiresVariants && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="col-span-2">
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Display Name</label>
                            <input value={displayName} onChange={(e) => { setDisplayName(e.target.value); setDesign(null); }} placeholder="Captain Siddhant" className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Title</label>
                            <input value={titleText} onChange={(e) => { setTitleText(e.target.value); setDesign(null); }} placeholder="Protector of the Moon Crystal" className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Subtitle</label>
                            <input value={subtitle} onChange={(e) => { setSubtitle(e.target.value); setDesign(null); }} placeholder="Official Hero Kids Universe Certificate" className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Message</label>
                            <textarea value={message} onChange={(e) => { setMessage(e.target.value); setDesign(null); }} rows={2} placeholder="A special surprise from the universe..." className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand resize-none" />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Theme Color</label>
                            <input value={themeColor} onChange={(e) => { setThemeColor(e.target.value); setDesign(null); }} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand" />
                          </div>
                          <div>
                            <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Quantity</label>
                            <input type="number" min={currentMinQty} value={quantity} onChange={(e) => { setQuantity(Math.max(currentMinQty, Number(e.target.value) || currentMinQty)); setDesign(null); }} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm text-ink focus:outline-none focus:border-brand" />
                            {selectedProductSlug === "sticker_sheet_pdf" && (
                              <p className="text-[10px] text-ink-muted mt-1">Min 10 stickers per A4 sheet</p>
                            )}
                          </div>
                          <div className="col-span-2 flex justify-end mt-1">
                            <button type="button" disabled={!canContinueFromAssets || previewLoading} onClick={() => void goToPreview()} className="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-40">
                              {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                              Generate Preview
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ── Step 4: Preview & Add to Cart ── */}
            {(() => {
              const isOpen   = step === "preview";
              const isLocked = requiresVariants ? !canContinueFromVariants : !design;
              const isDone   = !!design && !isOpen;
              return (
                <div className={cn("rounded-2xl border overflow-hidden transition-colors", isOpen ? "border-brand/25 bg-white shadow-sm" : isDone ? "border-ink/10 bg-white" : isLocked ? "border-transparent bg-black/[0.02]" : "border-ink/10 bg-white")}>
                  <button type="button" onClick={() => !isLocked && setStep("preview")} disabled={isLocked} className="w-full flex items-center gap-3 px-5 py-4 text-left disabled:cursor-not-allowed">
                    <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0", isOpen ? "bg-brand text-white" : isLocked ? "bg-ink/8 text-ink/30" : "bg-emerald-500 text-white")}>
                      {!isLocked && !isOpen ? <Check className="w-3.5 h-3.5" /> : "4"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className={cn("text-sm font-bold", isLocked ? "text-ink/30" : "text-ink")}>Preview & Add to Cart</span>
                      {isDone && <span className="ml-2 text-xs text-ink-muted">· Ready</span>}
                    </div>
                    {!isLocked && <ChevronDown className={cn("w-4 h-4 text-ink/30 shrink-0 transition-transform", isOpen && "rotate-180")} />}
                  </button>
                  {isOpen && (
                    <div className="px-5 pt-4 pb-5 border-t border-ink/5">
                      {/* Product-specific mockup — always shown once product + assets are chosen */}
                      <div className="mb-4 rounded-xl overflow-hidden border border-ink/10 bg-ink/[0.02]">
                        <ProductMockup
                          productSlug={selectedProductSlug}
                          avatarUrl={mockupAvatarUrl}
                          storyCoverUrl={mockupStoryCoverUrl}
                          heroName={mockupHeroName}
                          storyTitle={mockupStoryTitle}
                          customTitle={design?.titleText ?? undefined}
                          customSubtitle={design?.subtitle ?? undefined}
                          selectedVariants={selectedVariants}
                          className="w-full"
                        />
                      </div>

                      {/* Variant summary for variant products */}
                      {requiresVariants && (
                        <div className="rounded-xl border border-ink/10 bg-ink/[0.02] px-4 py-3 mb-3 text-sm">
                          <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted mb-1">Your Selection</p>
                          <p className="font-semibold text-ink">{buildVariantLabelFromDefs(liveDefs, selectedVariants) || "—"}</p>
                          {effectiveUnitPrice !== Number(selectedProduct?.salePrice ?? selectedProduct?.basePrice ?? 0) && (
                            <p className="text-xs text-brand font-bold mt-1">₹{effectiveUnitPrice.toLocaleString()} × {quantity}</p>
                          )}
                        </div>
                      )}

                      {!design ? (
                        <button type="button" disabled={previewLoading} onClick={() => void goToPreview()} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-40">
                          {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                          {previewLoading ? "Creating design…" : "Confirm & Finalize Design"}
                        </button>
                      ) : (
                        <div className="flex gap-3">
                          <button type="button" onClick={() => void goToPreview()} disabled={previewLoading} className="inline-flex items-center gap-2 rounded-full border border-ink/15 bg-white px-4 py-2.5 text-sm font-semibold text-ink hover:border-brand hover:text-brand transition disabled:opacity-50">
                            {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                            Regenerate
                          </button>
                          <button type="button" onClick={addToCartAndReset} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-dark transition">
                            <ShoppingCart className="w-4 h-4" /> Add to Cart
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          </div>

          {/* ── RIGHT: Cart sidebar ── */}
          <div className="lg:sticky lg:top-32">
            <div className="rounded-2xl border border-ink/10 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-ink/5 flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-ink" />
                <span className="font-bold text-ink text-sm flex-1">Cart</span>
                {cartItems.length > 0 && (
                  <span className="text-xs font-black text-brand bg-brand/10 px-2 py-0.5 rounded-full">{cartItems.length}</span>
                )}
              </div>

              {cartItems.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-ink/5 flex items-center justify-center mx-auto mb-3">
                    <ShoppingCart className="w-5 h-5 text-ink/25" />
                  </div>
                  <p className="text-sm font-semibold text-ink/40">Cart is empty</p>
                  <p className="text-xs text-ink-muted mt-1">Complete step 4 to add items</p>
                </div>
              ) : (
                <div className="px-4 pt-3 pb-2 space-y-2">
                  {cartItems.map((item) => {
                    const itemTotal = item.effectiveUnitPrice * item.quantity;
                    const min = minQtyForProduct(item.product.slug);
                    return (
                      <div key={item.id} className="rounded-xl border border-ink/10 bg-white p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-ink leading-tight">{item.product.name}</p>
                            <p className="text-[10px] text-ink-muted mt-0.5">
                              {item.heroName}{item.storyTitle ? ` · ${item.storyTitle}` : ""}
                            </p>
                            {item.variantLabel && (
                              <p className="text-[10px] font-semibold text-brand mt-0.5">{item.variantLabel}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {item.design.previewUrl && (
                              <button type="button" onClick={() => { setPreviewingUrl(item.design.previewUrl!); setShowPreviewModal(true); }}
                                className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1 text-[10px] font-bold text-brand hover:bg-brand/10 transition">
                                <Eye className="w-2.5 h-2.5" /> Preview
                              </button>
                            )}
                            <button type="button" onClick={() => removeCartItem(item.id)} className="w-6 h-6 rounded-full border border-ink/10 flex items-center justify-center text-ink-muted hover:text-red-500 hover:border-red-200 transition" aria-label="Remove">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1">
                            <button type="button" onClick={() => updateCartItemQty(item.id, -1)} disabled={item.quantity <= min}
                              className="w-6 h-6 rounded-full border border-ink/15 bg-cream flex items-center justify-center text-sm font-bold text-ink-muted hover:border-brand hover:text-brand transition disabled:opacity-30 disabled:cursor-not-allowed">−</button>
                            <span className="w-8 text-center text-xs font-black text-ink">{item.quantity}</span>
                            <button type="button" onClick={() => updateCartItemQty(item.id, 1)}
                              className="w-6 h-6 rounded-full border border-ink/15 bg-cream flex items-center justify-center text-sm font-bold text-ink-muted hover:border-brand hover:text-brand transition">+</button>
                          </div>
                          <span className="text-sm font-black text-ink">₹{itemTotal.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {cartItems.length > 0 && (
                <div className="px-4 pb-4 pt-2">
                  <div className="rounded-xl border border-ink/8 bg-ink/[0.02] p-3 space-y-2 text-xs mb-3">
                    {appliedCoupon && (
                      <div className="flex items-center justify-between text-emerald-600 font-semibold">
                        <span>Coupon: {appliedCoupon.code}</span>
                        <span>−₹{couponDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between font-bold text-ink">
                      <span>Total (incl. GST)</span>
                      <span className="text-base">₹{cartTotalAfterDiscount.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-ink-muted">
                      <span>of which GST @ 18%</span>
                      <span className="font-semibold">₹{cartGst.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-ink-muted">
                      <span>Base (excl. GST)</span>
                      <span className="font-semibold">₹{cartSubtotal.toLocaleString()}</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => setShowCheckout(true)} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-3 text-sm font-semibold text-white hover:bg-brand-dark transition">
                    Checkout <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>
      </main>

      {/* ── Preview modal ── */}
      {showPreviewModal && previewingUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={() => setShowPreviewModal(false)}>
          <div className="relative flex flex-col items-center w-full max-w-[min(92vw,520px)] max-h-[92vh]" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setShowPreviewModal(false)} className="absolute -top-4 -right-4 z-10 w-10 h-10 rounded-full bg-white shadow-xl flex items-center justify-center text-ink hover:text-brand transition">
              <X className="w-5 h-5" />
            </button>
            <div className="w-full overflow-hidden rounded-3xl shadow-2xl bg-black/20">
              <img src={previewingUrl} alt="Merchandise poster preview" className="block w-full max-h-[72vh] object-contain" />
            </div>
            <div className="mt-5 flex gap-3 w-full">
              <button type="button" onClick={() => setShowPreviewModal(false)} className="flex-1 inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 py-3 text-sm font-semibold text-white hover:bg-white/20 transition">
                Close
              </button>
              {previewingUrl === design?.previewUrl && design && (
                <button type="button" onClick={() => { setShowPreviewModal(false); addToCartAndReset(); }} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand py-3 text-sm font-semibold text-white hover:bg-brand-dark transition">
                  <ShoppingCart className="w-4 h-4" /> Add to Cart
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Checkout modal ── */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setShowCheckout(false)}>
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-white z-10 px-6 py-5 border-b border-ink/5 flex items-center justify-between rounded-t-3xl">
              <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl">Checkout</h2>
              <button type="button" onClick={() => setShowCheckout(false)} className="w-9 h-9 rounded-full border border-ink/10 flex items-center justify-center text-ink-muted hover:border-brand hover:text-brand transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-4 bg-cream/60 border-b border-ink/5">
              <div className="space-y-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="rounded-xl border border-ink/10 bg-white p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-ink">{item.product.name}</p>
                        <p className="text-[10px] text-ink-muted mt-0.5">{item.heroName} · Qty {item.quantity} · <span className="capitalize">{item.product.productType}</span></p>
                        {item.variantLabel && <p className="text-[10px] font-semibold text-brand mt-0.5">{item.variantLabel}</p>}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.design.previewUrl && (
                          <button type="button" onClick={() => { setPreviewingUrl(item.design.previewUrl!); setShowPreviewModal(true); }}
                            className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/5 px-2.5 py-1 text-[10px] font-bold text-brand hover:bg-brand/10 transition">
                            <Eye className="w-2.5 h-2.5" /> Preview
                          </button>
                        )}
                        <span className="text-sm font-black text-ink">₹{(item.effectiveUnitPrice * item.quantity).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Coupon input */}
              <div className="mt-3">
                {appliedCoupon ? (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs">
                    <div>
                      <span className="font-bold text-emerald-700">Coupon applied: {appliedCoupon.code}</span>
                      <span className="text-emerald-600 ml-2">
                        You save ₹{couponDiscount.toLocaleString()}
                        {appliedCoupon.discountType === "percentage" && ` (${appliedCoupon.discountValue}% off)`}
                      </span>
                    </div>
                    <button type="button" onClick={removeCoupon} className="text-emerald-500 hover:text-red-500 ml-2 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold uppercase tracking-[0.12em] text-ink-muted block mb-1.5">Have a coupon code?</label>
                    <div className="flex gap-2">
                      <input
                        value={couponInput}
                        onChange={e => { setCouponInput(e.target.value.toUpperCase()); setCouponError(""); }}
                        onKeyDown={e => { if (e.key === "Enter") void applyCoupon(); }}
                        placeholder="Enter code…"
                        className="flex-1 rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm font-mono font-bold tracking-widest placeholder:font-normal placeholder:tracking-normal focus:outline-none focus:border-brand"
                      />
                      <button
                        type="button"
                        onClick={() => void applyCoupon()}
                        disabled={couponLoading || !couponInput.trim()}
                        className="rounded-xl border border-brand bg-brand/5 px-4 py-2.5 text-sm font-semibold text-brand hover:bg-brand/10 transition disabled:opacity-40 flex items-center gap-1.5"
                      >
                        {couponLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
                      </button>
                    </div>
                    {couponError && <p className="text-xs text-red-500 mt-1">{couponError}</p>}
                  </div>
                )}
              </div>

              <div className="mt-3 rounded-xl border border-ink/8 bg-ink/[0.02] p-3 space-y-1.5 text-xs">
                {cartTotal !== cartTotalAfterDiscount && (
                  <>
                    <div className="flex items-center justify-between text-ink-muted line-through">
                      <span>Subtotal</span>
                      <span>₹{cartTotal.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between text-emerald-600 font-semibold">
                      <span>Coupon discount ({appliedCoupon?.code})</span>
                      <span>−₹{couponDiscount.toLocaleString()}</span>
                    </div>
                  </>
                )}
                <div className="flex items-center justify-between font-bold text-ink">
                  <span>Total (incl. GST)</span>
                  <span className="text-base">₹{cartTotalAfterDiscount.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-ink-muted">
                  <span>of which GST @ 18%</span>
                  <span className="font-semibold">₹{cartGst.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between text-ink-muted">
                  <span>Base (excl. GST)</span>
                  <span className="font-semibold">₹{cartSubtotal.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              {error && (
                <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Name</label>
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Email</label>
                  <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Phone</label>
                  <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                </div>
                {cartHasPhysical && (
                  <>
                    {/* Saved address picker */}
                    {savedAddresses.length > 0 && (
                      <div className="col-span-2 mb-1">
                        <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">Saved Addresses</label>
                        <div className="flex flex-col gap-2">
                          {savedAddresses.map(a => (
                            <button key={a.id} type="button"
                              onClick={() => {
                                setSelectedSavedAddressId(a.id);
                                setShippingName(a.fullName);
                                setShippingAddress(a.addressLine1);
                                setShippingAddressLine2(a.addressLine2 ?? "");
                                setShippingCity(a.city);
                                setShippingState(a.state);
                                setShippingPincode(a.pincode);
                                setShippingCountry(a.country);
                              }}
                              className={cn(
                                "text-left p-3 rounded-xl border-2 transition-all text-sm",
                                selectedSavedAddressId === a.id
                                  ? "border-brand bg-brand/5"
                                  : "border-ink/10 bg-cream hover:border-brand/30",
                              )}>
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-ink">{a.fullName}</span>
                                {a.isDefault && <span className="text-[10px] bg-brand/10 text-brand font-bold px-2 py-0.5 rounded-full">Default</span>}
                              </div>
                              <p className="text-ink-muted text-xs mt-0.5">
                                {a.addressLine1}, {a.city}, {a.state} {a.pincode}
                              </p>
                            </button>
                          ))}
                          <button type="button"
                            onClick={() => {
                              setSelectedSavedAddressId(null);
                              setShippingName(""); setShippingAddress(""); setShippingAddressLine2("");
                              setShippingCity(""); setShippingState(""); setShippingPincode(""); setShippingCountry("India");
                            }}
                            className={cn(
                              "text-left p-3 rounded-xl border-2 transition-all text-sm",
                              selectedSavedAddressId === null
                                ? "border-brand bg-brand/5"
                                : "border-ink/10 bg-cream hover:border-brand/30",
                            )}>
                            <span className="font-semibold text-ink">+ Enter a new address</span>
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="col-span-2">
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Shipping Name</label>
                      <input value={shippingName} onChange={(e) => setShippingName(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Address</label>
                      <input value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Address Line 2</label>
                      <input value={shippingAddressLine2} onChange={(e) => setShippingAddressLine2(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">City</label>
                      <input value={shippingCity} onChange={(e) => setShippingCity(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">State</label>
                      <input value={shippingState} onChange={(e) => setShippingState(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Pincode</label>
                      <input value={shippingPincode} onChange={(e) => setShippingPincode(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-1.5">Country</label>
                      <input value={shippingCountry} onChange={(e) => setShippingCountry(e.target.value)} className="w-full rounded-xl border border-ink/15 bg-cream px-4 py-2.5 text-sm" />
                    </div>
                  </>
                )}
              </div>
              {cartHasPhysical && (
                <label className="flex items-center gap-3 cursor-pointer bg-brand/5 border border-brand/20 rounded-xl px-4 py-3">
                  <input type="checkbox" checked={saveAddressChecked} onChange={e => setSaveAddressChecked(e.target.checked)}
                    className="w-4 h-4 rounded accent-brand" />
                  <span className="text-sm text-ink font-medium">Save this address for future orders</span>
                </label>
              )}
              <div>
                <label className="text-xs font-bold uppercase tracking-[0.16em] text-ink-muted block mb-2">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {PAYMENT_METHODS.map((method) => (
                    <button key={method.value} type="button" onClick={() => setPaymentMethod(method.value)}
                      className={cn("rounded-xl border p-3 text-left transition", paymentMethod === method.value ? "border-brand ring-2 ring-brand/20 bg-brand/5" : "border-ink/10 hover:border-brand/30")}
                    >
                      <div className="flex items-center justify-between gap-2 mb-0.5">
                        <p className="font-semibold text-ink text-sm">{method.label}</p>
                        {paymentMethod === method.value && <BadgeCheck className="w-4 h-4 text-brand shrink-0" />}
                      </div>
                      <p className="text-[11px] text-ink-muted leading-snug">{method.hint}</p>
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" onClick={() => void handlePlaceOrder()} disabled={checkoutLoading} className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand px-6 py-3.5 text-sm font-semibold text-white hover:bg-brand-dark transition disabled:opacity-50">
                {checkoutLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />}
                Place {cartItems.length} Order{cartItems.length !== 1 ? "s" : ""}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Size Chart Modal ── */}
      {showSizeChart && (
        <SizeChartModal
          selectedSize={selectedVariants.size ?? ""}
          sizeChart={productDetail?.sizeChart ?? []}
          onClose={() => setShowSizeChart(false)}
        />
      )}

      <Footer />
    </div>
  );
}
