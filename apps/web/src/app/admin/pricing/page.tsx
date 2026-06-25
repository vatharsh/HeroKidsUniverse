"use client";

import { Edit2, Loader2, Package, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  createPackAdmin, deletePackAdmin, fetchAllPacksAdmin, type CreditPack, updatePackAdmin,
} from "@/lib/credits";

/* ── Pack form state ─────────────────────────────────────────────────── */
type PackFormData = {
  name: string;
  slug: string;
  description: string;
  basePrice: string;
  salePrice: string;
  currency: string;
  packType: "story_credits" | "character_slots" | "avatar_refreshes";
  credits: string;
  bonusCredits: string;
  characterSlots: string;
  avatarRefreshTokens: string;
  promotionName: string;
  promotionType: string;
  promotionValue: string;
  promotionStart: string;
  promotionEnd: string;
  badge: string;
  isFeatured: boolean;
  isMostPopular: boolean;
  isBestValue: boolean;
  sortOrder: string;
  isActive: boolean;
};

const EMPTY_FORM: PackFormData = {
  name: "", slug: "", description: "",
  basePrice: "", salePrice: "", currency: "INR",
  packType: "story_credits",
  credits: "", bonusCredits: "0",
  characterSlots: "0", avatarRefreshTokens: "0",
  promotionName: "", promotionType: "", promotionValue: "",
  promotionStart: "", promotionEnd: "",
  badge: "",
  isFeatured: false, isMostPopular: false, isBestValue: false,
  sortOrder: "0", isActive: true,
};

const BADGE_PRESETS = [
  "🔥 Launch Offer", "⭐ Most Popular", "💎 Best Value",
  "🎁 Festival Offer", "✨ Limited Time", "🆕 New",
];

function packToForm(pack: CreditPack): PackFormData {
  return {
    name: pack.name,
    slug: pack.slug,
    description: pack.description ?? "",
    basePrice: String(pack.basePrice),
    salePrice: pack.salePrice != null ? String(pack.salePrice) : "",
    currency: pack.currency,
    packType: pack.packType ?? "story_credits",
    credits: String(pack.credits),
    bonusCredits: String(pack.bonusCredits),
    characterSlots: String(pack.characterSlots ?? 0),
    avatarRefreshTokens: String(pack.avatarRefreshTokens ?? 0),
    promotionName: pack.promotionName ?? "",
    promotionType: pack.promotionType ?? "",
    promotionValue: pack.promotionValue != null ? String(pack.promotionValue) : "",
    promotionStart: pack.promotionStart ? pack.promotionStart.slice(0, 16) : "",
    promotionEnd: pack.promotionEnd ? pack.promotionEnd.slice(0, 16) : "",
    badge: pack.badge ?? "",
    isFeatured: pack.isFeatured,
    isMostPopular: pack.isMostPopular,
    isBestValue: pack.isBestValue,
    sortOrder: String(pack.sortOrder),
    isActive: pack.isActive,
  };
}

function formToPayload(form: PackFormData) {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description || null,
    basePrice: Number(form.basePrice),
    salePrice: form.salePrice ? Number(form.salePrice) : null,
    currency: form.currency,
    packType: form.packType,
    credits: Number(form.credits),
    bonusCredits: Number(form.bonusCredits),
    characterSlots: Number(form.characterSlots),
    avatarRefreshTokens: Number(form.avatarRefreshTokens),
    promotionName: form.promotionName || null,
    promotionType: form.promotionType || null,
    promotionValue: form.promotionValue ? Number(form.promotionValue) : null,
    promotionStart: form.promotionStart || null,
    promotionEnd: form.promotionEnd || null,
    badge: form.badge || null,
    isFeatured: form.isFeatured,
    isMostPopular: form.isMostPopular,
    isBestValue: form.isBestValue,
    sortOrder: Number(form.sortOrder),
    isActive: form.isActive,
  };
}

