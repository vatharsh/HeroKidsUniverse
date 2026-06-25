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
}

interface SettingGroup {
  title: string;
  description: string;
  items: SettingDefinition[];
}

const GROUPS: SettingGroup[] = [
  {
    title: "AI Cost Alerts",
    description: "Thresholds used by the admin dashboard and health checks.",
    items: [
      { key: "AI_DAILY_COST_WARNING_USD",  label: "Daily Warning",  description: "Warn when daily AI spend reaches this amount (USD).", type: "number" },
      { key: "AI_MONTHLY_COST_WARNING_USD", label: "Monthly Warning", description: "Warn when monthly AI spend reaches this amount (USD).", type: "number" },
      { key: "AI_DAILY_COST_HARD_LIMIT_USD", label: "Daily Hard Limit", description: "Critical alert threshold for daily AI spend (USD).", type: "number" },
      { key: "AI_MONTHLY_COST_HARD_LIMIT_USD", label: "Monthly Hard Limit", description: "Critical alert threshold for monthly AI spend (USD).", type: "number" },
    ],
  },
  {
    title: "Currency",
    description: "Currency values used by the dashboard and pricing calculations.",
    items: [
      { key: "USD_INR_RATE", label: "USD to INR Rate", description: "Conversion rate used when showing INR totals.", type: "number" },
      { key: "DISPLAY_CURRENCY", label: "Display Currency", description: "Primary currency shown in the admin dashboard.", type: "string" },
    ],
  },
  {
    title: "Feature Flags",
    description: "Toggle major product experiences on or off.",
    items: [
      { key: "ENABLE_NARRATION", label: "Narration", description: "Allow AI narration generation.", type: "boolean" },
      { key: "ENABLE_VIDEO_EXPORT", label: "Video Export", description: "Show video export actions in the story reader.", type: "boolean" },
      { key: "ENABLE_MERCHANDISE", label: "Merchandise", description: "Show merchandise-related experiences.", type: "boolean" },
      { key: "ENABLE_PHYSICAL_ORDERS", label: "Physical Orders", description: "Show physical order purchase options.", type: "boolean" },
      { key: "ENABLE_INFLUENCER_PROGRAM", label: "Influencer Program", description: "Show influencer admin tools.", type: "boolean" },
      { key: "ENABLE_STORY_CONTINUATION", label: "Story Continuation", description: "Allow continuing existing universes.", type: "boolean" },
      { key: "ENABLE_UNIVERSE_MEMORY", label: "Universe Memory", description: "Persist and reuse memory for universes.", type: "boolean" },
      { key: "ENABLE_INDIAN_ENGLISH_NARRATION", label: "Indian English Narration", description: "Use Indian English prompts and narration style.", type: "boolean" },
    ],
  },
  {
    title: "AI Model Pricing",
    description: "Per-unit costs for each AI provider. Update these whenever provider pricing changes — they are used to calculate real costs in ai_usage_logs.",
    items: [
      { key: "GEMINI_INPUT_COST_PER_1M_TOKENS",  label: "Gemini Input (per 1M tokens)",  description: "Cost per 1M input tokens in USD. Default: Gemini 2.5 Flash Lite ($0.10).",      type: "number" },
      { key: "GEMINI_OUTPUT_COST_PER_1M_TOKENS", label: "Gemini Output (per 1M tokens)", description: "Cost per 1M output tokens in USD. Default: Gemini 2.5 Flash Lite ($0.40).",     type: "number" },
      { key: "OPENAI_IMAGE_COST_PER_IMAGE",       label: "OpenAI Image (per image)",      description: "Cost per generated image in USD. Default: gpt-image-1 medium quality ($0.04).", type: "number" },
      { key: "OPENAI_TTS_COST_PER_CHAR",          label: "OpenAI TTS (per character)",    description: "Cost per character for TTS in USD. Default: gpt-4o-mini-tts ($0.000015).",      type: "number" },
    ],
  },
  {
    title: "Generation Limits",
    description: "Limits used by signup, planning, and image generation.",
    items: [
      { key: "FREE_SIGNUP_CREDITS", label: "Free Signup Credits", description: "Credits awarded when a new account is created.", type: "number" },
      { key: "BASIC_PLAN_PAGES", label: "Basic Plan Pages", description: "Default page count for the Basic plan.", type: "number" },
      { key: "STANDARD_PLAN_PAGES", label: "Standard Plan Pages", description: "Default page count for the Standard plan.", type: "number" },
      { key: "PREMIUM_PLAN_PAGES", label: "Premium Plan Pages", description: "Default page count for the Premium plan.", type: "number" },
      { key: "MAX_IMAGES_PER_STORY_DEV", label: "Max Images / Story (Dev)", description: "Image cap used in development.", type: "number" },
      { key: "MAX_IMAGES_PER_STORY_PROD", label: "Max Images / Story (Prod)", description: "Image cap used in production.", type: "number" },
    ],
  },
];

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
}: {
  item: SettingDefinition;
  value: string;
  onChange: (next: string) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const inputClass = "w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-violet-400";
  return (
    <div className="flex flex-col gap-3 py-5 border-b border-gray-100 last:border-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{item.label}</p>
          <p className="text-xs text-gray-500 mt-1 leading-5">{item.description}</p>
          <p className="text-[10px] uppercase tracking-widest text-gray-400 mt-2 font-semibold">{item.key}</p>
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
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
}: {
  group: SettingGroup;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  onSave: (key: string, type: SettingType) => void;
  savingKey: string | null;
  savedKey: string | null;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
        <h2 className="text-gray-900 font-bold text-sm">{group.title}</h2>
        <p className="text-gray-500 text-xs mt-1">{group.description}</p>
      </div>
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
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminSettingsPage() {
  const [values, setValues] = useState<Record<string, string>>(defaultValues);
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
        for (const setting of data) {
          next[setting.key] = setting.value;
        }
        setValues(next);
        setError("");
      })
      .catch(() => setError("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => GROUPS, []);

  async function saveSetting(key: string, type: SettingType) {
    const token = getAccessToken();
    if (!token) return;

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
          <p className="text-gray-500 text-sm mt-1">Manage alerts, limits, currency, and feature flags from one place.</p>
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
          />
        ))}
      </div>
    </div>
  );
}
