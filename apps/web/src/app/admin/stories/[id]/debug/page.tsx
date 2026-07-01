"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { getAccessToken } from "@/lib/api";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

interface DebugPage {
  pageNumber: number;
  text: string;
  imageUrl?: string;
  sceneDescription?: string;
  background?: string;
  camera?: string;
  dialogue?: Array<{ speaker: string; text: string; emotion?: string; bubbleStyle?: string; placementHint?: string }>;
  speechBubbles?: Array<{ speakerName: string; text: string; emotion?: string; bubbleStyle?: string; placementHint?: string; priority?: number }>;
  characters?: Array<{ name: string; expression?: string; pose?: string; facingDirection?: string; gazeDirection?: string; isSpeaking?: boolean; reactionToScene?: string }>;
  characterDirections?: Array<{ name: string; role?: string; expression: string; expressionDetails?: { eyes?: string; mouth?: string; eyebrows?: string }; pose: string; facingDirection?: string; gazeDirection?: string; isSpeaking?: boolean; reactionToScene?: string }>;
  storyStateSnapshot?: { location?: string; costume?: string; items?: string[]; powers?: string[]; companions?: string[] };
  storyStateUpdate?: { newItems?: string[]; removedItems?: string[]; newPowers?: string[]; removedPowers?: string[]; locationChange?: string; costumeChange?: string };
  imagePromptUsed?: string;
}

