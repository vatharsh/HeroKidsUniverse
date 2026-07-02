"use client";

import { Clapperboard, FileText, Loader2, Package, Share2, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/api";
import { usePublicPlatformSettings } from "@/lib/platform-settings";

// ── Types ────────────────────────────────────────────────────────────────────

type BubbleStyle = "normal" | "excited" | "whisper" | "thinking" | "surprised";

interface PageDialogue {
  speaker: string;
  text: string;
  emotion?: string;
  bubbleStyle?: BubbleStyle;
  placementHint?: string;
}

interface SpeechBubbleMeta {
  speakerCharacterId?: string;
  speakerName: string;
  text: string;
  emotion?: string;
  bubbleStyle?: BubbleStyle;
  /** Structured placement (preferred) */
  preferredPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  tailDirection?: 'down-left' | 'down-right' | 'up-left' | 'up-right';
  avoidCovering?: string[];
  maxWidthPercent?: number;
  anchor?: "mouth" | "lower_face" | "head" | "upper_left" | "upper_right";
  anchorTarget?: "mouth" | "lower_face" | "head";
  anchorPoint?: { x: number; y: number };
  bubbleRect?: { x: number; y: number; width: number; height: number };
  layoutConfidence?: number;
  /** Legacy */
  placementHint?: string;
  priority?: number;
}

interface PageCharacterDirection {
  characterId?: string;
  name: string;
  role?: string;
  visible?: boolean;
  position?: "left" | "center" | "right" | "foreground" | "background";
  expression?: string;
  expressionDetails?: { eyes?: string; mouth?: string; eyebrows?: string; gaze?: string; headTilt?: string };
  pose?: string;
  action?: string;
  lookingAt?: string;
  facingDirection?: string;
  gazeDirection?: string;
  mouthState?: "speaking" | "closed" | "smiling" | "surprised";
  isSpeaking?: boolean;
}

interface StoryPage {
  pageNumber: number;
  text: string;
  narrationText?: string;
  finalNarrationText?: string;
  imageUrl?: string;
  backgroundUrl?: string;
  audioUrl?: string;
  sceneDescription?: string;
  dialogue?: PageDialogue[];
  characters?: Array<{ name: string; expression?: string; pose?: string }>;
  camera?: string;
  cropHint?: string;
  sceneId?: string;
  background?: string;
  speechBubbles?: SpeechBubbleMeta[];
  characterDirections?: PageCharacterDirection[];
  storyStateSnapshot?: {
    location?: string;
    costume?: string;
    items?: string[];
    powers?: string[];
    companions?: string[];
  };
}

// CSS crop transform for each hint — maps a shared scene illustration to a page-specific "shot"
function getCropStyle(cropHint: string | undefined): React.CSSProperties {
  switch (cropHint) {
    case "zoom_hero":
      return { objectPosition: "25% center", transform: "scale(1.55)", transformOrigin: "25% center" };
    case "zoom_hero_right":
      return { objectPosition: "75% center", transform: "scale(1.55)", transformOrigin: "75% center" };
    case "zoom_companion":
      return { objectPosition: "70% center", transform: "scale(1.55)", transformOrigin: "70% center" };
    case "zoom_center":
      return { objectPosition: "center center", transform: "scale(1.35)", transformOrigin: "center center" };
    case "close_up":
      return { objectPosition: "center 20%", transform: "scale(1.9)", transformOrigin: "center 20%" };
    case "wide_cinematic":
      return { objectPosition: "center center", transform: "scaleY(0.75) translateY(-8%)", transformOrigin: "center center" };
    case "full_width":
    default:
      return {};
  }
}

// ── Speech Bubble Renderer ────────────────────────────────────────────────────

function getSpeechBubbles(page: StoryPage): Array<{
  speakerName: string; text: string; bubbleStyle: BubbleStyle;
  preferredPosition?: string; tailDirection?: string; placementHint?: string; maxWidthPercent?: number; anchorTarget?: string;
  anchorPoint?: { x: number; y: number };
  bubbleRect?: { x: number; y: number; width: number; height: number };
  layoutConfidence?: number;
}> {
  if (page.speechBubbles && page.speechBubbles.length > 0) {
    return page.speechBubbles.slice(0, 2).map((b) => ({
      speakerName: b.speakerName,
      text: b.text,
      bubbleStyle: b.bubbleStyle ?? "normal",
      preferredPosition: b.preferredPosition,
      tailDirection: b.tailDirection,
      placementHint: b.placementHint,
      maxWidthPercent: b.maxWidthPercent,
      anchorTarget: b.anchorTarget ?? b.anchor,
      anchorPoint: b.anchorPoint,
      bubbleRect: b.bubbleRect,
      layoutConfidence: b.layoutConfidence,
    }));
  }
  if (page.dialogue && page.dialogue.length > 0) {
    return page.dialogue.slice(0, 2).map((d) => ({
      speakerName: d.speaker,
      text: d.text,
      bubbleStyle: d.bubbleStyle ?? "normal",
      placementHint: d.placementHint,
    }));
  }
  return [];
}

function hasPreciseBubbleLayout(page: StoryPage | undefined): boolean {
  return !!page?.speechBubbles?.some((bubble) => bubble.anchorPoint && bubble.bubbleRect);
}

// Convert structured preferredPosition + tailDirection into CSS layout.
// Falls back to deterministic index-based split when structured metadata is absent.
function findSpeakerDirection(page: StoryPage, speakerName?: string): PageCharacterDirection | undefined {
  if (!speakerName) return undefined;
  const first = speakerName.toLowerCase().split(/\s+/)[0];
  return page.characterDirections?.find((c) => {
    const name = c.name.toLowerCase();
    return name === speakerName.toLowerCase() || name.split(/\s+/)[0] === first;
  });
}

function inferComicPlacement(
  page: StoryPage,
  bubble: { speakerName?: string; preferredPosition?: string; tailDirection?: string; placementHint?: string } | undefined,
  index: number,
): { preferredPosition: string; tailDirection: string } {
  if (bubble?.preferredPosition && bubble.tailDirection) {
    return { preferredPosition: bubble.preferredPosition, tailDirection: bubble.tailDirection };
  }

  const speaker = findSpeakerDirection(page, bubble?.speakerName);
  const position = speaker?.position ?? (index % 2 === 0 ? "left" : "right");

  if (position === "right") return { preferredPosition: "top-left", tailDirection: "down-right" };
  if (position === "center" || position === "foreground") {
    return index % 2 === 0
      ? { preferredPosition: "top-left", tailDirection: "down-right" }
      : { preferredPosition: "top-right", tailDirection: "down-left" };
  }
  return { preferredPosition: "top-right", tailDirection: "down-left" };
}

function parsePlacementHint(
  page: StoryPage,
  bubble: { speakerName?: string; preferredPosition?: string; tailDirection?: string; placementHint?: string; maxWidthPercent?: number; bubbleRect?: { x: number; y: number; width: number; height: number } } | undefined,
  index: number,
  _total: number,
): { posStyle: React.CSSProperties; tailUp: boolean; tailOnRight: boolean } {
  if (bubble?.bubbleRect) {
    const rect = bubble.bubbleRect;
    return {
      posStyle: {
        position: "absolute",
        left: `${rect.x}%`,
        top: `${rect.y}%`,
        width: `${rect.width}%`,
        maxWidth: `${rect.width}%`,
        zIndex: 25,
      },
      tailUp: false,
      tailOnRight: false,
    };
  }

  const inferred = inferComicPlacement(page, bubble, index);
  const pos = bubble?.preferredPosition ?? inferred.preferredPosition;
  const tail = bubble?.tailDirection ?? inferred.tailDirection;

  // Vertical axis
  const isTop = pos ? pos.startsWith("top") : false;
  // Horizontal axis: prefer explicit position; fall back to index split
  const isRight = pos ? pos.endsWith("right") : index === 1;

  const maxWidth = Math.min(46, Math.max(32, bubble?.maxWidthPercent ?? 40));
  const posStyle: React.CSSProperties = { position: "absolute", maxWidth: `${maxWidth}%`, zIndex: 25 };
  if (isTop) { posStyle.top = "7%"; } else { posStyle.bottom = "10%"; }
  if (isRight) { posStyle.right = "6%"; } else { posStyle.left = "6%"; }

  // Tail direction — use explicit field if present, otherwise infer
  let tailUp: boolean;
  let tailOnRight: boolean;
  if (tail) {
    tailUp = tail.startsWith("up");
    tailOnRight = tail.endsWith("right");
  } else {
    // Bubble at bottom → character above → tail points up; mirror horizontally
    tailUp = !isTop;
    tailOnRight = isRight;
  }

  return { posStyle, tailUp, tailOnRight };
}

function getPreciseTailPoints(
  bubble: { anchorPoint?: { x: number; y: number }; bubbleRect?: { x: number; y: number; width: number; height: number } },
): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
  if (!bubble.anchorPoint || !bubble.bubbleRect) return null;
  const rect = bubble.bubbleRect;
  const anchor = bubble.anchorPoint;
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  const dx = anchor.x - center.x;
  const dy = anchor.y - center.y;

  let start = { x: center.x, y: center.y };
  if (Math.abs(dx) > Math.abs(dy)) {
    start.x = dx > 0 ? rect.x + rect.width : rect.x;
    start.y = Math.min(rect.y + rect.height - 3, Math.max(rect.y + 3, anchor.y));
  } else {
    start.y = dy > 0 ? rect.y + rect.height : rect.y;
    start.x = Math.min(rect.x + rect.width - 4, Math.max(rect.x + 4, anchor.x));
  }

  return { start, end: anchor };
}

