"use client";

import {
  Archive, Check, ChevronRight, Copy, Edit3, FileText,
  Loader2, Plus, RotateCcw, Star, Trash2, X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface PromptTemplate {
  id: string;
  promptKey: string;
  name: string;
  description: string | null;
  promptType: string;
  provider: string | null;
  defaultModel: string | null;
  isActive: boolean;
  isSystemPrompt: boolean;
  currentVersionId: string | null;
  currentVersion: string | null;
  currentVersionStatus: string | null;
  totalVersions: number;
  createdAt: string;
}

interface PromptVersion {
  id: string;
  promptTemplateId: string;
  version: string;
  title: string | null;
  promptText: string;
  systemInstructions: string | null;
  changeNotes: string | null;
  status: "draft" | "active" | "inactive" | "archived";
  isCurrent: boolean;
  createdAt: string;
  activatedAt: string | null;
  approvedByUserId: string | null;
}

function authHeaders() {
  const token = getAccessToken();
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
}

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: authHeaders(), ...opts });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? "Request failed");
  return (json?.data ?? json) as T;
}

// ─── Version editor modal ──────────────────────────────────────────────────────

function VersionModal({
  templateId,
  version,
  onClose,
  onSaved,
}: {
  templateId: string;
  version: PromptVersion | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !version;
  const [versionStr, setVersionStr] = useState(version?.version ?? "");
  const [promptText, setPromptText] = useState(version?.promptText ?? "");
  const [changeNotes, setChangeNotes] = useState(version?.changeNotes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      if (isNew) {
        await apiFetch(`/admin/ai/prompts/templates/${templateId}/versions`, {
          method: "POST",
          body: JSON.stringify({ version: versionStr, promptText, changeNotes }),
        });
      } else {
        await apiFetch(`/admin/ai/prompts/versions/${version!.id}`, {
          method: "PATCH",
          body: JSON.stringify({ promptText, changeNotes }),
        });
      }
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-extrabold text-gray-900">{isNew ? "New Version" : `Edit v${version!.version}`}</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {isNew && (
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1">Version tag</label>
              <input
                value={versionStr}
                onChange={(e) => setVersionStr(e.target.value)}
                placeholder="e.g. 2.0, v1.2.1"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Prompt text</label>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={14}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y"
              placeholder="Enter the prompt text…"
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Change notes</label>
            <input
              value={changeNotes}
              onChange={(e) => setChangeNotes(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              placeholder="What changed in this version?"
            />
          </div>
          {error && <p className="text-rose-600 text-sm">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={save}
            disabled={saving || !promptText.trim() || (isNew && !versionStr.trim())}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isNew ? "Create" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Version list panel ────────────────────────────────────────────────────────

function VersionsPanel({
  template,
  onBack,
}: {
  template: PromptTemplate;
  onBack: () => void;
}) {
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editVersion, setEditVersion] = useState<PromptVersion | null>(null);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{ items: PromptVersion[] }>(`/admin/ai/prompts/templates/${template.id}/versions?limit=50`);
      setVersions(res.items ?? []);
    } catch {
      setError("Failed to load versions");
    } finally {
      setLoading(false);
    }
  }, [template.id]);

  useEffect(() => { void load(); }, [load]);

  async function activate(v: PromptVersion) {
    setActioning(v.id);
    try {
      await apiFetch(`/admin/ai/prompts/versions/${v.id}/activate`, { method: "POST" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setActioning(null); }
  }

  async function rollback(v: PromptVersion) {
    setActioning(v.id);
    try {
      await apiFetch(`/admin/ai/prompts/versions/${v.id}/rollback`, { method: "POST" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setActioning(null); }
  }

  async function archive(v: PromptVersion) {
    setActioning(v.id);
    try {
      await apiFetch(`/admin/ai/prompts/versions/${v.id}/archive`, { method: "POST" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setActioning(null); }
  }

  async function duplicate(v: PromptVersion) {
    setActioning(v.id);
    try {
      await apiFetch(`/admin/ai/prompts/versions/${v.id}/duplicate`, { method: "POST" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setActioning(null); }
  }

  const statusBadge: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    draft: "bg-blue-50 text-blue-700 border-blue-200",
    inactive: "bg-gray-100 text-gray-500 border-gray-200",
    archived: "bg-orange-50 text-orange-600 border-orange-200",
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-5">
        <button onClick={onBack} className="text-violet-600 text-sm hover:underline">← Prompts</button>
        <ChevronRight className="w-3 h-3 text-gray-400" />
        <span className="text-gray-900 text-sm font-bold">{template.name}</span>
        <span className="ml-1 text-xs text-gray-400 font-mono">{template.promptKey}</span>
      </div>

      {error && <div className="mb-4 text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">{error}</div>}

      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{versions.length} version{versions.length !== 1 ? "s" : ""}</p>
        <button
          onClick={() => { setEditVersion(null); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold"
        >
          <Plus className="w-4 h-4" /> New Version
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-violet-500" /></div>
      ) : (
        <div className="space-y-3">
          {versions.map((v) => (
            <div key={v.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">v{v.version}</span>
                    {v.isCurrent && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-400" />}
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusBadge[v.status] ?? statusBadge.inactive}`}>
                      {v.status}
                    </span>
                  </div>
                  {v.changeNotes && <p className="text-xs text-gray-500 mt-1">{v.changeNotes}</p>}
                  {v.activatedAt && (
                    <p className="text-[11px] text-gray-400 mt-0.5">Activated {new Date(v.activatedAt).toLocaleDateString()}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1 font-mono line-clamp-2">{v.promptText.slice(0, 120)}…</p>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {actioning === v.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <>
                      {v.status === "draft" && (
                        <>
                          <button title="Edit" onClick={() => { setEditVersion(v); setShowModal(true); }}
                            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Edit3 className="w-3.5 h-3.5" /></button>
                          <button title="Activate" onClick={() => activate(v)}
                            className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600"><Check className="w-3.5 h-3.5" /></button>
                        </>
                      )}
                      {v.status === "inactive" && (
                        <button title="Rollback to this version" onClick={() => rollback(v)}
                          className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-600"><RotateCcw className="w-3.5 h-3.5" /></button>
                      )}
                      {(v.status === "draft" || v.status === "inactive") && !v.isCurrent && (
                        <button title="Archive" onClick={() => archive(v)}
                          className="p-1.5 rounded-lg hover:bg-orange-50 text-orange-500"><Archive className="w-3.5 h-3.5" /></button>
                      )}
                      <button title="Duplicate as new draft" onClick={() => duplicate(v)}
                        className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Copy className="w-3.5 h-3.5" /></button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <VersionModal
          templateId={template.id}
          version={editVersion}
          onClose={() => setShowModal(false)}
          onSaved={load}
        />
      )}
    </div>
  );
}

// ─── Template create modal ─────────────────────────────────────────────────────

function CreateTemplateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ promptKey: "", name: "", promptType: "story_generation", provider: "gemini", description: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function create() {
    setSaving(true);
    setError("");
    try {
      await apiFetch("/admin/ai/prompts/templates", {
        method: "POST",
        body: JSON.stringify(form),
      });
      onCreated();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setSaving(false); }
  }

  const field = (key: keyof typeof form, label: string, placeholder: string) => (
    <div>
      <label className="block text-xs font-bold text-gray-500 mb-1">{label}</label>
      <input
        value={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
      />
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-extrabold text-gray-900">New Prompt Template</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4">
          {field("promptKey", "Prompt Key (unique identifier)", "e.g. story_generation")}
          {field("name", "Display Name", "e.g. Story Generation Prompt")}
          {field("description", "Description (optional)", "What this prompt does")}
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1">Prompt Type</label>
            <select
              value={form.promptType}
              onChange={(e) => setForm((f) => ({ ...f, promptType: e.target.value }))}
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
            >
              {["story_generation", "image_generation", "qa", "character_canon", "narration", "other"].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          {field("provider", "Provider", "gemini / openai")}
          {error && <p className="text-rose-600 text-sm">{error}</p>}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
          <button
            onClick={create}
            disabled={saving || !form.promptKey || !form.name}
            className="px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold disabled:opacity-60 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function AiPromptsPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (search) params.set("search", search);
      if (filterType) params.set("promptType", filterType);
      const res = await apiFetch<{ items: PromptTemplate[]; total: number }>(`/admin/ai/prompts/templates?${params}`);
      setTemplates(res.items ?? []);
      setTotal(res.total ?? 0);
    } catch { setError("Failed to load prompt templates"); }
    finally { setLoading(false); }
  }, [search, filterType]);

  useEffect(() => { void load(); }, [load]);

  async function deleteTemplate(t: PromptTemplate) {
    if (!confirm(`Delete "${t.name}"? This cannot be undone.`)) return;
    setDeletingId(t.id);
    try {
      await apiFetch(`/admin/ai/prompts/templates/${t.id}`, { method: "DELETE" });
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Delete failed"); }
    finally { setDeletingId(null); }
  }

  const statusBadge: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    inactive: "bg-gray-100 text-gray-500 border-gray-200",
    draft: "bg-blue-50 text-blue-700 border-blue-200",
    archived: "bg-orange-50 text-orange-600 border-orange-200",
  };

  if (selected) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <VersionsPanel template={selected} onBack={() => setSelected(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <FileText className="w-5 h-5 text-violet-600" />
            <h1 className="text-2xl font-extrabold text-gray-900">Prompt Registry</h1>
          </div>
          <p className="text-gray-500 text-sm mt-1">{total} template{total !== 1 ? "s" : ""}. Changes take effect on the next story generation — no redeploy needed.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 text-white text-sm font-semibold shadow-sm"
        >
          <Plus className="w-4 h-4" /> New Template
        </button>
      </div>

      {error && <div className="mb-4 text-rose-600 text-sm bg-rose-50 border border-rose-200 rounded-xl px-4 py-2">{error}</div>}

      <div className="flex items-center gap-3 mb-5">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates…"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
        />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
        >
          <option value="">All types</option>
          {["story_generation", "image_generation", "qa", "character_canon", "narration", "other"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
      ) : templates.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No templates found. Create your first one.</div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm hover:border-violet-300 transition-colors cursor-pointer"
              onClick={() => setSelected(t)}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{t.name}</span>
                    {t.currentVersionStatus && (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${statusBadge[t.currentVersionStatus] ?? statusBadge.inactive}`}>
                        {t.currentVersionStatus === "active" ? `v${t.currentVersion} active` : t.currentVersionStatus}
                      </span>
                    )}
                    {!t.isActive && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full border bg-gray-100 text-gray-400 border-gray-200">disabled</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 font-mono mt-0.5">{t.promptKey}</p>
                  {t.description && <p className="text-xs text-gray-500 mt-1">{t.description}</p>}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400">
                    <span>{t.promptType}</span>
                    {t.provider && <span>· {t.provider}</span>}
                    <span>· {t.totalVersions} version{t.totalVersions !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    title="Manage versions"
                    onClick={() => setSelected(t)}
                    className="p-1.5 rounded-lg hover:bg-violet-50 text-violet-600"
                  ><Edit3 className="w-3.5 h-3.5" /></button>
                  <button
                    title="Delete template"
                    onClick={() => deleteTemplate(t)}
                    disabled={deletingId === t.id}
                    className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 disabled:opacity-50"
                  >
                    {deletingId === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <CreateTemplateModal onClose={() => setShowCreate(false)} onCreated={load} />
      )}
    </div>
  );
}
