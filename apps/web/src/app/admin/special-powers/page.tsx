"use client";

import { CalendarPlus, Loader2, Sparkles, Trash2, Wand2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import { specialPowersApi, type AdminDrop, type LibraryPower, type PowerLevel } from "@/lib/special-powers";

type Collection = { key: string; name: string; emoji: string };
type FormState = { day: string; powerKey: string | null; name: string; emoji: string; description: string };

const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

export default function AdminHiddenPowersPage() {
  const [data, setData] = useState<{ today: string; drops: AdminDrop[]; totals: { finds: number; heroes: number }; levels: PowerLevel[]; collections: Collection[] } | null>(null);
  const [library, setLibrary] = useState<{ collections: Collection[]; powers: LibraryPower[] }>({ collections: [], powers: [] });
  const [form, setForm] = useState<FormState>({ day: "", powerKey: null, name: "", emoji: "✨", description: "" });
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    specialPowersApi.adminList().then(setData).catch((e) => setMessage({ ok: false, text: e.message }));
  }, []);
  useEffect(() => {
    load();
    specialPowersApi.library().then(setLibrary).catch(() => {});
  }, [load]);

  const usedKeys = useMemo(() => new Set(data?.drops.map((d) => d.powerKey).filter(Boolean)), [data]);
  const takenDays = useMemo(() => new Set(data?.drops.map((d) => d.day)), [data]);
  const todayDrop = data?.drops.find((d) => d.day === data.today);
  const upcoming = (data?.drops ?? []).filter((d) => d.day > (data?.today ?? "")).sort((a, b) => a.day.localeCompare(b.day));
  const past = (data?.drops ?? []).filter((d) => d.day < (data?.today ?? ""));

  function openAdd() {
    // Default to the first free day from today.
    let d = new Date(`${data?.today ?? new Date().toISOString().slice(0, 10)}T12:00:00Z`);
    while (takenDays.has(d.toISOString().slice(0, 10))) d = new Date(d.getTime() + 86_400_000);
    const first = library.powers.find((p) => !usedKeys.has(p.key));
    setForm({ day: d.toISOString().slice(0, 10), powerKey: first?.key ?? null, name: first?.name ?? "", emoji: first?.emoji ?? "✨", description: first?.description ?? "" });
    setAdding(true);
  }

  async function run(label: string, fn: () => Promise<string>) {
    setBusy(label); setMessage(null);
    try { setMessage({ ok: true, text: await fn() }); load(); }
    catch (e) { setMessage({ ok: false, text: e instanceof Error ? e.message : "Failed" }); }
    finally { setBusy(""); }
  }

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-violet-600" /></div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <h1 className="text-gray-900 text-2xl font-extrabold">Hidden Powers</h1>
        </div>
        <p className="text-gray-500 text-sm mt-1">
          On a power day, a special power hides on one page of every story. Children find it with the 🔮 magic lens while reading — today only.
          The 32 Power Book powers sit in 4 collections of 8; completing whole collections levels a hero up. Found powers join the hero&apos;s
          universe, so they appear in the next episode. No AI cost.
        </p>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div className="sm:col-span-2 bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Today · {fmtDay(data.today)}</p>
          {todayDrop ? (
            <div className="flex items-center gap-3 mt-2">
              <span className="text-4xl">{todayDrop.emoji}</span>
              <div>
                <p className="font-bold text-gray-900">{todayDrop.name}</p>
                <p className="text-xs text-gray-500">{todayDrop.description}</p>
                <p className="text-xs font-semibold text-violet-700 mt-1">Found by {todayDrop.finds} hero{todayDrop.finds === 1 ? "" : "es"} so far</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 mt-2">No power hiding today.</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5 shadow-sm">
          <p className="text-[10px] uppercase tracking-widest font-bold text-gray-400">Hero levels (automatic)</p>
          <ul className="mt-2 space-y-1 text-xs text-gray-700">
            {data.levels.map((l) => <li key={l.key}><b>{l.badge} {l.sets} collection{l.sets === 1 ? "" : "s"}</b> → {l.rewardText}</li>)}
          </ul>
          <p className="text-[11px] text-gray-400 mt-2">{data.totals.finds} finds by {data.totals.heroes} heroes in total. Rewards go to the parent&apos;s account by themselves.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={!!busy} onClick={() => run("plan", async () => {
          const r = await specialPowersApi.plan(2);
          return r.created ? `Planned ${r.created} power days (Mon, Wed, Sat) for the next 2 weeks, taking turns between the 4 collections.` : "The next 2 weeks are already planned.";
        })} className="inline-flex items-center gap-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white">
          {busy === "plan" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Plan the next 2 weeks for me
        </button>
        <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-700">
          <CalendarPlus className="w-4 h-4" /> Add a power day
        </button>
      </div>
      {message && <p className={`text-sm font-semibold ${message.ok ? "text-emerald-700" : "text-red-600"}`}>{message.text}</p>}

      {adding && (
        <div className="bg-white border border-violet-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="space-y-3">
            <p className="text-sm font-bold text-gray-900">Pick a Power Book power <span className="font-normal text-gray-400">— counts towards levels</span></p>
            {library.collections.map((c) => (
              <div key={c.key}>
                <p className="text-[11px] font-bold text-gray-500 mb-1">{c.emoji} {c.name}</p>
                <div className="flex flex-wrap gap-1.5">
                  {library.powers.filter((p) => p.collection === c.key).map((p) => (
                    <button key={p.key} type="button" title={p.description}
                      onClick={() => setForm({ ...form, powerKey: p.key, name: p.name, emoji: p.emoji, description: p.description })}
                      className={`text-xs rounded-full border px-2.5 py-1 ${form.powerKey === p.key ? "border-violet-600 bg-violet-50 text-violet-700 font-semibold" : "border-gray-200 text-gray-600 hover:border-violet-300"} ${usedKeys.has(p.key) ? "opacity-60" : ""}`}>
                      {p.emoji} {p.name}{usedKeys.has(p.key) ? " · used" : ""}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button type="button" onClick={() => setForm({ ...form, powerKey: null, name: "", emoji: "✨", description: "" })}
              className={`text-xs rounded-full border px-3 py-1.5 ${form.powerKey === null ? "border-violet-600 bg-violet-50 text-violet-700 font-semibold" : "border-dashed border-gray-300 text-gray-600"}`}>
              ✍️ Write my own (a ✨ Bonus power — fun to collect, doesn&apos;t count towards levels)
            </button>
          </div>
          <div className="grid sm:grid-cols-[150px_70px_1fr] gap-2">
            <input type="date" value={form.day} min={data.today} onChange={(e) => setForm({ ...form, day: e.target.value })} className="rounded-xl border border-gray-200 px-3 py-2 text-sm" />
            <input value={form.emoji} disabled={!!form.powerKey} onChange={(e) => setForm({ ...form, emoji: e.target.value })} maxLength={8} className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-center disabled:bg-gray-50" />
            <input value={form.name} disabled={!!form.powerKey} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Power name" maxLength={60} className="rounded-xl border border-gray-200 px-3 py-2 text-sm disabled:bg-gray-50" />
          </div>
          <input value={form.description} disabled={!!form.powerKey} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="One line a child will understand — what does it do?" maxLength={200} className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm" />
          <div className="flex gap-2">
            <button type="button" disabled={!!busy} onClick={() => run("add", async () => {
              await specialPowersApi.create(form);
              setAdding(false);
              return `${form.emoji} ${form.name} is set for ${fmtDay(form.day)}.`;
            })} className="rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-60 px-4 py-2 text-sm font-semibold text-white">Save power day</button>
            <button type="button" onClick={() => setAdding(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm text-gray-600">Cancel</button>
          </div>
        </div>
      )}

      <DropList title="Coming up" drops={upcoming} empty="Nothing planned yet — use “Plan the next 2 weeks for me”." onDelete={(d) => run(`del-${d.id}`, async () => {
        if (!window.confirm(`Remove ${d.name} on ${fmtDay(d.day)}?`)) return "Kept.";
        await specialPowersApi.remove(d.id);
        return `${d.name} removed.`;
      })} />
      <DropList title="Past power days" drops={past} empty="No past power days yet." />
    </div>
  );
}

function DropList({ title, drops, empty, onDelete }: { title: string; drops: AdminDrop[]; empty: string; onDelete?: (d: AdminDrop) => void }) {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
      <p className="px-5 py-3 border-b border-gray-100 bg-gray-50 text-sm font-bold text-gray-900">{title}</p>
      {drops.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400">{empty}</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {drops.map((d) => (
            <li key={d.id} className="px-5 py-3 flex items-center gap-3">
              <span className="w-24 text-xs font-semibold text-gray-500">{fmtDay(d.day)}</span>
              <span className="text-2xl">{d.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{d.name} {!d.powerKey && <span className="text-[10px] font-bold text-violet-600 bg-violet-50 rounded-full px-1.5 py-0.5 ml-1">BONUS</span>}</p>
                <p className="text-xs text-gray-500 truncate">{d.description}</p>
              </div>
              <span className="text-xs text-gray-500 whitespace-nowrap">{d.finds} found</span>
              {onDelete && (
                <button type="button" onClick={() => onDelete(d)} className="text-gray-300 hover:text-red-500" title="Remove"><Trash2 className="w-4 h-4" /></button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