interface BubbleProps {
  speakerName?: string;
  text: string;
  bubbleStyle: BubbleStyle;
  tailUp?: boolean;
  tailOnRight?: boolean;
  hideTail?: boolean;
}

function SpeechBubble({ speakerName, text, bubbleStyle, tailUp = false, tailOnRight = false, hideTail = false }: BubbleProps) {
  const borderColor = bubbleStyle === "whisper" ? "#555" : "#000";
  const fillColor   = bubbleStyle === "surprised" ? "#fff9c4" : bubbleStyle === "whisper" ? "#f0f0f0" : "#fff";

  const boxStyle: React.CSSProperties = (() => {
    switch (bubbleStyle) {
      case "excited":
        return { background: "#fff", border: "3px solid #000", borderRadius: 10, boxShadow: "4px 4px 0 rgba(0,0,0,0.9)" };
      case "whisper":
        return { background: "#f0f0f0", border: "2px dashed #555", borderRadius: 14, boxShadow: "none" };
      case "thinking":
        return { background: "#fff", border: "2.5px dotted #333", borderRadius: 20, boxShadow: "2px 2px 0 rgba(0,0,0,0.5)" };
      case "surprised":
        return { background: "#fff9c4", border: "3px solid #000", borderRadius: 4, boxShadow: "4px 4px 0 rgba(0,0,0,0.9)" };
      default:
        return { background: "#fff", border: "2.5px solid #000", borderRadius: 12, boxShadow: "3px 3px 0 rgba(0,0,0,0.85)" };
    }
  })();

  const speakerColor = bubbleStyle === "surprised" ? "#b45309" : "#7c3aed";

  // Shared horizontal position for both outer+inner tail triangles
  const tailLeft  = tailOnRight ? undefined : 16;
  const tailRight = tailOnRight ? 16 : undefined;
  const innerLeft  = tailOnRight ? undefined : 17;
  const innerRight = tailOnRight ? 17 : undefined;

  return (
    <div className="relative flex flex-col" style={{ display: "inline-flex", flexDirection: "column" }}>
      {/* Upward tail sits ABOVE the box — rendered before so it's visually behind */}
      {!hideTail && tailUp && bubbleStyle !== "thinking" && (
        <>
          <div className="absolute w-0 h-0" style={{ top: -10, left: tailLeft, right: tailRight, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderBottom: `11px solid ${borderColor}` }} />
          <div className="absolute w-0 h-0" style={{ top: -7, left: innerLeft, right: innerRight, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderBottom: `9px solid ${fillColor}` }} />
        </>
      )}
      {!hideTail && tailUp && bubbleStyle === "thinking" && (
        <div className="absolute flex gap-0.5" style={{ top: -14, left: tailLeft, right: tailRight }}>
          {[3, 4, 6].map((size, idx) => (
            <div key={idx} className="rounded-full bg-white border-[2px] border-black" style={{ width: size, height: size }} />
          ))}
        </div>
      )}

      <div style={{ padding: "6px 10px", ...boxStyle }}>
        {speakerName && (
          <p className="font-[family-name:var(--font-comic)] text-[10px] leading-none mb-1 truncate"
            style={{ color: speakerColor, textTransform: bubbleStyle === "excited" ? "uppercase" : "none" }}>
            {speakerName}
          </p>
        )}
        <p className="font-[family-name:var(--font-comic)] text-black leading-tight break-words"
          style={{ fontSize: bubbleStyle === "whisper" ? 10 : 12, fontStyle: bubbleStyle === "whisper" ? "italic" : "normal" }}>
          {text}
        </p>
      </div>

      {/* Downward tail */}
      {!hideTail && !tailUp && bubbleStyle !== "thinking" && (
        <>
          <div className="absolute w-0 h-0" style={{ bottom: -10, left: tailLeft, right: tailRight, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: `11px solid ${borderColor}` }} />
          <div className="absolute w-0 h-0" style={{ bottom: -7, left: innerLeft, right: innerRight, borderLeft: "5px solid transparent", borderRight: "5px solid transparent", borderTop: `9px solid ${fillColor}` }} />
        </>
      )}
      {!hideTail && !tailUp && bubbleStyle === "thinking" && (
        <div className="absolute flex gap-0.5" style={{ bottom: -14, left: tailLeft, right: tailRight }}>
          {[6, 4, 3].map((size, idx) => (
            <div key={idx} className="rounded-full bg-white border-[2px] border-black" style={{ width: size, height: size }} />
          ))}
        </div>
      )}
    </div>
  );
}

