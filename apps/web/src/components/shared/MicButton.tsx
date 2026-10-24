"use client";

import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * "Speak instead of typing" for text boxes. Uses the browser's built-in speech recognition (Chrome,
 * Safari/iOS) — free, no audio reaches our servers (the browser's own speech service turns it into
 * text). Hidden where the browser can't do it. Spoken text is added to the end of what's there.
 */

type Lang = "en-IN" | "hi-IN";
const LANG_KEY = "hk_mic_lang";

interface RecognitionResult { isFinal: boolean; 0: { transcript: string } }
interface RecognitionEvent { resultIndex: number; results: ArrayLike<RecognitionResult> }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export default function MicButton({
  value, onChange, maxLength, compact = false,
}: {
  value: string; onChange: (v: string) => void; maxLength?: number; compact?: boolean;
}) {
  // false on the server and in browsers without speech recognition
  const supported = useSyncExternalStore(() => () => {}, () => !!recognitionCtor(), () => false);
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem(LANG_KEY) as Lang) || "en-IN"; } catch { return "en-IN"; }
  });
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState("");
  const recRef = useRef<Recognition | null>(null);
  const valueRef = useRef(value);
  useEffect(() => { valueRef.current = value; }, [value]);
  useEffect(() => () => recRef.current?.stop(), []);

  if (!supported) return null;

  function append(text: string) {
    const piece = text.trim();
    if (!piece) return;
    const current = valueRef.current;
    let next = current.trim() ? `${current.trimEnd()} ${piece}` : piece;
    if (maxLength) next = next.slice(0, maxLength);
    valueRef.current = next;
    onChange(next);
  }

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError("");
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let live = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) append(r[0].transcript);
        else live += r[0].transcript;
      }
      setInterim(live);
    };
    rec.onerror = (e) => {
      setError(e.error === "not-allowed" || e.error === "service-not-allowed"
        ? "Allow microphone access to speak."
        : e.error === "no-speech" ? "Didn't catch that — try again." : "");
    };
    rec.onend = () => { setListening(false); setInterim(""); recRef.current = null; };
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  function stop() { recRef.current?.stop(); }

  function switchLang(next: Lang) {
    setLang(next);
    try { localStorage.setItem(LANG_KEY, next); } catch { /* fine */ }
    if (listening) stop();
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={listening ? stop : start}
          aria-label={listening ? "Stop listening" : "Speak instead of typing"}
          className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition ${compact ? "text-xs px-3 py-1.5" : "text-sm px-4 py-2"} ${
            listening ? "bg-red-500 text-white shadow-[0_0_0_4px_rgba(239,68,68,0.25)] animate-pulse" : "bg-brand-50 text-brand border border-brand/25 hover:bg-brand hover:text-white"
          }`}
        >
          {listening ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-4 h-4" />}
          {listening ? "Stop" : compact ? "Speak" : "Speak instead"}
        </button>
        <div className="inline-flex rounded-full border border-ink/15 overflow-hidden text-[11px] font-bold" role="group" aria-label="Speaking language">
          {(["en-IN", "hi-IN"] as Lang[]).map((l) => (
            <button key={l} type="button" onClick={() => switchLang(l)}
              className={`px-2 py-1 transition ${lang === l ? "bg-ink text-white" : "bg-white text-ink-muted hover:text-ink"}`}>
              {l === "en-IN" ? "EN" : "हिं"}
            </button>
          ))}
        </div>
      </div>
      {listening && <p className="text-xs text-red-500">🎙️ Listening… {interim && <span className="text-ink-muted italic">“{interim}”</span>}</p>}
      {error && <p className="text-xs text-amber-600">{error}</p>}
    </div>
  );
}