/* ── Pack Preview Card ───────────────────────────────────────────────── */
function PackPreview({ form }: { form: PackFormData }) {
  const base = Number(form.basePrice) || 0;
  const sale = form.salePrice ? Number(form.salePrice) : null;
  const effectivePrice = sale ?? base;
  const savings = sale ? base - sale : 0;
  const credits = Number(form.credits) || 0;
  const bonus = Number(form.bonusCredits) || 0;
  const characterSlots = Number(form.characterSlots) || 0;
  const avatarRefreshTokens = Number(form.avatarRefreshTokens) || 0;
  const resourceLabel =
    form.packType === "character_slots"
      ? `${characterSlots} Character Slot${characterSlots !== 1 ? "s" : ""}`
      : form.packType === "avatar_refreshes"
        ? `${avatarRefreshTokens} Avatar Refresh${avatarRefreshTokens !== 1 ? "es" : ""}`
        : `${credits} Story Credit${credits !== 1 ? "s" : ""}`;

  return (
    <div className="rounded-2xl border-2 border-violet-200 bg-white p-5 text-center relative max-w-[200px]">
      {form.badge && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-violet-600 text-white text-[10px] font-black px-3 py-1 rounded-full whitespace-nowrap">
          {form.badge}
        </div>
      )}
      <p className="text-violet-600 text-xs font-bold uppercase tracking-wider mb-1">{form.name || "Pack Name"}</p>
      {form.description && <p className="text-gray-400 text-[11px] mb-2 leading-snug">{form.description}</p>}
      <div className="mb-1">
        {sale && <p className="text-gray-400 text-sm line-through">₹{base.toLocaleString()}</p>}
        <span className="text-gray-900 font-black text-3xl">₹{effectivePrice.toLocaleString()}</span>
      </div>
      {savings > 0 && (
        <p className="text-emerald-600 text-xs font-bold mb-2">Save ₹{savings.toLocaleString()}</p>
      )}
      <div className="text-sm font-semibold text-gray-700">
        {resourceLabel}
        {form.packType === "story_credits" && bonus > 0 && <span className="text-violet-600"> +{bonus} Bonus</span>}
      </div>
      {form.promotionName && (
        <p className="text-amber-600 text-[11px] font-bold mt-1">{form.promotionName}</p>
      )}
    </div>
  );
}

