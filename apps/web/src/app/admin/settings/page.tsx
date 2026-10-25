"use client";

import { Check, Loader2, Save, Settings } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getAccessToken } from "@/lib/api";
import type { PlatformSetting } from "@/lib/platform-settings";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

type SettingType = "string" | "number" | "boolean";

interface SettingDefinition {
  key: string;
  label: string;
  description: string;
  type: SettingType;
  multiline?: boolean;
}

interface SettingGroup {
  title: string;
  description: string;
  items: SettingDefinition[];
  collapsed?: boolean;
}

const GROUPS: SettingGroup[] = [
  {
    title: "Maintenance",
    description: "One switch to pause the whole site for parents — for fixes, outages or anything unexpected.",
    items: [
      { key: "MAINTENANCE_MODE", label: "Maintenance Mode", description: "ON = new stories, avatars, characters, purchases and sign-ups are paused, and every page shows the message below. Parents can still sign in and read, listen to and download their stories; stories already being made finish, and payments already in progress complete. You (admin) can still do everything.", type: "boolean" },
      { key: "MAINTENANCE_MESSAGE", label: "Message", description: "Shown on every page and wherever something is paused. Keep it short and calm.", type: "string", multiline: true },
      { key: "MAINTENANCE_BACK_BY", label: "Back By (optional)", description: "e.g. \"6:00 pm\" or \"Monday morning\" — shown as \"We'll be back by …\". Leave empty to not promise a time.", type: "string" },
    ],
  },
  {
    title: "Launch & limits",
    description: "Pre-launch vs live, and the daily caps that keep a busy day affordable.",
    items: [
      { key: "SANDBOX_MODE", label: "Sandbox Mode", description: "Launch switch. ON = everything created from now on is test data, and every new account is a Test account (pre-launch). Turn OFF at launch — new accounts are then real, and only users marked as Test account create test data. Never relabels existing records or accounts.", type: "boolean" },
      { key: "FREE_PREVIEW_DAILY_LIMIT", label: "Free Previews per Day", description: "Most free preview stories created per day across everyone (resets at midnight IST). Beyond it, parents see \"try again tomorrow\", go on a waiting list and get an email when free stories open again. 0 = no limit.", type: "number" },
      { key: "TEST_ACCOUNT_STORY_LIMIT", label: "Test Account Story Limit", description: "Most stories a Test account can create. Failed stories are refunded and don't count; deleting a story doesn't free a slot. Admin accounts are exempt. Default: 2.", type: "number" },
    ],
  },
  {
    title: "Free offers & money",
    description: "What new parents get for free, how long stories are, and the limits on coupons and commission.",
    items: [
      { key: "FREE_PREVIEW_STORIES", label: "Free Preview Stories", description: "Free preview stories awarded at signup. Used only when the user has no regular credits.", type: "number" },
      { key: "FREE_PREVIEW_PAGES", label: "Preview Story Pages", description: "Pages in a free preview story, including the cover. The site's \"free N-page preview\" wording follows this.", type: "number" },
      { key: "FULL_STORY_PAGES", label: "Full Story Pages", description: "Pages in a full (paid) story, including the cover. Default: 6 (cover + 5 story pages).", type: "number" },
      { key: "FREE_SIGNUP_CREDITS", label: "Free Signup Credits", description: "Full story credits awarded when a new account is created (0 = previews only).", type: "number" },
      { key: "FREE_HERO_AVATAR_GENERATIONS", label: "Free Hero Avatars", description: "Free hero avatar generations per account, shared by all heroes. After that each new hero avatar uses an Avatar Refresh. Failed generations are never counted.", type: "number" },
      { key: "CREDIT_PACK_MAX_COUPON_DISCOUNT_PCT", label: "Max Coupon Discount on Packs (%)", description: "The most any coupon can take off a credit pack, as % of the pack price. Keeps packs above AI cost after influencer commission. Default: 15.", type: "number" },
      { key: "INFLUENCER_MAX_COMMISSION_PCT", label: "Max Influencer Commission (%)", description: "Hard limit on any influencer's commission rate, including custom overrides. With a 10% coupon, 15% keeps marketing near 25% of a sale. Default: 15.", type: "number" },
    ],
  },
  {
    title: "GST & invoices",
    description: "Turns purchase receipts into GST tax invoices. Pack prices include GST; turning this on doesn't change what parents pay.",
    items: [
      { key: "GST_ENABLED", label: "Issue GST Tax Invoices", description: "ON = every paid pack gets a numbered tax invoice (PREFIX/2026-27/000001) with CGST + SGST or IGST worked out and saved on the order, and parents are asked their state at checkout. Only works once a valid 15-character GSTIN is filled in below. Test purchases use a separate TEST- series so your real series has no gaps.", type: "boolean" },
      { key: "GSTIN", label: "GSTIN", description: "Your 15-character GSTIN, printed on every invoice.", type: "string" },
      { key: "GST_LEGAL_NAME", label: "Legal Name", description: "Exactly as on your GST registration.", type: "string" },
      { key: "GST_ADDRESS", label: "Registered Address", description: "Exactly as on your GST registration.", type: "string", multiline: true },
      { key: "GST_STATE", label: "Registered State", description: "Parents in this state get CGST + SGST; other states get IGST. Parents who don't pick a state are treated as this state.", type: "string" },
      { key: "GST_RATE_PCT", label: "GST Rate (%)", description: "Included in pack prices. Default 18.", type: "number" },
      { key: "GST_SAC", label: "SAC Code", description: "Printed on invoices. 998431 = online content (check with your CA).", type: "string" },
      { key: "INVOICE_PREFIX", label: "Invoice Prefix", description: "Invoice numbers look like PREFIX/2026-27/000001. Don't change it mid-year.", type: "string" },
    ],
  },
  {
    title: "Cost safety",
    description: "AI spend limits and alert emails. Only live (non-test) usage counts; days reset at midnight India time.",
    items: [
      { key: "AI_DAILY_COST_WARNING_USD", label: "Daily Warning (USD)", description: "Email me when today's AI spend passes this amount. Stories keep going.", type: "number" },
      { key: "AI_DAILY_COST_HARD_LIMIT_USD", label: "Daily Limit (USD)", description: "Once today's AI spend reaches this, new stories are paused until midnight with a friendly message — nobody is charged — and you get an email. A full story costs about $0.35, so $60 ≈ 150+ stories a day. 0 = no limit.", type: "number" },
      { key: "AI_MONTHLY_COST_WARNING_USD", label: "Monthly Warning (USD)", description: "Email me when this month's AI spend passes this amount.", type: "number" },
      { key: "AI_MONTHLY_COST_HARD_LIMIT_USD", label: "Monthly Alert (USD)", description: "Email me (marked urgent) when this month's AI spend passes this amount. Does not pause stories.", type: "number" },
      { key: "ALERT_EMAIL", label: "Alert Email", description: "Where cost alerts are sent — each alert at most once a day (daily) or once a month (monthly). Leave empty to turn alert emails off.", type: "string" },
      { key: "USD_INR_RATE", label: "USD to INR Rate", description: "Conversion rate used for ₹ amounts on dashboards and in alert emails.", type: "number" },
      { key: "DISPLAY_CURRENCY", label: "Display Currency", description: "Primary currency shown in the admin dashboard.", type: "string" },
    ],
  },
  {
    title: "Features",
    description: "Switch parts of the product on or off.",
    items: [
      { key: "ENABLE_NARRATION", label: "Narration", description: "Read-aloud narration audio for every story page.", type: "boolean" },
      { key: "ENABLE_INDIAN_ENGLISH_NARRATION", label: "Indian English Narration", description: "Use Indian English prompts and narration style.", type: "boolean" },
      { key: "ENABLE_VIDEO_EXPORT", label: "Video Export", description: "Show video export actions in the story reader.", type: "boolean" },
      { key: "ENABLE_MERCHANDISE", label: "Online Store (Merchandise & Checkout)", description: "Master switch for the merchandise store, cart and checkout. When off, customers can still buy credits and avatars, but merchandise pages, buttons and new merch orders are blocked.", type: "boolean" },
      { key: "ENABLE_PHYSICAL_ORDERS", label: "Physical Orders", description: "Allow physical (shipped) products in the store. Only applies when the Online Store is on.", type: "boolean" },
      { key: "ENABLE_INFLUENCER_PROGRAM", label: "Influencer Program", description: "Master switch for the influencer programme. When off, influencers cannot log in or use their portal, and influencer coupon codes are rejected at checkout. Platform coupons and the admin Influencers tools keep working.", type: "boolean" },
    ],
  },
  {
    title: "AI engine (advanced)",
    description: "Character-age checks and AI prices used for cost tracking. Models, voice and quality checks are under AI Analytics → Settings.",
    collapsed: true,
    items: [
      { key: "APPARENT_AGE_QA_ENABLED", label: "Apparent-Age QA", description: "After each image is generated, a vision pass checks whether each child character's apparent age matches their canon age. If drift is detected, the image is regenerated.", type: "boolean" },
      { key: "APPARENT_AGE_TOLERANCE", label: "Age Drift Tolerance (years)", description: "Maximum allowed difference (in years) between a character's canon age and their estimated apparent age before the image is retried. Default: 3.", type: "number" },
      { key: "APPARENT_AGE_RETRY_CAP", label: "Age QA Retry Cap", description: "How many times to retry image generation if age drift is detected. Each retry uses identity boost mode. Default: 2.", type: "number" },
      { key: "CHILD_COSTUME_REWRITE_ENABLED", label: "Child Costume Rewrite", description: "Automatically qualifies adult-coded costume descriptions (e.g. 'battle armor') with 'child-sized' for heroes below the age threshold, reducing age drift caused by costume vocabulary.", type: "boolean" },
      { key: "CHILD_COSTUME_REWRITE_AGE_THRESHOLD", label: "Costume Rewrite Age Threshold", description: "Heroes younger than this age (in years) will have their costume descriptions rewritten to child-coded equivalents. Default: 13.", type: "number" },
      { key: "ENABLE_COSTUMED_CANONICAL", label: "Costumed Canonical Reference", description: "Before generating story pages, pre-generate one portrait of each child character wearing their story costume. All page generation calls then reference this costumed portrait instead of the plain avatar, locking both age and outfit. Increases cost (one extra image per child character per story).", type: "boolean" },
      { key: "GEMINI_IMAGE_COST_PER_IMAGE", label: "Gemini Image (per page image)", description: "Cost per story illustration in USD — the biggest part of a story's cost. Update when Google changes prices.", type: "number" },
      { key: "GEMINI_AVATAR_COST_PER_IMAGE", label: "Gemini Avatar (per avatar)", description: "Cost per avatar in USD.", type: "number" },
      { key: "GEMINI_TTS_COST_PER_CHAR", label: "Gemini Narration (per character)", description: "Cost per narrated character in USD, for voice models without a built-in price.", type: "number" },
      { key: "GEMINI_INPUT_COST_PER_1M_TOKENS",  label: "Gemini Input (per 1M tokens)",  description: "Fallback for Gemini models without a built-in price. Gemini 3.8 Flash is priced automatically ($0.75 now, $1.50 from 1 Jan 2027).", type: "number" },
      { key: "GEMINI_OUTPUT_COST_PER_1M_TOKENS", label: "Gemini Output (per 1M tokens)", description: "Fallback for Gemini models without a built-in price. Gemini 3.8 Flash is priced automatically ($3.75 now, $7.50 from 1 Jan 2027).", type: "number" },
    ],
  },
  {
    title: "Backup provider (OpenAI)",
    description: "Only used if you switch images, avatars or narration back to OpenAI under AI Analytics → Settings.",
    collapsed: true,
    items: [
      { key: "OPENAI_IMAGE_COST_PER_IMAGE",  label: "OpenAI Image (per image)",   description: "Cost per generated image in USD. Default: gpt-image-1 medium quality ($0.04).", type: "number" },
      { key: "OPENAI_AVATAR_COST_PER_IMAGE", label: "OpenAI Avatar (per avatar)", description: "Cost per avatar in USD (gpt-image-1, high quality, photo edit). Default: $0.19.", type: "number" },
      { key: "OPENAI_TTS_COST_PER_CHAR",     label: "OpenAI TTS (per character)", description: "Cost per character for TTS in USD. Default: gpt-4o-mini-tts ($0.000015).", type: "number" },
    ],
  },
];

