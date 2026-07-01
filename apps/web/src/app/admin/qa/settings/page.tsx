"use client";

import { Check, Loader2, Save, Activity } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

type SettingType = "string" | "number" | "boolean";

interface SettingDef {
  key: string;
  label: string;
  description: string;
  type: SettingType;
}

interface Group {
  title: string;
  description: string;
  items: SettingDef[];
}

const GROUPS: Group[] = [
  {
    title: "Master Toggle",
    description: "Enable or disable the QA Engine entirely. When disabled, all stories pass QA automatically.",
    items: [
      { key: "QA_ENABLED",                  label: "QA Engine Enabled",       description: "Master toggle — enables/disables the entire QA pipeline.", type: "boolean" },
      { key: "QA_ENABLE_AUTO_REGENERATION", label: "Auto-Regeneration",       description: "Automatically regenerate pages that fail identity QA.", type: "boolean" },
    ],
  },
  {
    title: "QA Dimensions",
    description: "Enable or disable individual QA checks. Disabled checks are scored 8/10 (neutral) and never trigger regeneration.",
    items: [
      { key: "QA_ENABLE_IDENTITY_QA",    label: "Identity QA",    description: "Face resemblance check — compares story illustrations against the approved avatar.", type: "boolean" },
      { key: "QA_ENABLE_STORY_QA",       label: "Story QA",       description: "Continuity check — costume, companion, and power consistency across pages.", type: "boolean" },
      { key: "QA_ENABLE_EXPRESSION_QA",  label: "Expression QA",  description: "Expression-emotion matching — verifies expressions align with dialogue emotion.", type: "boolean" },
      { key: "QA_ENABLE_DIALOGUE_QA",    label: "Dialogue QA",    description: "Speaker validity, duplicate bubble detection, narration-dialogue overlap.", type: "boolean" },
      { key: "QA_ENABLE_COMPOSITION_QA", label: "Composition QA", description: "AI vision composition check (one vision call per page — expensive, off by default).", type: "boolean" },
      { key: "QA_ENABLE_NARRATION_QA",   label: "Narration QA",   description: "Audio presence and text length check.", type: "boolean" },
    ],
  },
  {
    title: "Thresholds",
    description: "Minimum scores for a page or story to pass QA. Pages below threshold trigger auto-regeneration if enabled.",
    items: [
      { key: "QA_MIN_IDENTITY_SCORE",       label: "Min Identity Score (0–10)",   description: "Pages below this identity score will be auto-regenerated.", type: "number" },
      { key: "QA_MIN_STORY_SCORE",          label: "Min Story Score (0–10)",      description: "Pages below this story continuity score are flagged.", type: "number" },
      { key: "QA_MIN_EXPRESSION_SCORE",     label: "Min Expression Score (0–10)", description: "Pages below this expression score are flagged.", type: "number" },
      { key: "QA_MIN_OVERALL_CONFIDENCE",   label: "Min Overall Confidence (0–100)", description: "Overall story confidence below this value triggers auto-regeneration of failed pages.", type: "number" },
      { key: "QA_MAX_RETRIES",              label: "Max Auto-Regeneration Retries", description: "Maximum retry attempts per failed page. Never regenerates endlessly.", type: "number" },
    ],
  },
  {
    title: "Confidence Weights",
    description: "Percentage weights for each QA dimension in the overall confidence score. Must conceptually add to 100.",
    items: [
      { key: "QA_WEIGHT_IDENTITY",           label: "Identity Weight (%)",           description: "Default 40 — highest because visual identity is the core promise.", type: "number" },
      { key: "QA_WEIGHT_STORY",              label: "Story Continuity Weight (%)",   description: "Default 20 — costume/companion/state consistency.", type: "number" },
      { key: "QA_WEIGHT_EXPRESSION",         label: "Expression Weight (%)",         description: "Default 10.", type: "number" },
      { key: "QA_WEIGHT_DIALOGUE",           label: "Dialogue Weight (%)",           description: "Default 10.", type: "number" },
      { key: "QA_WEIGHT_COMPOSITION",        label: "Composition Weight (%)",        description: "Default 10.", type: "number" },
      { key: "QA_WEIGHT_NARRATION",          label: "Narration Weight (%)",          description: "Default 5.", type: "number" },
      { key: "QA_WEIGHT_STATE_CONSISTENCY",  label: "State Consistency Weight (%)",  description: "Default 5.", type: "number" },
    ],
  },
  {
    title: "Prompt Version Tracking",
    description: "Increment these tags when you update generation prompts to track improvement trends in the QA dashboard.",
    items: [
      { key: "QA_STORY_PROMPT_VERSION",  label: "Story Prompt Version",  description: "Increment when you change the Gemini story prompt.", type: "string" },
      { key: "QA_IMAGE_PROMPT_VERSION",  label: "Image Prompt Version",  description: "Increment when you change the OpenAI image prompt.", type: "string" },
      { key: "QA_VERSION",               label: "QA Engine Version",     description: "Increment when you change QA scoring logic.", type: "string" },
    ],
  },
];

