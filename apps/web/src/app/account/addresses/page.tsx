"use client";

import { Check, Loader2, MapPin, Pencil, Plus, Star, Trash2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { addressesApi, type AddressPayload, type UserAddress } from "@/lib/account";
import { cn } from "@/lib/utils";

const BLANK: AddressPayload = {
  label: "", fullName: "", phone: "", addressLine1: "", addressLine2: "",
  city: "", state: "", pincode: "", country: "India", isDefault: false,
};

const INDIAN_STATES = [
  "Andhra Pradesh","Arunachal Pradesh","Assam","Bihar","Chhattisgarh","Goa","Gujarat","Haryana",
  "Himachal Pradesh","Jharkhand","Karnataka","Kerala","Madhya Pradesh","Maharashtra","Manipur",
  "Meghalaya","Mizoram","Nagaland","Odisha","Punjab","Rajasthan","Sikkim","Tamil Nadu","Telangana",
  "Tripura","Uttar Pradesh","Uttarakhand","West Bengal","Andaman and Nicobar Islands","Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu","Delhi","Jammu and Kashmir","Ladakh","Lakshadweep","Puducherry",
];

export default function AddressesPage() {
  const [addresses, setAddresses] = useState<UserAddress[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressPayload>(BLANK);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { loadAddresses(); }, []);

  async function loadAddresses() {
    setLoading(true);
    try { setAddresses(await addressesApi.list()); }
    catch { setError("Failed to load addresses"); }
    finally { setLoading(false); }
  }

  function openNew() {
    setEditingId(null);
    setForm({ ...BLANK, isDefault: addresses.length === 0 });
    setError("");
    setShowForm(true);
  }

  function openEdit(a: UserAddress) {
    setEditingId(a.id);
    setForm({
      label: a.label ?? "", fullName: a.fullName, phone: a.phone,
      addressLine1: a.addressLine1, addressLine2: a.addressLine2 ?? "",
      city: a.city, state: a.state, pincode: a.pincode,
      country: a.country, isDefault: a.isDefault,
    });
    setError("");
    setShowForm(true);
  }

  async function save() {
    const required = ["fullName","phone","addressLine1","city","state","pincode"] as const;
    for (const f of required) {
      if (!form[f]?.trim()) { setError(`${f} is required`); return; }
    }
    setSaving(true); setError("");
    try {
      if (editingId) {
        const updated = await addressesApi.update(editingId, form);
        setAddresses(prev => prev.map(a => a.id === editingId ? updated : a));
      } else {
        const created = await addressesApi.create(form);
        setAddresses(prev => form.isDefault
          ? [...prev.map(a => ({ ...a, isDefault: false })), created]
          : [...prev, created]);
      }
      setShowForm(false); setEditingId(null); setForm(BLANK);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  }

  async function setDefault(id: string) {
    try {
      await addressesApi.setDefault(id);
      setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })));
    } catch { setError("Failed to update default"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this address?")) return;
    try {
      await addressesApi.delete(id);
      setAddresses(prev => prev.filter(a => a.id !== id));
    } catch { setError("Failed to delete"); }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-7 h-7 animate-spin text-brand" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-1">Saved Addresses</h2>
          <p className="text-ink-muted text-sm">Used for merchandise orders. Select one at checkout.</p>
        </div>
        {!showForm && (
          <button type="button" onClick={openNew}
            className="flex items-center gap-2 bg-brand text-white text-sm font-bold px-5 py-2.5 rounded-full hover:bg-brand-dark transition">
            <Plus className="w-4 h-4" /> Add Address
          </button>
        )}
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">{error}</div>}

      {/* Address form */}
      {showForm && (
        <div className="bg-white rounded-3xl border border-brand/20 shadow-card p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-[family-name:var(--font-display)] text-ink text-lg">
              {editingId ? "Edit Address" : "New Address"}
            </h3>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setError(""); }}
              className="text-ink-muted hover:text-ink transition"><X className="w-5 h-5" /></button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Label (e.g. Home, Office)" value={form.label ?? ""} onChange={v => setForm(f => ({ ...f, label: v }))} placeholder="Home" />
            <Field label="Full Name *" value={form.fullName} onChange={v => setForm(f => ({ ...f, fullName: v }))} placeholder="Arjun Sharma" />
            <Field label="Phone *" value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+91 98765 43210" type="tel" />
            <Field label="Address Line 1 *" value={form.addressLine1} onChange={v => setForm(f => ({ ...f, addressLine1: v }))} placeholder="House no, Street" className="sm:col-span-2" />
            <Field label="Address Line 2" value={form.addressLine2 ?? ""} onChange={v => setForm(f => ({ ...f, addressLine2: v }))} placeholder="Area, Landmark" className="sm:col-span-2" />
            <Field label="City *" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Mumbai" />
            <div>
              <label className="text-ink-mid text-sm font-medium block mb-1.5">State *</label>
              <select value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
                className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink focus:outline-none focus:ring-2 focus:ring-brand/40 transition">
                <option value="">Select state…</option>
                {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <Field label="Pincode *" value={form.pincode} onChange={v => setForm(f => ({ ...f, pincode: v }))} placeholder="400001" maxLength={6} />
            <Field label="Country" value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} placeholder="India" />
          </div>

          <label className="flex items-center gap-3 mt-4 cursor-pointer">
            <input type="checkbox" checked={!!form.isDefault} onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
              className="w-4 h-4 rounded accent-brand" />
            <span className="text-sm text-ink-mid font-medium">Set as default address</span>
          </label>

          <div className="flex gap-3 mt-5">
            <button type="button" onClick={save} disabled={saving}
              className="flex-1 bg-brand disabled:opacity-50 text-white font-bold py-3 rounded-full text-sm hover:bg-brand-dark transition flex items-center justify-center gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {saving ? "Saving…" : editingId ? "Update Address" : "Save Address"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); setError(""); }}
              className="px-6 py-3 rounded-full border border-ink/15 text-ink-mid text-sm font-semibold hover:border-ink/30 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Address list */}
      {addresses.length === 0 && !showForm ? (
        <div className="rounded-3xl border-2 border-dashed border-ink/10 bg-white py-14 text-center">
          <MapPin className="w-10 h-10 mx-auto text-ink-muted mb-3" />
          <p className="font-[family-name:var(--font-display)] text-ink text-xl mb-2">No saved addresses</p>
          <p className="text-ink-muted text-sm mb-5">Add an address to speed up checkout for physical merchandise.</p>
          <button type="button" onClick={openNew}
            className="inline-flex items-center gap-2 bg-brand text-white text-sm font-bold px-6 py-3 rounded-full hover:bg-brand-dark transition">
            <Plus className="w-4 h-4" /> Add First Address
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <div key={a.id}
              className={cn(
                "bg-white rounded-2xl border-2 p-5 flex flex-col gap-3 shadow-sm transition-all",
                a.isDefault ? "border-brand" : "border-ink/10",
              )}>
              <div className="flex items-start justify-between">
                <div>
                  {a.label && <p className="text-brand text-xs font-bold uppercase tracking-wide mb-1">{a.label}</p>}
                  <p className="font-semibold text-ink">{a.fullName}</p>
                  <p className="text-ink-muted text-sm">{a.phone}</p>
                </div>
                {a.isDefault && (
                  <span className="flex items-center gap-1 bg-brand/10 text-brand text-[10px] font-black px-2 py-1 rounded-full">
                    <Star className="w-3 h-3" /> Default
                  </span>
                )}
              </div>
              <p className="text-ink-mid text-sm leading-relaxed">
                {a.addressLine1}{a.addressLine2 ? `, ${a.addressLine2}` : ""}<br />
                {a.city}, {a.state} {a.pincode}<br />
                {a.country}
              </p>
              <div className="flex items-center gap-2 pt-2 border-t border-ink/6">
                {!a.isDefault && (
                  <button type="button" onClick={() => setDefault(a.id)}
                    className="text-xs text-brand font-semibold hover:underline transition">
                    Set as default
                  </button>
                )}
                <button type="button" onClick={() => openEdit(a)}
                  className="flex items-center gap-1 text-xs text-ink-muted hover:text-ink transition ml-auto">
                  <Pencil className="w-3 h-3" /> Edit
                </button>
                <button type="button" onClick={() => remove(a.id)}
                  className="flex items-center gap-1 text-xs text-red-400 hover:text-red-600 transition">
                  <Trash2 className="w-3 h-3" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text", className = "", maxLength }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; className?: string; maxLength?: number;
}) {
  return (
    <div className={className}>
      <label className="text-ink-mid text-sm font-medium block mb-1.5">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        maxLength={maxLength}
        className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition" />
    </div>
  );
}
