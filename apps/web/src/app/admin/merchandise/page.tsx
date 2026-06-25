"use client";

import {
  Check, ChevronRight, Loader2, Package, Pencil, Plus,
  RefreshCw, Settings, Trash2, X, ChevronDown, BookOpen, Shirt,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string; name: string; slug: string; description: string | null;
  isActive: boolean; sortOrder: number; isDeleted: boolean;
}

interface Product {
  id: string; categoryId: string; name: string; slug: string;
  description: string | null; productType: "digital" | "physical";
  basePrice: number; salePrice: number | null; previewImageUrl: string | null;
  requiredAssetType: string | null; isActive: boolean; sortOrder: number;
  isDeleted: boolean;
}

interface Attribute {
  id: string; productId: string; name: string; slug: string;
  inputType: string; isRequired: boolean; isActive: boolean; sortOrder: number;
  isDeleted: boolean;
}

interface AttrValue {
  id: string; attributeId: string; value: string; label: string;
  priceModifier: number; metadataJson: Record<string, unknown> | null;
  isActive: boolean; sortOrder: number; isDeleted: boolean;
}

interface SizeRow {
  id?: string; sizeLabel: string; ageRange: string | null;
  chestInches: number | null; lengthInches: number | null; shoulderInches: number | null;
  chestCm: number | null; lengthCm: number | null; shoulderCm: number | null;
  sortOrder: number; isActive: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders() {
  const token = getAccessToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method, headers: authHeaders(),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { message?: string | string[] };
    const msg = Array.isArray(err.message) ? err.message.join(", ") : (err.message ?? `HTTP ${res.status}`);
    throw new Error(msg);
  }
  const json = await res.json().catch(() => ({})) as { data?: T };
  return (json.data ?? json) as T;
}

function slugify(name: string) {
  return name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
}

// ─── Small UI helpers ─────────────────────────────────────────────────────────