interface StoryVisualState {
  costume: string | null;
  companion: string | null;
  weapon: string | null;
  powers: string[];
  inventory: string[];
  transformation: string | null;
}

interface Story {
  id: string;
  title: string | null;
  status: string;
  theme: string;
  pages: StoryPage[];
  coverImageUrl: string | null;
  errorMessage: string | null;
  cliffhanger: string | null;
  storyVisualState: StoryVisualState | null;
  videoUrl: string | null;
  videoStatus: "not_started" | "generating" | "completed" | "failed" | "null" | null;
  hero: { name: string; age: number; gender: string; avatarUrl: string | null };
}

interface Recap {
  cliffhanger: string | null;
  memoriesEarned: Array<{ id: string; type: string; title: string; detail: string | null }>;
  powersEarned:   Array<{ id: string; name: string; emoji: string | null }>;
  questsOpened:   Array<{ id: string; title: string }>;
}

const MEMORY_EMOJI: Record<string, string> = {
  character_met: "🤝", villain_defeated: "⚔️", power_earned: "⚡",
  item_found: "💎", location_discovered: "🗺️", quest_opened: "📜",
  quest_completed: "✅", achievement_unlocked: "🏆",
};

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";

const TERMINAL = new Set(["completed", "failed"]);
const POLL_MS = 3000;

const STATUS_LABEL: Record<string, string> = {
  pending:            "Getting things ready…",
  "generating-story": "Writing your story with AI ✍️",
  "generating-images":"Creating illustrations 🎨",
  "generating-audio": "Adding narration 🎙️",
  "generating-pdf":   "Preparing your book 📖",
  completed:          "Your story is ready!",
  failed:             "Something went wrong",
};

// ── Story Reader ─────────────────────────────────────────────────────────────