/** "today", "yesterday", "5 days ago" — when a setting last changed, so a save that didn't stick is obvious. */
function changedAgo(iso: string | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(new Date()) - startOfDay(then)) / 86_400_000);
  const when = days <= 0 ? "today" : days === 1 ? "yesterday" : days < 60 ? `${days} days ago` : then.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `Last changed ${when}`;
}

function defaultValues(): Record<string, string> {
  return Object.fromEntries(
    GROUPS.flatMap((group) => group.items.map((item) => [item.key, item.type === "boolean" ? "true" : item.type === "number" ? "0" : ""]))
  );
}

function SettingRow({
  item,
  value,
  onChange,
  onSave,
  saving,
  saved,
  dirty,
  note,
  changed,
}: {
  item: SettingDefinition;
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  dirty: boolean;
  note?: React.ReactNode;
  changed?: string | null;
}) {
  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-violet-400";
  return (
    <div className={`flex flex-col gap-3 py-5 border-b border-gray-100 last:border-0 ${dirty ? "bg-amber-50/60 -mx-6 px-6" : ""}`}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
          <p className="text-xs text-gray-500 mt-1 leading-5">{item.description}</p>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-2 font-semibold">
            {item.key}
            {changed && <span className="ml-2 normal-case tracking-normal font-medium text-gray-400">· {changed}</span>}
          </p>
          {/* Each row saves on its own — flipping a switch without Save used to look done but change nothing. */}
          {dirty && <p className="text-xs font-bold text-amber-700 mt-2">Unsaved — click Save to apply</p>}
          {note}
        </div>
        <div className="w-[360px] max-w-full flex items-center gap-2">
          {item.type === "boolean" ? (
            <div className="flex w-full rounded-xl border border-gray-200 overflow-hidden">
              <button
                type="button"
                onClick={() => onChange("true")}
                className={`flex-1 px-3 py-2 text-sm font-semibold ${value === "true" ? "bg-violet-600 text-white" : "bg-gray-50 text-gray-600"}`}
              >
                Enabled
              </button>
              <button
                type="button"
                onClick={() => onChange("false")}
                className={`flex-1 px-3 py-2 text-sm font-semibold ${value === "false" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-600"}`}
              >
                Disabled
              </button>
            </div>
          ) : item.type === "number" ? (
            <input
              type="number"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={inputClass}
            />
          ) : item.multiline ? (
            <textarea
              rows={3}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={`${inputClass} resize-y`}
            />
          ) : (
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className={inputClass}
            />
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-white disabled:opacity-60 ${dirty ? "bg-amber-600 ring-2 ring-amber-300" : "bg-violet-600"}`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

function GroupCard({
  group,
  values,
  onChange,
  onSave,
  savingKey,
  savedKey,
  savedValues,
  notes,
  updatedAt,
}: {
  group: SettingGroup;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSave: (key: string, type: SettingType) => void;
  savingKey: string | null;
  savedKey: string | null;
  savedValues: Record<string, string>;
  notes: Record<string, React.ReactNode>;
  updatedAt: Record<string, string>;
}) {
  const dirtyCount = group.items.filter((item) => (values[item.key] ?? "") !== (savedValues[item.key] ?? "")).length;
  return (
    <details open={!group.collapsed || dirtyCount > 0} className="group bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <summary className="px-6 py-4 border-b border-gray-100 bg-gray-50 cursor-pointer list-none flex items-start justify-between gap-4">
        <div>
          <h2 className="text-gray-900 font-bold text-sm">{group.title}</h2>
          <p className="text-gray-500 text-xs mt-1">{group.description}</p>
        </div>
        <span className="text-xs font-semibold text-violet-600 whitespace-nowrap mt-0.5">
          <span className="group-open:hidden">Show {group.items.length} ▾</span>
          <span className="hidden group-open:inline">Hide ▴</span>
        </span>
      </summary>
      <div className="px-6">
        {group.items.map((item) => (
          <SettingRow
            key={item.key}
            item={item}
            value={values[item.key] ?? ""}
            onChange={(next) => onChange(item.key, next)}
            onSave={() => onSave(item.key, item.type)}
            saving={savingKey === item.key}
            saved={savedKey === item.key}
            dirty={(values[item.key] ?? "") !== (savedValues[item.key] ?? "")}
            note={notes[item.key]}
            changed={changedAgo(updatedAt[item.key])}
          />
        ))}
      </div>
    </details>
  );
}

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
  const [savedValues, setSavedValues] = useState<Record<string, string>>(defaultValues);
  const [updatedAt, setUpdatedAt] = useState<Record<string, string>>({});
  const [keyMode, setKeyMode] = useState<"live" | "test" | "missing" | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    fetch(`${BASE}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((body) => {
        const data = (body.data ?? body) as PlatformSetting[];
        const next = defaultValues();
        const changed: Record<string, string> = {};
        for (const setting of data) {
          next[setting.key] = setting.value;
          if (setting.updatedAt) changed[setting.key] = setting.updatedAt;
        }
        setUpdatedAt(changed);
        setValues(next);
        setSavedValues(next);
        setError("");
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
    fetch(`${BASE}/admin/payment-keys`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((body) => setKeyMode((body.data ?? body).razorpayKeyMode ?? null))
      .catch(() => null);
  }, []);

  const groups = useMemo(() => GROUPS, []);

  // Warning next to the launch switch, based on what's on screen (saved or not).
  const sandboxOn = values.SANDBOX_MODE === "true";
  const sandboxNote =
    !sandboxOn && keyMode && keyMode !== "live" ? (
      <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-2">
        ⚠ Sandbox off, but Razorpay is using {keyMode === "missing" ? "no" : "TEST"} keys — customers cannot really pay. Switch to live keys first.
      </p>
    ) : sandboxOn && keyMode === "live" ? (
      <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-2">
        ⚠ Razorpay LIVE keys while Sandbox is on — real payments would be counted as test. Turn Sandbox off.
      </p>
    ) : keyMode ? (
      <p className="text-[11px] text-gray-500 mt-2">Razorpay keys on the server: <strong>{keyMode === "live" ? "LIVE" : keyMode === "test" ? "TEST" : "none"}</strong></p>
    ) : null;

  const maintenanceNote = savedValues.MAINTENANCE_MODE === "true" ? (
    <p className="text-xs font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 mt-2">
      🛠️ Maintenance mode is ON — parents can only read their stories right now.
    </p>
  ) : null;

  async function saveSetting(key: string, type: SettingType) {
    const token = getAccessToken();
    if (!token) return;

    if (key === "MAINTENANCE_MODE" && values[key] === "true" && savedValues[key] !== "true") {
      const ok = window.confirm("Turn maintenance mode ON? Parents won't be able to create stories, buy credits or sign up until you turn it off. Reading stories keeps working.");
      if (!ok) return;
    }

    // The launch switch and the payment keys must agree — confirm before going live on test keys.
    if (key === "SANDBOX_MODE" && values[key] === "false" && keyMode && keyMode !== "live") {
      const ok = window.confirm(
        `Razorpay is using ${keyMode === "missing" ? "no" : "TEST"} keys. If you turn Sandbox off now, the site counts as live but customers cannot really pay. Turn it off anyway?`,
      );
      if (!ok) return;
    }

    setSavingKey(key);
    setSavedKey(null);
    setError("");
    try {
      const value = type === "number" ? Number(values[key]) : type === "boolean" ? values[key] === "true" : values[key];
      const res = await fetch(`${BASE}/admin/settings/${key}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ value }),
      });

      if (!res.ok) throw new Error("Save failed");
      const body = await res.json();
      const saved = (body.data ?? body) as PlatformSetting;
      setValues((curr) => ({ ...curr, [key]: saved.value }));
      setSavedValues((curr) => ({ ...curr, [key]: saved.value }));
      setUpdatedAt((curr) => ({ ...curr, [key]: saved.updatedAt ?? new Date().toISOString() }));
      setSavedKey(key);
      setTimeout(() => setSavedKey((curr) => (curr === key ? null : curr)), 1500);
    } catch {
      setError(`Failed to save ${key}`);
    } finally {
      setSavingKey(null);
    }
  }

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Settings className="w-5 h-5 text-violet-600" />
          <h1 className="text-gray-900 text-2xl font-extrabold">Platform Settings</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-violet-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-violet-600" />
            <h1 className="text-gray-900 text-2xl font-extrabold">Platform Settings</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">Launch switch, free offers, cost safety and features. Each setting saves on its own.</p>
        </div>
        {error && <div className="text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <GroupCard
            key={group.title}
            group={group}
            values={values}
            onChange={(key, value) => setValues((curr) => ({ ...curr, [key]: value }))}
            onSave={saveSetting}
            savingKey={savingKey}
            savedKey={savedKey}
            savedValues={savedValues}
            notes={{ SANDBOX_MODE: sandboxNote, MAINTENANCE_MODE: maintenanceNote }}
            updatedAt={updatedAt}
          />
        ))}
      </div>
    </div>
  );
}