interface DebugData {
  pages: DebugPage[];
  storyVisualState?: { costume?: string; companion?: string; weapon?: string; powers?: string[]; inventory?: string[] };
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre className="bg-gray-900 text-green-300 text-[11px] p-3 rounded-lg overflow-auto max-h-60 whitespace-pre-wrap break-all">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

function Collapse({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 text-left text-sm font-medium text-gray-700 transition"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />}
        {label}
      </button>
      {open && <div className="p-3 border-t border-gray-200 bg-white">{children}</div>}
    </div>
  );
}

function Tag({ children, color = "gray" }: { children: React.ReactNode; color?: "violet" | "emerald" | "amber" | "red" | "gray" }) {
  const cls = {
    violet: "bg-violet-100 text-violet-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    red: "bg-red-100 text-red-600",
    gray: "bg-gray-100 text-gray-600",
  }[color];
  return <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${cls}`}>{children}</span>;
}

export default function StoryDebugPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DebugData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedPage, setSelectedPage] = useState(0);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;
    fetch(`${BASE}/admin/stories/${id}/debug`, { headers: { Authorization: `Bearer ${token}` } })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) { setError(j.message ?? "Failed to load"); return; }
        setData(j.data ?? j);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="p-8 text-gray-400">Loading debug data…</div>;
  if (error) return <div className="p-8 text-red-500">{error}</div>;
  if (!data) return null;

  const pg = data.pages[selectedPage];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-4">
        <a href="/admin/stories" className="text-violet-600 text-sm hover:underline">← Stories</a>
        <h1 className="text-2xl font-extrabold text-gray-900 mt-1">Story Debug — {id.slice(0, 8)}…</h1>
      </div>

      {/* Story Visual State */}
      {data.storyVisualState && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-2">Story Visual State</p>
          <div className="flex flex-wrap gap-2">
            {data.storyVisualState.costume && <Tag color="violet">🦸 {data.storyVisualState.costume}</Tag>}
            {data.storyVisualState.companion && <Tag color="amber">🐾 {data.storyVisualState.companion}</Tag>}
            {data.storyVisualState.weapon && <Tag color="gray">⚔️ {data.storyVisualState.weapon}</Tag>}
            {data.storyVisualState.powers?.map((p) => <Tag key={p} color="emerald">⚡ {p}</Tag>)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-12 gap-4">
        {/* Page selector sidebar */}
        <div className="col-span-2">
          <p className="text-xs text-gray-500 font-bold uppercase tracking-wide mb-2 px-1">Pages</p>
          <div className="flex flex-col gap-1">
            {data.pages.map((p, i) => (
              <button
                key={p.pageNumber}
                type="button"
                onClick={() => setSelectedPage(i)}
                className={`text-left px-3 py-2 rounded-lg text-sm font-medium transition ${
                  i === selectedPage ? "bg-violet-600 text-white" : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                Page {p.pageNumber}
              </button>
            ))}
          </div>
        </div>

        {/* Page detail */}
        <div className="col-span-10 space-y-3">
          {pg && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {/* Image preview */}
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  {pg.imageUrl ? (
                    <img src={pg.imageUrl} alt={`Page ${pg.pageNumber}`} className="w-full h-48 object-cover" />
                  ) : (
                    <div className="w-full h-48 bg-gray-100 flex items-center justify-center text-gray-400 text-xs">No image</div>
                  )}
                </div>

                {/* Narration + scene */}
                <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Narration</p>
                    <p className="text-sm text-gray-800 leading-relaxed">{pg.text}</p>
                  </div>
                  {pg.background && (
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Background</p>
                      <p className="text-xs text-gray-600">{pg.background}</p>
                    </div>
                  )}
                  {pg.camera && (
                    <div>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wide mb-1">Camera</p>
                      <p className="text-xs text-gray-600">{pg.camera}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Character Directions */}
              {(pg.characterDirections?.length ?? 0) > 0 && (
                <Collapse label={`Character Directions (${pg.characterDirections!.length})`}>
                  <div className="space-y-2">
                    {pg.characterDirections!.map((c, i) => (
                      <div key={i} className="bg-gray-50 rounded-lg p-3 text-xs">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="font-bold text-gray-900">{c.name}</span>
                          {c.role && <Tag color="violet">{c.role}</Tag>}
                          {c.isSpeaking && <Tag color="emerald">Speaking</Tag>}
                        </div>
                        <p className="text-gray-700 mb-1"><span className="font-medium">Expression:</span> {c.expression}</p>
                        {c.expressionDetails && (
                          <p className="text-gray-500 mb-1">
                            {c.expressionDetails.eyes && `Eyes: ${c.expressionDetails.eyes}`}
                            {c.expressionDetails.mouth && ` · Mouth: ${c.expressionDetails.mouth}`}
                            {c.expressionDetails.eyebrows && ` · Eyebrows: ${c.expressionDetails.eyebrows}`}
                          </p>
                        )}
                        <p className="text-gray-700 mb-1"><span className="font-medium">Pose:</span> {c.pose}</p>
                        {c.facingDirection && <p className="text-gray-500"><span className="font-medium">Facing:</span> {c.facingDirection}</p>}
                        {c.reactionToScene && <p className="text-gray-500"><span className="font-medium">Reaction:</span> {c.reactionToScene}</p>}
                      </div>
                    ))}
                  </div>
                </Collapse>
              )}

              {/* Speech Bubbles */}
              {(pg.speechBubbles?.length ?? 0) > 0 && (
                <Collapse label={`Speech Bubbles (${pg.speechBubbles!.length})`}>
                  <div className="space-y-2">
                    {pg.speechBubbles!.map((b, i) => (
                      <div key={i} className="bg-white border border-gray-200 rounded-lg p-3 text-xs flex items-start gap-3">
                        <div className="flex-1">
                          <span className="font-bold text-violet-700">{b.speakerName}:</span>
                          <span className="text-gray-800 ml-1">&ldquo;{b.text}&rdquo;</span>
                        </div>
                        <div className="flex gap-1.5 flex-shrink-0 flex-wrap">
                          {b.bubbleStyle && <Tag color="amber">{b.bubbleStyle}</Tag>}
                          {b.emotion && <Tag color="gray">{b.emotion}</Tag>}
                          {b.placementHint && <Tag color="gray">{b.placementHint}</Tag>}
                          {b.priority && <Tag color="gray">priority {b.priority}</Tag>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Collapse>
              )}

              {/* Story State Snapshot */}
              {pg.storyStateSnapshot && (
                <Collapse label="Story State Snapshot (at this page)">
                  <div className="flex flex-wrap gap-2">
                    {pg.storyStateSnapshot.location && <Tag color="gray">📍 {pg.storyStateSnapshot.location}</Tag>}
                    {pg.storyStateSnapshot.costume && <Tag color="violet">🦸 {pg.storyStateSnapshot.costume}</Tag>}
                    {pg.storyStateSnapshot.companions?.map((c) => <Tag key={c} color="amber">🐾 {c}</Tag>)}
                    {pg.storyStateSnapshot.items?.map((item) => <Tag key={item} color="gray">💎 {item}</Tag>)}
                    {pg.storyStateSnapshot.powers?.map((p) => <Tag key={p} color="emerald">⚡ {p}</Tag>)}
                  </div>
                </Collapse>
              )}

              {/* State Update */}
              {pg.storyStateUpdate && (
                <Collapse label="Story State Update (changes this page triggers)">
                  <JsonBlock data={pg.storyStateUpdate} />
                </Collapse>
              )}

              {/* Scene Description */}
              {pg.sceneDescription && (
                <Collapse label="Scene Description (sent to image model)">
                  <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{pg.sceneDescription}</p>
                </Collapse>
              )}

              {/* Image Prompt Used */}
              {pg.imagePromptUsed && (
                <Collapse label="Full Image Prompt Used">
                  <p className="text-[11px] text-gray-700 leading-relaxed whitespace-pre-wrap font-mono">{pg.imagePromptUsed}</p>
                </Collapse>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