export default function StoryReaderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [story, setStory]         = useState<Story | null>(null);
  const [error, setError]         = useState("");
  const [page, setPage]           = useState(0);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [copied, setCopied]       = useState(false);
  const [recap, setRecap]         = useState<Recap | null>(null);
  const [showRecap, setShowRecap] = useState(false);
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [recapChecked, setRecapChecked] = useState(false);
  const [videoStatus, setVideoStatus]           = useState<string | null>(null);
  const [videoUrl, setVideoUrl]                 = useState<string | null>(null);
  const videoPollerRef                          = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const pollRef        = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const recapFetchedRef = useRef(false);
  const autoPlayedRef  = useRef(false);
  const readAlongRef   = useRef(false);   // true while in read-along mode
  const autoAdvanceRef = useRef(false);   // true immediately after page auto-increments
  const pagesLenRef    = useRef(0);       // kept current to avoid stale closures
  const audioRef       = useRef<HTMLAudioElement | null>(null);
  const { flags } = usePublicPlatformSettings();

  function handleShare() {
    const shareUrl = `${window.location.origin}/stories/${id}/share`;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleDelete() {
    const token = getAccessToken();
    if (!token) return;
    await fetch(`${BASE}/stories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    router.push("/dashboard");
  }

  const fetchStory = useCallback(async () => {
    const token = getAccessToken();
    if (!token) { router.push("/login"); return; }

    const res = await fetch(`${BASE}/stories/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      if (res.status === 401) { router.push("/login"); return; }
      setError("Story not found.");
      return;
    }

    const { data } = await res.json();
    setStory(data);
    setVideoStatus(data.videoStatus ?? null);
    setVideoUrl(data.videoUrl ?? null);

    if (TERMINAL.has(data.status)) {
      clearInterval(pollRef.current);
      // Fetch recap once when story first completes
      if (data.status === "completed" && !recapFetchedRef.current) {
        recapFetchedRef.current = true;
        const token2 = getAccessToken();
        if (token2) {
          fetch(`${BASE}/stories/${id}/recap`, { headers: { Authorization: `Bearer ${token2}` } })
            .then(async (r) => {
              if (!r.ok) { setRecapChecked(true); return; }
              const { data: recapData } = await r.json();
              const hasAnything = recapData.memoriesEarned?.length > 0 ||
                recapData.powersEarned?.length > 0 ||
                recapData.questsOpened?.length > 0 ||
                recapData.cliffhanger;
              if (hasAnything) {
                setRecap(recapData as Recap);
                setShowRecap(true);
              }
              setRecapChecked(true);
            })
            .catch(() => { setRecapChecked(true); });
        } else {
          setRecapChecked(true);
        }
      }
    }
  }, [id, router]);

  useEffect(() => {
    void fetchStory();
    pollRef.current = setInterval(fetchStory, POLL_MS);
    return () => {
      clearInterval(pollRef.current);
      clearInterval(videoPollerRef.current);
    };
  }, [fetchStory]);

  // Keep a ref to pages length so handleAudioEnded never has a stale closure
  useEffect(() => {
    pagesLenRef.current = story?.pages.length ?? 0;
  }, [story?.pages.length]);

  // When a page ends, either stop or advance to the next page in read-along mode
  const handleAudioEnded = useCallback(() => {
    setAudioPlaying(false);
    if (!readAlongRef.current) return;
    setPage(prev => {
      const next = prev + 1;
      if (next >= pagesLenRef.current) {
        readAlongRef.current = false;
        return prev;
      }
      autoAdvanceRef.current = true;
      return next;
    });
  }, []);

  // After auto-advancing to a new page, play its audio
  useEffect(() => {
    if (!autoAdvanceRef.current) return;
    autoAdvanceRef.current = false;
    const pg = story?.pages[page];
    if (!pg) return;
    const t = setTimeout(() => {
      if (pg.audioUrl && audioRef.current) {
        audioRef.current.play().catch(() => {
          setAudioPlaying(false);
          readAlongRef.current = false;
        });
        setAudioPlaying(true);
      } else if (pg.text && typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(pg.text);
        utter.rate = 0.88; utter.pitch = 1.05;
        utter.onend = handleAudioEnded;
        window.speechSynthesis.speak(utter);
        setAudioPlaying(true);
      } else {
        readAlongRef.current = false;
      }
    }, 200);
    return () => clearTimeout(t);
  }, [page, story?.pages, handleAudioEnded]);

  // Auto-play page 1 and start read-along when the reader first becomes visible.
  // Wait for recapChecked so we don't start playing right before the recap
  // screen mounts and tears the <audio> element out of the DOM (AbortError).
  useEffect(() => {
    if (story?.status !== "completed" || !recapChecked || showRecap || autoPlayedRef.current) return;
    autoPlayedRef.current = true;
    readAlongRef.current  = true;
    const firstPage = story.pages[0];
    if (!firstPage) return;
    if (firstPage.audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => { setAudioPlaying(false); readAlongRef.current = false; });
      setAudioPlaying(true);
    } else if (firstPage.text && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(firstPage.text);
      utter.rate = 0.88; utter.pitch = 1.05;
      utter.onend = handleAudioEnded;
      window.speechSynthesis.speak(utter);
      setAudioPlaying(true);
    }
  }, [story?.status, story?.pages, recapChecked, showRecap, handleAudioEnded]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (error) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center">
        <div className="text-center">
          <p className="text-4xl mb-4">😢</p>
          <p className="text-ink font-semibold">{error}</p>
          <a href="/dashboard" className="text-brand underline mt-4 block">Back to dashboard</a>
        </div>
      </div>
    );
  }

  if (!story || !TERMINAL.has(story.status)) {
    const label = story ? (STATUS_LABEL[story.status] ?? "Generating…") : "Loading…";
    const heroName = story?.hero?.name ?? "your hero";

    const STEPS = [
      { key: "generating-story",  icon: "✍️", label: "Writing the episode",         detail: "AI is crafting your universe's next chapter" },
      { key: "generating-images", icon: "🎨", label: "Generating illustrations",     detail: "Creating comic panels with AI art" },
      { key: "generating-audio",  icon: "🎙️", label: "Recording narration",          detail: "Adding voice narration to each page" },
      { key: "generating-pdf",    icon: "📖", label: "Building the storybook",       detail: "Assembling your print-ready book" },
    ];
    const STATUS_ORDER = ["pending","generating-story","generating-images","generating-audio","generating-pdf","completed"];
    const currIdx = STATUS_ORDER.indexOf(story?.status ?? "pending");

    return (
      <div className="min-h-screen bg-space-gradient flex flex-col items-center justify-center px-6 relative overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-brand/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-sm flex flex-col items-center gap-8">
          {/* Pulsing universe orb */}
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-brand/20 border border-brand/30 flex items-center justify-center animate-pulse">
              <div className="w-16 h-16 rounded-full bg-brand/30 border border-brand/40 flex items-center justify-center">
                <span className="text-4xl">🌌</span>
              </div>
            </div>
            <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gold flex items-center justify-center animate-spin" style={{ animationDuration: "3s" }}>
              <span className="text-xs">✨</span>
            </div>
          </div>

          <div className="text-center">
            <h1 className="font-[family-name:var(--font-display)] text-white text-2xl mb-2">{label}</h1>
            <p className="text-white/50 text-sm">
              Building a new episode for <strong className="text-gold">{heroName}</strong>&apos;s universe
            </p>
          </div>

          {/* Steps */}
          {story && (
            <div className="flex flex-col gap-2.5 w-full">
              {STEPS.map((step) => {
                const stepIdx = STATUS_ORDER.indexOf(step.key);
                const done    = currIdx > stepIdx;
                const active  = currIdx === stepIdx;
                return (
                  <div key={step.key} className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-500 ${
                    done   ? "bg-brand/20 border-brand/30" :
                    active ? "bg-white/10 border-white/20" :
                             "bg-white/3 border-white/8 opacity-40"
                  }`}>
                    <span className="text-lg w-7 text-center">{done ? "✅" : step.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-semibold ${done ? "text-brand-light" : active ? "text-white" : "text-white/40"}`}>
                        {step.label}
                      </p>
                      {active && (
                        <p className="text-white/40 text-xs mt-0.5 truncate">{step.detail}</p>
                      )}
                    </div>
                    {active && <span className="w-2.5 h-2.5 rounded-full bg-gold animate-ping flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}

          <p className="text-white/30 text-xs text-center">
            Illustrations generate in parallel — usually ready in under a minute ✨
          </p>

          <div className="text-center">
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 text-sm transition"
            >
              ← Back to Dashboard
            </a>
            <p className="text-white/20 text-xs mt-1">
              Generation continues in the background · check progress on your dashboard
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (story.status === "failed") {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-4">😔</p>
          <h1 className="font-[family-name:var(--font-display)] text-ink text-2xl mb-2">Story generation failed</h1>
          <p className="text-ink-muted text-sm mb-6">{story.errorMessage ?? "An unexpected error occurred."}</p>
          <a href="/create" className="bg-brand text-white font-bold px-6 py-3 rounded-full inline-block hover:bg-brand-dark transition">
            Try Again
          </a>
        </div>
      </div>
    );
  }

  // ── Episode Recap ──────────────────────────────────────────────────────────

  if (showRecap && recap) {
    return (
      <div className="min-h-screen bg-space-gradient flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-3 animate-bounce">🎉</div>
            <p className="text-gold text-xs font-bold tracking-widest uppercase mb-2">Episode Complete</p>
            <h1 className="font-[family-name:var(--font-display)] text-white text-3xl mb-1">
              {story.title ?? "Episode Complete!"}
            </h1>
            <p className="text-white/50 text-sm">Here&apos;s what happened in {story.hero?.name}&apos;s universe</p>
          </div>

          <div className="flex flex-col gap-4 mb-8">
            {/* Powers earned */}
            {recap.powersEarned.length > 0 && (
              <div className="bg-white/8 border border-gold/20 rounded-2xl p-5">
                <p className="text-gold text-xs font-bold uppercase tracking-wide mb-3">⚡ Powers Earned</p>
                <div className="flex flex-wrap gap-2">
                  {recap.powersEarned.map((p) => (
                    <span key={p.id} className="bg-gold/20 text-white text-sm font-semibold px-3 py-1.5 rounded-full flex items-center gap-1.5">
                      {p.emoji ?? "✨"} {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quests opened */}
            {recap.questsOpened.length > 0 && (
              <div className="bg-white/8 border border-orange-400/20 rounded-2xl p-5">
                <p className="text-orange-300 text-xs font-bold uppercase tracking-wide mb-3">📜 New Quests Opened</p>
                <ul className="space-y-2">
                  {recap.questsOpened.map((q) => (
                    <li key={q.id} className="text-white/80 text-sm flex items-start gap-2">
                      <span className="text-orange-300 mt-0.5">◆</span> {q.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Memories */}
            {recap.memoriesEarned.length > 0 && (
              <div className="bg-white/8 border border-white/10 rounded-2xl p-5">
                <p className="text-white/50 text-xs font-bold uppercase tracking-wide mb-3">🌟 Universe Updated</p>
                <ul className="space-y-2">
                  {recap.memoriesEarned.map((m) => (
                    <li key={m.id} className="text-white/70 text-sm flex items-start gap-2">
                      <span>{MEMORY_EMOJI[m.type] ?? "✦"}</span> {m.title}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cliffhanger */}
            {recap.cliffhanger && (
              <div className="bg-brand/20 border border-brand/30 rounded-2xl p-5">
                <p className="text-brand-light text-xs font-bold uppercase tracking-wide mb-2">📖 To be continued…</p>
                <p className="text-white/80 text-sm italic leading-relaxed">&ldquo;{recap.cliffhanger}&rdquo;</p>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <button type="button" onClick={() => setShowRecap(false)}
              className="w-full bg-brand hover:bg-brand-dark text-white font-[family-name:var(--font-display)] text-lg py-4 rounded-full transition hover:scale-105 shadow-brand">
              Read the Episode →
            </button>
            <div className="flex gap-3">
              <a href="/universe"
                className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-3 rounded-full transition">
                View Universe
              </a>
              <a href="/create"
                className="flex-1 text-center bg-white/10 hover:bg-white/20 text-white text-sm font-semibold py-3 rounded-full transition">
                Next Episode
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Manual page navigation — always cancels read-along mode
  function goToPage(idx: number) {
    readAlongRef.current   = false;
    autoAdvanceRef.current = false;
    audioRef.current?.pause();
    if (audioRef.current) audioRef.current.currentTime = 0;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setAudioPlaying(false);
    setPage(idx);
  }

  function toggleAudio() {
    if (audioPlaying) {
      readAlongRef.current   = false;
      autoAdvanceRef.current = false;
      audioRef.current?.pause();
      if (audioRef.current) audioRef.current.currentTime = 0;
      window.speechSynthesis?.cancel();
      setAudioPlaying(false);
      return;
    }

    readAlongRef.current = true; // enable read-along: audio will auto-advance pages

    if (currentPage?.audioUrl && audioRef.current) {
      audioRef.current.play().catch(() => { setAudioPlaying(false); readAlongRef.current = false; });
      setAudioPlaying(true);
    } else if (currentPage?.text && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(currentPage.finalNarrationText ?? currentPage.narrationText ?? currentPage.text);
      utter.rate  = 0.88;
      utter.pitch = 1.05;
      utter.onend = handleAudioEnded;
      window.speechSynthesis.speak(utter);
      setAudioPlaying(true);
    }
  }

  async function handleGenerateVideo() {
    const token = getAccessToken();
    if (!token) return;
    setVideoStatus("generating");
    await fetch(`${BASE}/stories/${id}/generate-video`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    // Poll until done
    clearInterval(videoPollerRef.current);
    videoPollerRef.current = setInterval(async () => {
      const r = await fetch(`${BASE}/stories/${id}/video-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) return;
      const { data } = await r.json();
      const status = data.videoStatus as Story["videoStatus"];
      const url    = data.videoUrl as string | null;
      setVideoStatus(status);
      setVideoUrl(url);
      if (status === "completed" || status === "failed") {
        clearInterval(videoPollerRef.current);
      }
    }, 5000);
  }

  function handlePrintPdf() {
    window.print();
  }

// ── Story reader ───────────────────────────────────────────────────────────

  const totalPages = story.pages.length;
  const currentPage = story.pages[page];

  const isLastPage = page === totalPages - 1;

  return (
    <div className="min-h-screen bg-space-gradient flex flex-col">
      {/* Print-only layout: all pages stacked for PDF */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-story, #print-story * { visibility: visible; }
          #print-story { position: fixed; inset: 0; background: white; overflow: auto; padding: 24px; }
          .no-print { display: none !important; }
        }
      `}</style>

      {/* Hidden print view — all pages stacked */}
      <div id="print-story" className="hidden print:block">
        <h1 style={{ fontFamily: "serif", fontSize: 28, marginBottom: 8, textAlign: "center" }}>
          {story.title ?? "My Story"}
        </h1>
        <p style={{ textAlign: "center", color: "#666", fontSize: 13, marginBottom: 32 }}>
          A story starring {story.hero?.name}
        </p>
        {story.pages.map((pg) => {
          const bubbles = getSpeechBubbles(pg);
          return (
            <div key={pg.pageNumber} style={{ pageBreakInside: "avoid", marginBottom: 48 }}>
              {/* Image + speech bubbles container */}
              <div style={{ position: "relative", display: "inline-block", width: "100%" }}>
                {pg.imageUrl && (
                  <img src={pg.imageUrl} alt={`Page ${pg.pageNumber}`}
                    style={{ width: "100%", maxHeight: 340, objectFit: "contain", borderRadius: 12, display: "block" }} />
                )}
                {/* Speech bubbles overlay for print */}
                {bubbles.length > 0 && (
                  <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                    {bubbles.map((bubble, i) => {
                      const { posStyle, tailUp, tailOnRight } = parsePlacementHint(pg, bubble, i, bubbles.length);
                      const preciseTail = getPreciseTailPoints(bubble);
                      return (
                        <div key={i}>
                          {preciseTail && (
                            <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible", zIndex: 24 }}>
                              <line
                                x1={`${preciseTail.start.x}%`}
                                y1={`${preciseTail.start.y}%`}
                                x2={`${preciseTail.end.x}%`}
                                y2={`${preciseTail.end.y}%`}
                                stroke="#000"
                                strokeWidth="3"
                                strokeLinecap="round"
                              />
                              <line
                                x1={`${preciseTail.start.x}%`}
                                y1={`${preciseTail.start.y}%`}
                                x2={`${preciseTail.end.x}%`}
                                y2={`${preciseTail.end.y}%`}
                                stroke="#fff"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                              />
                            </svg>
                          )}
                          <div style={posStyle}>
                            <SpeechBubble
                              speakerName={bubble.speakerName}
                              text={bubble.text}
                              bubbleStyle={bubble.bubbleStyle}
                              tailUp={tailUp}
                              tailOnRight={tailOnRight}
                              hideTail={!!preciseTail}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: "#1a1a2e", marginTop: 14 }}>{pg.text}</p>
              <p style={{ color: "#888", fontSize: 11, marginTop: 6 }}>— Page {pg.pageNumber} —</p>
            </div>
          );
        })}
      </div>

      {/* Top bar */}
      <header className="no-print flex items-center justify-between px-6 py-4 bg-space/80 backdrop-blur border-b border-white/10">
        <a href="/dashboard" className="text-white/60 hover:text-white text-sm transition">← My Stories</a>
        <h1 className="font-[family-name:var(--font-display)] text-white text-lg text-center line-clamp-1 max-w-[180px]">
          {story.title ?? "My Story"}
        </h1>
        <div className="flex items-center gap-2">
          <span className="text-white/40 text-sm font-medium">{page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-gold hover:text-space text-white px-3 py-1.5 rounded-full transition-all"
            title="Copy share link"
          >
            <Share2 className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Share"}
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-full transition-all"
            title="Save as PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          {flags.ENABLE_MERCHANDISE !== false && (
            <a
              href={`/dashboard/merchandise/create?source=story&storyId=${story.id}`}
              className="flex items-center gap-1.5 text-xs font-semibold bg-brand/90 hover:bg-brand text-white px-3 py-1.5 rounded-full transition-all"
              title="Create merchandise from this story"
            >
              <Package className="w-3.5 h-3.5" />
              Merch
            </a>
          )}
          {flags.ENABLE_VIDEO_EXPORT !== false && (
            videoUrl ? (
              <a
                href={videoUrl}
                download
                className="flex items-center gap-1.5 text-xs font-semibold bg-gold/90 hover:bg-gold text-space px-3 py-1.5 rounded-full transition-all"
                title="Download MP4"
              >
                <Clapperboard className="w-3.5 h-3.5" />
                MP4
              </a>
            ) : videoStatus === "generating" ? (
              <span className="flex items-center gap-1.5 text-xs font-semibold bg-white/10 text-white/60 px-3 py-1.5 rounded-full">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Video…
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void handleGenerateVideo()}
                disabled={videoStatus === "generating"}
                className="flex items-center gap-1.5 text-xs font-semibold bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded-full transition-all"
                title="Generate story video"
              >
                <Clapperboard className="w-3.5 h-3.5" />
                {videoStatus === "failed" ? "Retry Video" : "Video"}
              </button>
            )
          )}
          {confirmDelete ? (
            <div className="flex items-center gap-2 bg-red-900/60 rounded-full px-3 py-1">
              <span className="text-red-200 text-xs">Delete?</span>
              <button type="button" onClick={handleDelete} className="text-red-300 hover:text-white text-xs font-bold">Yes</button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-white/50 hover:text-white text-xs">No</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="text-white/30 hover:text-red-400 transition p-1 rounded-lg hover:bg-white/10"
              title="Delete story"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      {/* Story Visual State — costume/companion/weapon locked for this story */}
      {story.storyVisualState && (
        <div className="no-print bg-space/60 border-b border-white/8 px-4 py-2">
          <div className="max-w-lg mx-auto flex items-center gap-3 overflow-x-auto scrollbar-none">
            {story.storyVisualState.costume && (
              <span className="flex items-center gap-1.5 text-xs text-white/60 whitespace-nowrap">
                <span className="text-base">🦸</span> {story.storyVisualState.costume}
              </span>
            )}
            {story.storyVisualState.companion && (
              <>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1.5 text-xs text-white/60 whitespace-nowrap">
                  <span className="text-base">🐾</span> {story.storyVisualState.companion}
                </span>
              </>
            )}
            {story.storyVisualState.weapon && (
              <>
                <span className="text-white/20">·</span>
                <span className="flex items-center gap-1.5 text-xs text-white/60 whitespace-nowrap">
                  <span className="text-base">⚔️</span> {story.storyVisualState.weapon}
                </span>
              </>
            )}
            {story.storyVisualState.powers.map((p) => (
              <span key={p} className="flex items-center gap-1 text-xs text-brand-light/70 whitespace-nowrap">
                <span className="text-white/20 ml-1">·</span>
                <span className="text-base">⚡</span> {p}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 gap-6 max-w-lg mx-auto w-full">

        {/* Story card */}
        <div className="w-full bg-white rounded-3xl shadow-[0_8px_40px_rgba(0,0,0,0.4)] overflow-hidden">

          {/* Panel image */}
          <div className="relative w-full overflow-hidden" style={{ aspectRatio: "376/499" }}>
            {currentPage?.backgroundUrl ? (
              /* Background-only mode: AI scene + hero avatar composited on top */
              <>
                <div className="absolute inset-0 scale-110"
                  style={{ backgroundImage: `url(${currentPage.backgroundUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(14px) brightness(0.5)" }} />
                <img
                  src={currentPage.backgroundUrl}
                  alt={`Page ${page + 1} background`}
                  className="absolute inset-0 w-full h-full object-cover z-10"
                />
                {/* Hero avatar overlay — positioned lower-center, natural size */}
                {story.hero?.avatarUrl && (
                  <img
                    src={story.hero.avatarUrl}
                    alt={story.hero.name ?? "Hero"}
                    className="absolute z-20 object-contain drop-shadow-2xl"
                    style={{ bottom: "0%", left: "50%", transform: "translateX(-50%)", height: "72%", width: "auto", maxWidth: "60%" }}
                  />
                )}
              </>
            ) : currentPage?.imageUrl ? (
              <>
                {/* Blurred background fill */}
                <div className="absolute inset-0 scale-110"
                  style={{ backgroundImage: `url(${currentPage.imageUrl})`, backgroundSize: "cover", backgroundPosition: "center", filter: "blur(14px) brightness(0.5)" }} />
                <img
                  src={currentPage.imageUrl}
                  alt={`Page ${page + 1}`}
                  className="absolute inset-0 w-full h-full object-contain z-10 transition-all duration-500"
                  style={hasPreciseBubbleLayout(currentPage) ? {} : getCropStyle(currentPage.cropHint)}
                />
              </>
            ) : (
              /* Stylised placeholder — themed gradient, no sample story content */
              <div className="absolute inset-0 bg-gradient-to-br from-space via-brand/40 to-space flex flex-col items-center justify-center gap-4">
                <span className="text-7xl opacity-60">🌌</span>
                <p className="text-white/40 text-sm font-semibold tracking-wide uppercase">Illustration</p>
              </div>
            )}
            {/* Page badge */}
            <div className="absolute top-3 left-3 z-20 bg-gold text-space font-[family-name:var(--font-comic)] text-xs font-bold px-3 py-1 rounded-full shadow">
              PAGE {page + 1}
            </div>
            {/* Hero name badge */}
            <div className="absolute top-3 right-3 z-20 bg-black/40 backdrop-blur text-white text-xs font-semibold px-3 py-1 rounded-full">
              {story.hero?.name}
            </div>
            {/* Audio element — keyed by URL so React remounts cleanly on page change */}
            {currentPage?.audioUrl && (
              <audio
                key={currentPage.audioUrl}
                ref={audioRef}
                src={currentPage.audioUrl}
                onEnded={handleAudioEnded}
                preload="metadata"
              />
            )}

            {/* Comic speech bubbles — each positioned near the speaker's mouth */}
            {currentPage && (() => {
              const bubbles = getSpeechBubbles(currentPage);
              if (bubbles.length === 0) return null;
              return (
                <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 20 }}>
                  {bubbles.map((bubble, i) => {
                    const { posStyle, tailUp, tailOnRight } = parsePlacementHint(currentPage, bubble, i, bubbles.length);
                    const preciseTail = getPreciseTailPoints(bubble);
                    return (
                      <div key={i}>
                        {preciseTail && (
                          <svg className="absolute inset-0 w-full h-full overflow-visible" style={{ zIndex: 24 }}>
                            <line
                              x1={`${preciseTail.start.x}%`}
                              y1={`${preciseTail.start.y}%`}
                              x2={`${preciseTail.end.x}%`}
                              y2={`${preciseTail.end.y}%`}
                              stroke="#000"
                              strokeWidth="3"
                              strokeLinecap="round"
                            />
                            <line
                              x1={`${preciseTail.start.x}%`}
                              y1={`${preciseTail.start.y}%`}
                              x2={`${preciseTail.end.x}%`}
                              y2={`${preciseTail.end.y}%`}
                              stroke="#fff"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        )}
                        <div style={posStyle}>
                          <SpeechBubble
                            speakerName={bubble.speakerName}
                            text={bubble.text}
                            bubbleStyle={bubble.bubbleStyle}
                            tailUp={tailUp}
                            tailOnRight={tailOnRight}
                            hideTail={!!preciseTail}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}

            {/* Narration button — always shown; uses audioUrl when available, browser TTS otherwise */}
            <button
              type="button"
              onClick={toggleAudio}
              className="absolute bottom-3 right-3 z-20 w-10 h-10 rounded-full bg-black/50 backdrop-blur hover:bg-brand/80 text-white flex items-center justify-center transition-all shadow-lg"
              title={audioPlaying ? "Pause narration" : "Listen to this page"}
            >
              {audioPlaying ? (
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current"><polygon points="5,3 19,12 5,21"/></svg>
              )}
            </button>
          </div>

          {/* Story text */}
          <div className="px-7 py-6">
            <p className="font-[family-name:var(--font-body)] text-ink text-xl leading-relaxed text-center">
              {currentPage?.text}
            </p>

            {/* Per-page state snapshot — items/powers earned/active */}
            {currentPage?.storyStateSnapshot && (
              (() => {
                const snap = currentPage.storyStateSnapshot;
                const hasItems = (snap.items?.length ?? 0) > 0;
                const hasPowers = (snap.powers?.length ?? 0) > 0;
                const hasCompanions = (snap.companions?.length ?? 0) > 0;
                if (!hasItems && !hasPowers && !hasCompanions) return null;
                return (
                  <div className="mt-4 pt-3 border-t border-ink/8 flex flex-wrap gap-2 justify-center">
                    {snap.companions?.map((c) => (
                      <span key={c} className="flex items-center gap-1 text-[11px] text-ink-muted bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                        <span>🐾</span> {c}
                      </span>
                    ))}
                    {snap.items?.map((item) => (
                      <span key={item} className="flex items-center gap-1 text-[11px] text-ink-muted bg-sky-50 border border-sky-200 px-2 py-0.5 rounded-full">
                        <span>💎</span> {item}
                      </span>
                    ))}
                    {snap.powers?.map((p) => (
                      <span key={p} className="flex items-center gap-1 text-[11px] text-brand/80 bg-violet-50 border border-violet-200 px-2 py-0.5 rounded-full">
                        <span>⚡</span> {p}
                      </span>
                    ))}
                  </div>
                );
              })()
            )}

            {isLastPage && (
              <p className="font-[family-name:var(--font-display)] text-brand text-2xl text-center mt-4">
                ✨ The End ✨
              </p>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-6 w-full justify-center">
          <button
            type="button"
            onClick={() => goToPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white text-2xl flex items-center justify-center transition"
          >
            ‹
          </button>

          {/* Dots */}
          <div className="flex gap-2 flex-wrap justify-center">
            {story.pages.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => goToPage(i)}
                className={`rounded-full transition-all ${i === page ? "w-5 h-2.5 bg-gold" : "w-2.5 h-2.5 bg-white/25 hover:bg-white/50"}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => goToPage(Math.min(totalPages - 1, page + 1))}
            disabled={page === totalPages - 1}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white text-2xl flex items-center justify-center transition"
          >
            ›
          </button>
        </div>

        {/* Back to dashboard on last page */}
        {isLastPage && (
          <a href="/dashboard"
            className="bg-brand hover:bg-brand-dark text-white font-[family-name:var(--font-display)] text-lg px-8 py-3 rounded-full transition hover:scale-105 shadow-brand">
            📚 Back to My Stories
          </a>
        )}
      </main>
    </div>
  );
}