export default function QaSettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState("");

  const allKeys = useMemo(() => GROUPS.flatMap((g) => g.items.map((i) => i.key)), []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${BASE}/admin/settings`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        const arr: Array<{ key: string; value: string }> = j.data ?? j;
        const map: Record<string, string> = {};
        arr.forEach(({ key, value }) => { if (allKeys.includes(key)) map[key] = value; });
        setSettings(map);
      })
      .catch(() => setError("Failed to load QA settings"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line

  async function saveSetting(key: string, value: string) {
    const token = getAccessToken();
    if (!token) return;
    setSaving(key);
    try {
      const res = await fetch(`${BASE}/admin/settings/${key}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error("Save failed");
      setSettings((prev) => ({ ...prev, [key]: value }));
      setSaved(key);
      setTimeout(() => setSaved(null), 1500);
    } catch {
      setError(`Failed to save ${key}`);
    } finally {
      setSaving(null);
    }
  }

  if (loading)
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />
      </div>
    );

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6 flex items-center gap-4">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center text-white shadow-sm">
          <Activity className="w-4.5 h-4.5" />
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <a href="/admin/qa" className="text-violet-600 text-xs hover:underline">← AI Quality Dashboard</a>
          </div>
          <h1 className="text-gray-900 text-2xl font-extrabold">QA Engine Settings</h1>
          <p className="text-gray-500 text-sm mt-0.5">All changes take effect on the next story generation — no redeploy required.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-rose-700 text-sm">{error}</div>
      )}

      <div className="space-y-8">
        {GROUPS.map((group) => (
          <div key={group.title} className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-violet-50/30">
              <h2 className="text-gray-900 font-extrabold text-sm">{group.title}</h2>
              <p className="text-gray-500 text-xs mt-0.5">{group.description}</p>
            </div>
            <div className="divide-y divide-gray-100">
              {group.items.map((item) => {
                const currentValue = settings[item.key] ?? "";
                return (
                  <div key={item.key} className="px-6 py-4 flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-semibold">{item.label}</p>
                      <p className="text-gray-500 text-xs mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {item.type === "boolean" ? (
                        <button
                          type="button"
                          onClick={() => saveSetting(item.key, currentValue === "true" ? "false" : "true")}
                          disabled={saving === item.key}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            currentValue === "true" ? "bg-violet-600" : "bg-gray-200"
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              currentValue === "true" ? "translate-x-6" : "translate-x-1"
                            }`}
                          />
                        </button>
                      ) : (
                        <input
                          type={item.type === "number" ? "number" : "text"}
                          value={currentValue}
                          onChange={(e) => setSettings((prev) => ({ ...prev, [item.key]: e.target.value }))}
                          onBlur={(e) => saveSetting(item.key, e.target.value)}
                          className="w-24 text-right text-sm font-mono border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                        />
                      )}
                      <div className="w-5 h-5 flex-shrink-0">
                        {saving === item.key && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
                        {saved === item.key && <Check className="w-4 h-4 text-emerald-500" />}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