/* ── Pack Form Modal ─────────────────────────────────────────────────── */
function PackModal({
  editPack,
  onClose,
  onSaved,
}: {
  editPack: CreditPack | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<PackFormData>(editPack ? packToForm(editPack) : EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(key: keyof PackFormData, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const payload = formToPayload(form);
      if (editPack) {
        await updatePackAdmin(editPack.id, payload);
      } else {
        await createPackAdmin(payload);
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4" onClick={onClose}>
      <div
        className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-gray-900 font-extrabold text-lg">{editPack ? "Edit Pack" : "New Credit Pack"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 p-1"><X className="w-4 h-4" /></button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-[1fr_200px] gap-8">
          {/* Left: form */}
          <div className="space-y-5">
            {error && <p className="text-red-600 text-xs rounded-lg bg-red-50 px-3 py-2">{error}</p>}

            <div className="grid grid-cols-2 gap-3">
              <Field label="Name *">
                <input value={form.name} onChange={e => {
                  set("name", e.target.value);
                  if (!editPack) set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
                }} placeholder="Family Pack" />
              </Field>
              <Field label="Slug *">
                <input value={form.slug} onChange={e => set("slug", e.target.value)} placeholder="family-pack" />
              </Field>
            </div>

            <Field label="Description">
              <input value={form.description} onChange={e => set("description", e.target.value)} placeholder="5 stories for the whole family" />
            </Field>

            <Field label="Pack Type">
              <select value={form.packType} onChange={e => set("packType", e.target.value as PackFormData["packType"])} className={selectCls}>
                <option value="story_credits">Story Credit Pack</option>
                <option value="character_slots">Character Slot Pack</option>
                <option value="avatar_refreshes">Avatar Refresh Pack</option>
              </select>
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Base Price (₹) *">
                <input type="number" min="1" value={form.basePrice} onChange={e => set("basePrice", e.target.value)} placeholder="699" />
              </Field>
              <Field label="Sale Price (₹)">
                <input type="number" min="1" value={form.salePrice} onChange={e => set("salePrice", e.target.value)} placeholder="499" />
              </Field>
              <Field label="Currency">
                <input value={form.currency} onChange={e => set("currency", e.target.value)} placeholder="INR" />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {form.packType === "story_credits" && (
                <>
                  <Field label="Story Credits *">
                    <input type="number" min="1" value={form.credits} onChange={e => set("credits", e.target.value)} placeholder="5" />
                  </Field>
                  <Field label="Bonus Story Credits">
                    <input type="number" min="0" value={form.bonusCredits} onChange={e => set("bonusCredits", e.target.value)} placeholder="1" />
                  </Field>
                </>
              )}
              {form.packType === "character_slots" && (
                <Field label="Character Slots *">
                  <input type="number" min="1" value={form.characterSlots} onChange={e => set("characterSlots", e.target.value)} placeholder="3" />
                </Field>
              )}
              {form.packType === "avatar_refreshes" && (
                <Field label="Avatar Refreshes *">
                  <input type="number" min="1" value={form.avatarRefreshTokens} onChange={e => set("avatarRefreshTokens", e.target.value)} placeholder="5" />
                </Field>
              )}
              <Field label="Sort Order">
                <input type="number" min="0" value={form.sortOrder} onChange={e => set("sortOrder", e.target.value)} placeholder="0" />
              </Field>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Promotion (optional)</p>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Promotion Name">
                  <input value={form.promotionName} onChange={e => set("promotionName", e.target.value)} placeholder="Diwali Sale" />
                </Field>
                <Field label="Type">
                  <select value={form.promotionType} onChange={e => set("promotionType", e.target.value)} className={selectCls}>
                    <option value="">None</option>
                    <option value="flat_amount">Flat Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                </Field>
                <Field label="Value">
                  <input type="number" min="0" value={form.promotionValue} onChange={e => set("promotionValue", e.target.value)} placeholder="200" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field label="Promo Start">
                  <input type="datetime-local" value={form.promotionStart} onChange={e => set("promotionStart", e.target.value)} />
                </Field>
                <Field label="Promo End">
                  <input type="datetime-local" value={form.promotionEnd} onChange={e => set("promotionEnd", e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Display</p>
              <Field label="Badge">
                <div className="flex gap-2 flex-wrap mb-2">
                  {BADGE_PRESETS.map(b => (
                    <button
                      key={b}
                      type="button"
                      onClick={() => set("badge", form.badge === b ? "" : b)}
                      className={`text-xs px-2 py-1 rounded-full border transition ${form.badge === b ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    >
                      {b}
                    </button>
                  ))}
                </div>
                <input value={form.badge} onChange={e => set("badge", e.target.value)} placeholder="Custom badge…" />
              </Field>

              <div className="flex flex-wrap gap-4 mt-3">
                {(["isFeatured", "isMostPopular", "isBestValue", "isActive"] as const).map(key => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form[key] as boolean}
                      onChange={e => set(key, e.target.checked)}
                      className="w-4 h-4 accent-violet-600"
                    />
                    <span className="text-sm text-gray-700 capitalize">{key.replace(/^is/, "")}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right: preview */}
          <div>
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Preview</p>
            <PackPreview form={form} />
          </div>
        </div>

        <div className="px-6 pb-6">
          <button
            onClick={() => void save()}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {editPack ? "Save Changes" : "Create Pack"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputCls = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400";
const selectCls = inputCls;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-gray-500 text-xs block mb-1">{label}</label>
      <div className="[&_input]:w-full [&_input]:bg-gray-50 [&_input]:border [&_input]:border-gray-200 [&_input]:rounded-lg [&_input]:px-3 [&_input]:py-2 [&_input]:text-gray-800 [&_input]:text-sm [&_input]:placeholder:text-gray-400 [&_input]:focus:outline-none [&_input]:focus:border-violet-400 [&_select]:w-full [&_select]:bg-gray-50 [&_select]:border [&_select]:border-gray-200 [&_select]:rounded-lg [&_select]:px-3 [&_select]:py-2 [&_select]:text-gray-800 [&_select]:text-sm [&_select]:focus:outline-none [&_select]:focus:border-violet-400">
        {children}
      </div>
    </div>
  );
}

// Override input/select styling in children

/* ── Main Page ───────────────────────────────────────────────────────── */
export default function PricingAdminPage() {
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editPack, setEditPack] = useState<CreditPack | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await fetchAllPacksAdmin();
      setPacks(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load packs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function handleDelete(id: string) {
    if (!confirm("Delete this pack? This is a soft delete — it won't affect existing purchases.")) return;
    setDeleting(id);
    try {
      await deletePackAdmin(id);
      await load();
    } catch {
      alert("Failed to delete pack");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {(showModal || editPack) && (
        <PackModal
          editPack={editPack}
          onClose={() => { setShowModal(false); setEditPack(null); }}
          onSaved={() => void load()}
        />
      )}

      <div className="mb-6 flex items-center gap-3 flex-wrap">
        <Package className="w-5 h-5 text-violet-600" />
        <h1 className="text-gray-900 text-2xl font-extrabold">Pricing & Promotions</h1>
        <button
          onClick={() => void load()}
          className="ml-auto text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => { setEditPack(null); setShowModal(true); }}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          New Pack
        </button>
      </div>

      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-violet-500 animate-spin" /></div>
      ) : packs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 p-12 text-center">
          <p className="text-gray-400 text-sm mb-3">No credit packs yet.</p>
          <p className="text-gray-400 text-xs">Credit packs will be seeded automatically on first backend start, or create one above.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {packs.map(pack => {
            const isOnSale = pack.isOnSale && pack.salePrice != null;
            const packType = pack.packType ?? "story_credits";
            const resourceLine =
              packType === "character_slots"
                ? `${pack.characterSlots ?? 0} slots`
                : packType === "avatar_refreshes"
                  ? `${pack.avatarRefreshTokens ?? 0} refreshes`
                  : `${pack.credits} cr`;
            return (
              <div
                key={pack.id}
                className={`rounded-2xl border bg-white p-5 relative flex flex-col gap-3 ${
                  pack.isMostPopular ? "border-violet-300 ring-2 ring-violet-200" :
                  !pack.isActive ? "border-gray-200 opacity-60" : "border-gray-200"
                }`}
              >
                {pack.badge && (
                  <span className="absolute -top-3 left-5 bg-violet-600 text-white text-[10px] font-black px-3 py-1 rounded-full">
                    {pack.badge}
                  </span>
                )}

                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-extrabold text-gray-900 text-base">{pack.name}</p>
                    <p className="text-[11px] text-gray-400 font-mono">{pack.slug}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                      pack.isActive ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-gray-100 text-gray-400 border-gray-200"
                    }`}>
                      {pack.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {pack.description && <p className="text-gray-500 text-xs leading-relaxed">{pack.description}</p>}

                <div className="flex items-end gap-3">
                  <div>
                    {isOnSale && (
                      <p className="text-gray-400 text-xs line-through">₹{Number(pack.basePrice).toLocaleString()}</p>
                    )}
                    <p className="text-gray-900 font-black text-2xl">
                      ₹{Number(pack.effectivePrice ?? pack.basePrice).toLocaleString()}
                    </p>
                    {isOnSale && pack.savingsAmount > 0 && (
                      <p className="text-emerald-600 text-xs font-bold">Save ₹{pack.savingsAmount.toLocaleString()} ({pack.savingsPct}%)</p>
                    )}
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-violet-700 font-black text-lg">{resourceLine}</p>
                    {packType === "story_credits" && pack.bonusCredits > 0 && (
                      <p className="text-violet-500 text-xs font-bold">+{pack.bonusCredits} bonus</p>
                    )}
                    <p className="text-gray-400 text-[10px] font-semibold uppercase tracking-wide">
                      {packType === "character_slots" ? "Character Slots" : packType === "avatar_refreshes" ? "Avatar Refreshes" : "Story Credits"}
                    </p>
                  </div>
                </div>

                {pack.promotionName && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs">
                    <p className="text-amber-700 font-bold">{pack.promotionName}</p>
                    {pack.promotionStart && pack.promotionEnd && (
                      <p className="text-amber-600 text-[11px] mt-0.5">
                        {new Date(pack.promotionStart).toLocaleDateString()} → {new Date(pack.promotionEnd).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 mt-auto pt-2 border-t border-gray-100">
                  <span className="text-[10px] text-gray-400">Sort: {pack.sortOrder}</span>
                  {pack.isFeatured && <span className="text-[10px] text-violet-500 font-semibold">Featured</span>}
                  {pack.isMostPopular && <span className="text-[10px] text-violet-500 font-semibold">Popular</span>}
                  {pack.isBestValue && <span className="text-[10px] text-violet-500 font-semibold">Best Value</span>}

                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => { setEditPack(pack); setShowModal(false); }}
                      className="text-gray-400 hover:text-violet-600 transition p-1 rounded"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => void handleDelete(pack.id)}
                      disabled={deleting === pack.id}
                      className="text-gray-400 hover:text-red-500 transition p-1 rounded disabled:opacity-40"
                    >
                      {deleting === pack.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Feature Credit Costs</p>
        <p className="text-gray-500 text-sm mb-1">Feature credit costs are configured in <strong>Platform Settings</strong>.</p>
        <p className="text-gray-400 text-xs">
          Navigate to Settings and look for generation limits — story pages, credit costs per type, and free signup credits are all configurable there.
        </p>
        <a
          href="/admin/settings"
          className="inline-block mt-3 text-sm font-semibold text-violet-600 hover:text-violet-700 underline underline-offset-2"
        >
          Open Platform Settings →
        </a>
      </div>
    </div>
  );
}