function Badge({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function ErrMsg({ msg }: { msg: string }) {
  return msg ? <p className="text-red-600 text-xs bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{msg}</p> : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-gray-500 text-xs font-semibold block mb-1">{label}</label>
      {children}
    </div>
  );
}

const inp = "w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-800 text-sm focus:outline-none focus:border-violet-400";
const btn = "inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg transition";
const btnPrimary = `${btn} bg-violet-600 hover:bg-violet-700 text-white`;
const btnSecondary = `${btn} border border-gray-200 bg-white text-gray-700 hover:border-violet-400 hover:text-violet-700`;
const btnDanger = `${btn} border border-red-200 bg-red-50 text-red-600 hover:bg-red-100`;

// ─── Category CRUD ────────────────────────────────────────────────────────────

function CategoryForm({
  initial, onSave, onCancel,
}: {
  initial?: Partial<Category>;
  onSave: (data: Partial<Category>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  return (
    <div className="space-y-3">
      <ErrMsg msg={err} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input className={inp} value={name} onChange={e => { setName(e.target.value); if (!initial?.id) setSlug(slugify(e.target.value)); }} placeholder="Books" />
        </Field>
        <Field label="Slug">
          <input className={inp} value={slug} onChange={e => setSlug(e.target.value)} placeholder="books" />
        </Field>
        <Field label="Description">
          <input className={inp} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Optional" />
        </Field>
        <Field label="Sort Order">
          <input className={inp} type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </Field>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="cat-active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
        <label htmlFor="cat-active" className="text-sm text-gray-700">Active</label>
      </div>
      <div className="flex gap-2 pt-1">
        <button className={btnPrimary} disabled={saving} onClick={async () => {
          if (!name.trim() || !slug.trim()) { setErr("Name and slug are required"); return; }
          setSaving(true); setErr("");
          try { await onSave({ name, slug, description: desc || null, isActive, sortOrder }); }
          catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
          finally { setSaving(false); }
        }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save
        </button>
        <button className={btnSecondary} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Product CRUD ─────────────────────────────────────────────────────────────

function ProductForm({
  initial, categories, onSave, onCancel,
}: {
  initial?: Partial<Product>;
  categories: Category[];
  onSave: (data: Partial<Product>) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [desc, setDesc] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? categories[0]?.id ?? "");
  const [productType, setProductType] = useState<"digital" | "physical">(initial?.productType ?? "digital");
  const [basePrice, setBasePrice] = useState(initial?.basePrice ?? 0);
  const [salePrice, setSalePrice] = useState(initial?.salePrice ?? "");
  const [requiredAsset, setRequiredAsset] = useState(initial?.requiredAssetType ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  return (
    <div className="space-y-3">
      <ErrMsg msg={err} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input className={inp} value={name} onChange={e => { setName(e.target.value); if (!initial?.id) setSlug(slugify(e.target.value)); }} placeholder="Printed Storybook" />
        </Field>
        <Field label="Slug">
          <input className={inp} value={slug} onChange={e => setSlug(e.target.value)} placeholder="printed_storybook" />
        </Field>
        <Field label="Category">
          <select className={inp} value={categoryId} onChange={e => setCategoryId(e.target.value)}>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="Type">
          <select className={inp} value={productType} onChange={e => setProductType(e.target.value as "digital" | "physical")}>
            <option value="digital">Digital</option>
            <option value="physical">Physical</option>
          </select>
        </Field>
        <Field label="Base Price (₹)">
          <input className={inp} type="number" value={basePrice} onChange={e => setBasePrice(Number(e.target.value))} />
        </Field>
        <Field label="Sale Price (₹, optional)">
          <input className={inp} type="number" value={salePrice} onChange={e => setSalePrice(e.target.value)} placeholder="Leave blank for none" />
        </Field>
        <Field label="Required Asset Type">
          <input className={inp} value={requiredAsset} onChange={e => setRequiredAsset(e.target.value)} placeholder="hero_avatar / story_pdf" />
        </Field>
        <Field label="Sort Order">
          <input className={inp} type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </Field>
        <div className="col-span-2">
          <Field label="Description">
            <textarea className={inp} rows={2} value={desc} onChange={e => setDesc(e.target.value)} placeholder="Short product description" />
          </Field>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="prod-active" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
        <label htmlFor="prod-active" className="text-sm text-gray-700">Active</label>
      </div>
      <div className="flex gap-2 pt-1">
        <button className={btnPrimary} disabled={saving} onClick={async () => {
          if (!name.trim() || !slug.trim() || !categoryId) { setErr("Name, slug, and category are required"); return; }
          setSaving(true); setErr("");
          try {
            await onSave({
              name, slug, description: desc || null, categoryId, productType,
              basePrice, salePrice: salePrice !== "" ? Number(salePrice) : null,
              requiredAssetType: requiredAsset || null, isActive, sortOrder,
            });
          } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
          finally { setSaving(false); }
        }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save
        </button>
        <button className={btnSecondary} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Attribute Values ─────────────────────────────────────────────────────────

function AttributeValueRow({
  val, attrSlug, onSave, onDelete,
}: {
  val?: AttrValue;
  attrSlug: string;
  onSave: (data: Partial<AttrValue>) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const isNew = !val;
  const [editing, setEditing] = useState(isNew);
  const [value, setValue_] = useState(val?.value ?? "");
  const [label, setLabel] = useState(val?.label ?? "");
  const [priceModifier, setPriceMod] = useState(val?.priceModifier ?? 0);
  const [hex, setHex] = useState((val?.metadataJson?.hex as string | undefined) ?? "");
  const [sortOrder, setSortOrder] = useState(val?.sortOrder ?? 0);
  const [isActive, setIsActive] = useState(val?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const showColor = attrSlug === "color";

  if (!editing && val) {
    return (
      <div className="flex items-center gap-3 px-3 py-2 rounded-lg border border-gray-100 bg-gray-50 text-sm">
        {showColor && hex && <span className="w-4 h-4 rounded-full inline-block border border-gray-200 shrink-0" style={{ background: hex }} />}
        <span className="font-semibold text-gray-800 min-w-0">{val.label}</span>
        <span className="text-gray-400 text-xs font-mono">{val.value}</span>
        {val.priceModifier > 0 && <span className="text-emerald-700 text-xs font-bold">+₹{val.priceModifier}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <Badge active={val.isActive} />
          <button onClick={() => setEditing(true)} className="text-gray-400 hover:text-violet-600 transition"><Pencil className="w-3.5 h-3.5" /></button>
          {onDelete && <button onClick={async () => { if (confirm("Delete this value?")) await onDelete(); }} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-violet-200 bg-white p-3 space-y-2">
      <ErrMsg msg={err} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Value (key)">
          <input className={inp} value={value} onChange={e => { setValue_(e.target.value); if (!val) setLabel(e.target.value); }} placeholder="softcover" />
        </Field>
        <Field label="Label (display)">
          <input className={inp} value={label} onChange={e => setLabel(e.target.value)} placeholder="Softcover" />
        </Field>
        <Field label="Price Modifier (₹)">
          <input className={inp} type="number" value={priceModifier} onChange={e => setPriceMod(Number(e.target.value))} />
        </Field>
        <Field label="Sort Order">
          <input className={inp} type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </Field>
        {showColor && (
          <Field label="Hex Color">
            <div className="flex gap-2 items-center">
              <input className={`${inp} flex-1`} value={hex} onChange={e => setHex(e.target.value)} placeholder="#7C3AED" />
              {hex && <span className="w-8 h-8 rounded border border-gray-200 shrink-0" style={{ background: hex }} />}
            </div>
          </Field>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
        <span className="text-sm text-gray-700">Active</span>
      </div>
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={saving} onClick={async () => {
          if (!value.trim()) { setErr("Value is required"); return; }
          setSaving(true); setErr("");
          try {
            await onSave({
              value, label: label || value, priceModifier, sortOrder, isActive,
              metadataJson: showColor && hex ? { hex } : null,
            });
            if (isNew) { setValue_(""); setLabel(""); setPriceMod(0); setHex(""); }
            else setEditing(false);
          } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
          finally { setSaving(false); }
        }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {isNew ? "Add" : "Save"}
        </button>
        {!isNew && <button className={btnSecondary} onClick={() => setEditing(false)}>Cancel</button>}
      </div>
    </div>
  );
}

// ─── Attributes section ───────────────────────────────────────────────────────

function AttributesPanel({ productId }: { productId: string }) {
  const [attrs, setAttrs] = useState<Attribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [valuesMap, setValuesMap] = useState<Record<string, AttrValue[]>>({});
  const [addingAttr, setAddingAttr] = useState(false);
  const [editingAttr, setEditingAttr] = useState<string | null>(null);

  const loadAttrs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Attribute[]>("GET", `/admin/catalog/products/${productId}/attributes`);
      setAttrs(data.filter(a => !a.isDeleted));
    } finally { setLoading(false); }
  }, [productId]);

  const loadValues = useCallback(async (attrId: string) => {
    const data = await api<AttrValue[]>("GET", `/admin/catalog/attributes/${attrId}/values`);
    setValuesMap(m => ({ ...m, [attrId]: data.filter(v => !v.isDeleted) }));
  }, []);

  useEffect(() => { void loadAttrs(); }, [loadAttrs]);

  async function toggleExpand(attrId: string) {
    if (expanded === attrId) { setExpanded(null); return; }
    setExpanded(attrId);
    if (!valuesMap[attrId]) await loadValues(attrId);
  }

  async function saveAttr(data: Partial<Attribute>, attrId?: string) {
    if (attrId) {
      await api("PATCH", `/admin/catalog/attributes/${attrId}`, data);
    } else {
      await api("POST", `/admin/catalog/products/${productId}/attributes`, data);
    }
    await loadAttrs();
    setAddingAttr(false);
    setEditingAttr(null);
  }

  async function deleteAttr(attrId: string) {
    if (!confirm("Soft-delete this attribute?")) return;
    await api("DELETE", `/admin/catalog/attributes/${attrId}`);
    await loadAttrs();
    if (expanded === attrId) setExpanded(null);
  }

  async function saveValue(attrId: string, data: Partial<AttrValue>, valueId?: string) {
    if (valueId) {
      await api("PATCH", `/admin/catalog/attribute-values/${valueId}`, data);
    } else {
      await api("POST", `/admin/catalog/attributes/${attrId}/values`, data);
    }
    await loadValues(attrId);
  }

  async function deleteValue(attrId: string, valueId: string) {
    await api("DELETE", `/admin/catalog/attribute-values/${valueId}`);
    await loadValues(attrId);
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-600" /></div>;

  return (
    <div className="space-y-3">
      {attrs.map(attr => {
        const isExpanded = expanded === attr.id;
        const isEditing = editingAttr === attr.id;
        const values = valuesMap[attr.id] ?? [];

        return (
          <div key={attr.id} className="rounded-xl border border-gray-200 overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 cursor-pointer" onClick={() => { if (!isEditing) void toggleExpand(attr.id); }}>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
              <div className="flex-1 min-w-0">
                <span className="font-semibold text-gray-800 text-sm">{attr.name}</span>
                <span className="text-gray-400 text-xs font-mono ml-2">{attr.slug}</span>
                {attr.isRequired && <span className="ml-2 text-[10px] font-bold text-red-500 uppercase">Required</span>}
              </div>
              <Badge active={attr.isActive} />
              <button onClick={e => { e.stopPropagation(); setEditingAttr(attr.id); setExpanded(attr.id); }} className="text-gray-400 hover:text-violet-600 transition"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={e => { e.stopPropagation(); void deleteAttr(attr.id); }} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>

            {isEditing && (
              <div className="px-4 py-3 border-t border-gray-100">
                <AttrForm initial={attr} onSave={data => saveAttr(data, attr.id)} onCancel={() => setEditingAttr(null)} />
              </div>
            )}

            {isExpanded && !isEditing && (
              <div className="px-4 py-3 border-t border-gray-100 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">{values.length} Values</p>
                {values.map(v => (
                  <AttributeValueRow
                    key={v.id}
                    val={v}
                    attrSlug={attr.slug}
                    onSave={data => saveValue(attr.id, data, v.id)}
                    onDelete={() => deleteValue(attr.id, v.id)}
                  />
                ))}
                <AttributeValueRow attrSlug={attr.slug} onSave={data => saveValue(attr.id, data)} />
              </div>
            )}
          </div>
        );
      })}

      {addingAttr ? (
        <div className="rounded-xl border border-violet-200 p-4">
          <p className="text-xs font-bold text-violet-700 mb-3">New Attribute</p>
          <AttrForm onSave={data => saveAttr(data)} onCancel={() => setAddingAttr(false)} />
        </div>
      ) : (
        <button className={btnSecondary} onClick={() => setAddingAttr(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Attribute
        </button>
      )}
    </div>
  );
}

function AttrForm({
  initial, onSave, onCancel,
}: { initial?: Partial<Attribute>; onSave: (data: Partial<Attribute>) => Promise<void>; onCancel: () => void }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [inputType, setInputType] = useState(initial?.inputType ?? "select");
  const [isRequired, setIsRequired] = useState(initial?.isRequired ?? true);
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [sortOrder, setSortOrder] = useState(initial?.sortOrder ?? 0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  return (
    <div className="space-y-2">
      <ErrMsg msg={err} />
      <div className="grid grid-cols-2 gap-2">
        <Field label="Name">
          <input className={inp} value={name} onChange={e => { setName(e.target.value); if (!initial?.id) setSlug(slugify(e.target.value)); }} placeholder="Size" />
        </Field>
        <Field label="Slug">
          <input className={inp} value={slug} onChange={e => setSlug(e.target.value)} placeholder="size" />
        </Field>
        <Field label="Input Type">
          <select className={inp} value={inputType} onChange={e => setInputType(e.target.value)}>
            {["select", "radio", "color", "swatch"].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Sort Order">
          <input className={inp} type="number" value={sortOrder} onChange={e => setSortOrder(Number(e.target.value))} />
        </Field>
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={isRequired} onChange={e => setIsRequired(e.target.checked)} className="rounded" />
          Required
        </label>
        <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="rounded" />
          Active
        </label>
      </div>
      <div className="flex gap-2">
        <button className={btnPrimary} disabled={saving} onClick={async () => {
          if (!name.trim() || !slug.trim()) { setErr("Name and slug required"); return; }
          setSaving(true); setErr("");
          try { await onSave({ name, slug, inputType, isRequired, isActive, sortOrder }); }
          catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
          finally { setSaving(false); }
        }}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {initial?.id ? "Save" : "Add"}
        </button>
        <button className={btnSecondary} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ─── Size Chart Panel ─────────────────────────────────────────────────────────

function SizeChartPanel({ productId }: { productId: string }) {
  const [rows, setRows] = useState<SizeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [success, setSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<SizeRow[]>("GET", `/admin/catalog/products/${productId}/size-chart`);
      setRows(data);
    } finally { setLoading(false); }
  }, [productId]);

  useEffect(() => { void load(); }, [load]);

  function updateRow(i: number, field: keyof SizeRow, val: string | number | boolean | null) {
    setRows(r => r.map((row, idx) => idx === i ? { ...row, [field]: val } : row));
  }

  function addRow() {
    setRows(r => [...r, {
      sizeLabel: "", ageRange: null, chestInches: null, lengthInches: null,
      shoulderInches: null, chestCm: null, lengthCm: null, shoulderCm: null,
      sortOrder: r.length, isActive: true,
    }]);
  }

  async function save() {
    setSaving(true); setErr(""); setSuccess(false);
    try {
      await api("POST", `/admin/catalog/products/${productId}/size-chart`, rows);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-violet-600" /></div>;

  return (
    <div>
      <ErrMsg msg={err} />
      {success && <p className="text-emerald-700 text-xs bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 mb-3">Saved successfully</p>}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              {["Size", "Age Range", "Chest″", "Length″", "Shoulder″", "Chest cm", "Length cm", "Shoulder cm", "Sort", "Active", ""].map(h => (
                <th key={h} className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wide text-gray-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-gray-100">
                {(["sizeLabel", "ageRange"] as const).map(f => (
                  <td key={f} className="px-1 py-1">
                    <input className="w-20 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-800 focus:outline-none focus:border-violet-400" value={row[f] ?? ""} onChange={e => updateRow(i, f, e.target.value || null)} />
                  </td>
                ))}
                {(["chestInches", "lengthInches", "shoulderInches", "chestCm", "lengthCm", "shoulderCm"] as const).map(f => (
                  <td key={f} className="px-1 py-1">
                    <input type="number" step="0.1" className="w-16 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-800 focus:outline-none focus:border-violet-400" value={row[f] ?? ""} onChange={e => updateRow(i, f, e.target.value === "" ? null : Number(e.target.value))} />
                  </td>
                ))}
                <td className="px-1 py-1">
                  <input type="number" className="w-12 bg-gray-50 border border-gray-200 rounded px-2 py-1 text-gray-800 focus:outline-none focus:border-violet-400" value={row.sortOrder} onChange={e => updateRow(i, "sortOrder", Number(e.target.value))} />
                </td>
                <td className="px-2 py-1">
                  <input type="checkbox" checked={row.isActive} onChange={e => updateRow(i, "isActive", e.target.checked)} className="rounded" />
                </td>
                <td className="px-1 py-1">
                  <button onClick={() => setRows(r => r.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button className={btnSecondary} onClick={addRow}><Plus className="w-3.5 h-3.5" /> Add Row</button>
        <button className={btnPrimary} disabled={saving} onClick={() => void save()}>
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          Save Chart
        </button>
      </div>
    </div>
  );
}

// ─── Product Drawer ───────────────────────────────────────────────────────────

function ProductDrawer({
  product, categories, onClose, onRefresh,
}: {
  product: Product | null;
  categories: Category[];
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<"details" | "attributes" | "size-chart">("details");
  const [err, setErr] = useState("");
  const isNew = !product;

  async function saveProduct(data: Partial<Product>) {
    if (product) {
      await api("PATCH", `/admin/catalog/products/${product.id}`, data);
    } else {
      await api("POST", `/admin/catalog/products`, data);
    }
    onRefresh();
    onClose();
  }

  async function deleteProduct() {
    if (!product) return;
    if (!confirm(`Soft-delete "${product.name}"?`)) return;
    try {
      await api("DELETE", `/admin/catalog/products/${product.id}`);
      onRefresh(); onClose();
    } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="w-[560px] h-full bg-white border-l border-gray-200 flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h2 className="text-gray-900 font-bold">{isNew ? "New Product" : product!.name}</h2>
            {product && <p className="text-gray-400 text-xs font-mono">{product.slug}</p>}
          </div>
          <div className="flex items-center gap-2">
            {product && <button className={btnDanger} onClick={() => void deleteProduct()}><Trash2 className="w-3.5 h-3.5" />Delete</button>}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {!isNew && (
          <div className="flex border-b border-gray-200 px-6">
            {(["details", "attributes", "size-chart"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`py-3 px-1 mr-5 text-sm font-semibold border-b-2 transition capitalize ${tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
              >
                {t === "size-chart" ? "Size Chart" : t}
              </button>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {err && <ErrMsg msg={err} />}

          {(isNew || tab === "details") && (
            <ProductForm
              initial={product ?? undefined}
              categories={categories}
              onSave={saveProduct}
              onCancel={onClose}
            />
          )}

          {!isNew && tab === "attributes" && <AttributesPanel productId={product!.id} />}

          {!isNew && tab === "size-chart" && <SizeChartPanel productId={product!.id} />}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminMerchandisePage() {
  const [tab, setTab] = useState<"categories" | "products">("products");
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("all");
  const [loadingCats, setLoadingCats] = useState(true);
  const [loadingProds, setLoadingProds] = useState(true);
  const [addingCat, setAddingCat] = useState(false);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [openProduct, setOpenProduct] = useState<Product | null | "new">(null);

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try { setCategories(await api<Category[]>("GET", "/admin/catalog/categories")); }
    finally { setLoadingCats(false); }
  }, []);

  const loadProducts = useCallback(async () => {
    setLoadingProds(true);
    try {
      const params = selectedCategoryId !== "all" ? `?categoryId=${selectedCategoryId}` : "";
      setProducts(await api<Product[]>("GET", `/admin/catalog/products${params}`));
    } finally { setLoadingProds(false); }
  }, [selectedCategoryId]);

  useEffect(() => { void loadCategories(); }, [loadCategories]);
  useEffect(() => { void loadProducts(); }, [loadProducts]);

  async function saveCategory(data: Partial<Category>, catId?: string) {
    if (catId) {
      await api("PATCH", `/admin/catalog/categories/${catId}`, data);
    } else {
      await api("POST", `/admin/catalog/categories`, data);
    }
    await loadCategories();
    setAddingCat(false);
    setEditingCat(null);
  }

  async function deleteCategory(catId: string, name: string) {
    if (!confirm(`Soft-delete category "${name}"?`)) return;
    await api("DELETE", `/admin/catalog/categories/${catId}`);
    await loadCategories();
  }

  const visibleProducts = products.filter(p => !p.isDeleted);
  const activeCats = categories.filter(c => !c.isDeleted);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Drawer */}
      {openProduct !== null && (
        <ProductDrawer
          product={openProduct === "new" ? null : openProduct}
          categories={activeCats}
          onClose={() => setOpenProduct(null)}
          onRefresh={() => void loadProducts()}
        />
      )}

      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Package className="w-5 h-5 text-violet-600" />
        <h1 className="text-gray-900 text-2xl font-extrabold">Merchandise Catalog</h1>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => { void loadCategories(); void loadProducts(); }} className="text-gray-400 hover:text-gray-700 p-1.5 rounded-lg hover:bg-gray-100 transition">
            <RefreshCw className="w-4 h-4" />
          </button>
          <Link href="/admin/settings" className={btnSecondary}>
            <Settings className="w-3.5 h-3.5" /> Feature Flags
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {(["products", "categories"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`py-3 px-1 mr-6 text-sm font-semibold border-b-2 transition capitalize ${tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Products tab ── */}
      {tab === "products" && (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex gap-2 flex-wrap flex-1">
              <button
                onClick={() => setSelectedCategoryId("all")}
                className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition ${selectedCategoryId === "all" ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
              >
                All
              </button>
              {activeCats.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCategoryId(c.id)}
                  className={`text-xs px-3 py-1.5 rounded-full font-semibold border transition ${selectedCategoryId === c.id ? "bg-violet-600 text-white border-violet-600" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                >
                  {c.name}
                </button>
              ))}
            </div>
            <button className={btnPrimary} onClick={() => setOpenProduct("new")}>
              <Plus className="w-3.5 h-3.5" /> Add Product
            </button>
          </div>

          {loadingProds ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
          ) : visibleProducts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
              <Package className="w-8 h-8 mx-auto text-gray-300 mb-3" />
              <p className="text-gray-400 text-sm">No products found. <button onClick={() => setOpenProduct("new")} className="text-violet-600 font-semibold hover:underline">Add one.</button></p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {visibleProducts.map(product => {
                const cat = categories.find(c => c.id === product.categoryId);
                const isPhysical = product.productType === "physical";
                const Icon = isPhysical ? (product.slug.includes("apparel") ? Shirt : BookOpen) : Package;
                return (
                  <button
                    key={product.id}
                    onClick={() => setOpenProduct(product)}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md hover:border-violet-300 transition text-left group"
                  >
                    <div className={`px-5 py-4 flex items-center justify-between ${isPhysical ? "bg-amber-50" : "bg-violet-50"}`}>
                      <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center shadow-sm">
                        <Icon className={`w-5 h-5 ${isPhysical ? "text-amber-600" : "text-violet-600"}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full ${isPhysical ? "bg-amber-100 text-amber-700" : "bg-violet-100 text-violet-700"}`}>
                          {isPhysical ? "Physical" : "Digital"}
                        </span>
                        <Badge active={product.isActive} />
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="text-gray-900 font-extrabold text-sm leading-tight group-hover:text-violet-700 transition">{product.name}</h3>
                      <p className="text-gray-400 text-[11px] font-mono mt-0.5">{product.slug}</p>
                      {cat && <p className="text-[11px] text-gray-500 mt-0.5">{cat.name}</p>}
                      <p className="text-gray-500 text-xs mt-1.5 line-clamp-2 leading-relaxed">{product.description}</p>
                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                        <span className="text-gray-900 font-black text-lg">₹{Number(product.basePrice).toLocaleString()}</span>
                        {product.salePrice !== null && (
                          <span className="text-emerald-700 text-xs font-bold">Sale ₹{Number(product.salePrice).toLocaleString()}</span>
                        )}
                        <span className="text-gray-400 text-xs flex items-center gap-1">
                          Edit <ChevronRight className="w-3 h-3" />
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Categories tab ── */}
      {tab === "categories" && (
        <div className="max-w-2xl">
          {loadingCats ? (
            <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className={`rounded-xl border ${cat.isDeleted ? "border-red-100 bg-red-50/50 opacity-60" : "border-gray-200 bg-white"} overflow-hidden`}>
                  {editingCat?.id === cat.id ? (
                    <div className="px-5 py-4">
                      <p className="text-xs font-bold text-violet-700 mb-3">Editing: {cat.name}</p>
                      <CategoryForm
                        initial={cat}
                        onSave={data => saveCategory(data, cat.id)}
                        onCancel={() => setEditingCat(null)}
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800 text-sm">{cat.name}</span>
                          <span className="text-gray-400 text-xs font-mono">{cat.slug}</span>
                          {cat.isDeleted && <span className="text-[10px] font-bold text-red-500 uppercase">Deleted</span>}
                        </div>
                        {cat.description && <p className="text-xs text-gray-400 mt-0.5">{cat.description}</p>}
                      </div>
                      <Badge active={cat.isActive} />
                      <span className="text-gray-300 text-xs">#{cat.sortOrder}</span>
                      {!cat.isDeleted && (
                        <>
                          <button onClick={() => setEditingCat(cat)} className="text-gray-400 hover:text-violet-600 transition"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => void deleteCategory(cat.id, cat.name)} className="text-gray-400 hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}

              {addingCat ? (
                <div className="rounded-xl border border-violet-200 p-5">
                  <p className="text-xs font-bold text-violet-700 mb-3">New Category</p>
                  <CategoryForm onSave={data => saveCategory(data)} onCancel={() => setAddingCat(false)} />
                </div>
              ) : (
                <button className={`${btnSecondary} mt-2`} onClick={() => setAddingCat(true)}>
                  <Plus className="w-3.5 h-3.5" /> Add Category
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
