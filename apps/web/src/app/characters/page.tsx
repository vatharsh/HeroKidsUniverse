"use client";

import { useState } from "react";
import { X, Upload, Check } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { cn } from "@/lib/utils";

type Relationship =
  | "father" | "mother" | "brother" | "sister"
  | "grandpa" | "grandma" | "friend" | "pet";

interface SupportingCharacter {
  id: Relationship;
  label: string;
  emoji: string;
  name?: string;
  description?: string;
  photoPreview?: string;
}

const SLOTS: SupportingCharacter[] = [
  { id: "father",  label: "Father",       emoji: "👨" },
  { id: "mother",  label: "Mother",       emoji: "👩" },
  { id: "brother", label: "Brother",      emoji: "👦" },
  { id: "sister",  label: "Sister",       emoji: "👧" },
  { id: "grandpa", label: "Grandpa",      emoji: "👴" },
  { id: "grandma", label: "Grandma",      emoji: "👵" },
  { id: "friend",  label: "Best Friend",  emoji: "🤝" },
  { id: "pet",     label: "Pet",          emoji: "🐾" },
];

interface AddCharacterModalProps {
  slot: SupportingCharacter;
  onSave: (slot: SupportingCharacter) => void;
  onClose: () => void;
}

function AddCharacterModal({ slot, onSave, onClose }: AddCharacterModalProps) {
  const [name, setName] = useState(slot.name ?? "");
  const [description, setDescription] = useState(slot.description ?? "");
  const [photoPreview, setPhotoPreview] = useState<string | undefined>(slot.photoPreview);
  const [consented, setConsented] = useState(false);

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 relative max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 text-ink-muted hover:text-ink transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-center mb-6">
          <span className="text-5xl">{slot.emoji}</span>
          <h3 className="font-[family-name:var(--font-display)] font-black text-ink text-2xl mt-3">
            Add {slot.label}
          </h3>
          <p className="text-ink-muted text-sm mt-1">
            This character can appear in your child&apos;s stories
          </p>
        </div>

        {/* Photo upload */}
        <div className="flex flex-col items-center mb-6">
          <input type="file" accept="image/*" id="char-photo" className="hidden" onChange={handlePhoto} />
          <label
            htmlFor="char-photo"
            className="w-24 h-24 rounded-full overflow-hidden cursor-pointer border-2 border-dashed border-brand/40 hover:border-brand bg-brand-50 transition flex flex-col items-center justify-center"
          >
            {photoPreview ? (
              <img src={photoPreview} alt="Character" className="w-full h-full object-cover" />
            ) : (
              <>
                <Upload className="w-5 h-5 text-brand" />
                <span className="text-brand text-xs font-medium mt-1">Photo</span>
              </>
            )}
          </label>
          <p className="text-ink-muted text-xs text-center mt-2">Optional</p>
        </div>

        {/* Consent — only when photo uploaded */}
        {photoPreview && (
          <label className="flex items-start gap-3 mb-5 cursor-pointer bg-brand-50 rounded-xl p-3">
            <input
              type="checkbox"
              checked={consented}
              onChange={(e) => setConsented(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-brand flex-shrink-0"
            />
            <span className="text-ink-mid text-xs leading-relaxed">
              I consent to this photo being processed to create an illustrated avatar.
              The original photo will <strong>not</strong> be stored.
            </span>
          </label>
        )}

        <div className="flex flex-col gap-4">
          <div>
            <label className="text-ink-mid text-sm font-medium block mb-1.5">
              {slot.label === "Pet" ? "Pet's name" : `${slot.label}'s name`}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={slot.label === "Pet" ? "e.g. Bruno, Whiskers" : `e.g. ${slot.label === "Father" ? "Raj" : slot.label === "Mother" ? "Priya" : "Arjun"}`}
              className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            />
          </div>

          <div>
            <label className="text-ink-mid text-sm font-medium block mb-1.5">
              Describe them <span className="text-ink-muted font-normal">(helps the AI)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={
                slot.label === "Pet"
                  ? "e.g. A golden retriever, always happy and energetic"
                  : "e.g. Tall, kind smile, loves cricket and telling jokes"
              }
              rows={3}
              className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition resize-none text-sm"
            />
          </div>

          <button
            type="button"
            disabled={!name.trim() || (!!photoPreview && !consented)}
            onClick={() => onSave({ ...slot, name, description, photoPreview })}
            className="w-full bg-brand disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all enabled:hover:scale-[1.02] shadow-brand"
          >
            Save {slot.label}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CharactersPage() {
  const [characters, setCharacters] = useState<Record<Relationship, SupportingCharacter>>({} as Record<Relationship, SupportingCharacter>);
  const [editingSlot, setEditingSlot] = useState<SupportingCharacter | null>(null);

  function handleSave(updated: SupportingCharacter) {
    setCharacters((prev) => ({ ...prev, [updated.id]: updated }));
    setEditingSlot(null);
  }

  function handleRemove(id: Relationship) {
    setCharacters((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const filledCount = Object.keys(characters).length;

  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <Navbar />

      {/* Header */}
      <header className="bg-space-gradient py-20 text-center">
        <div className="max-w-2xl mx-auto px-6">
          <p className="text-gold text-xs font-bold tracking-widest uppercase mb-3">YOUR CAST</p>
          <h1 className="font-[family-name:var(--font-display)] font-black text-white text-4xl md:text-5xl mb-3">
            Build Your Story Cast
          </h1>
          <p className="text-white/60 text-lg">
            Add the people and pets your child loves — they&apos;ll appear as characters in every adventure.
          </p>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto px-6 py-12 w-full">

        {/* Main hero card */}
        <div className="mb-10">
          <h2 className="font-[family-name:var(--font-display)] font-bold text-ink text-xl mb-4 flex items-center gap-2">
            <span className="text-2xl">🌟</span> Main Hero
          </h2>
          <div className="bg-white rounded-2xl shadow-card p-6 flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand to-brand-dark flex items-center justify-center text-3xl flex-shrink-0">
              🦸
            </div>
            <div className="flex-1">
              <p className="font-[family-name:var(--font-display)] font-bold text-ink text-lg">
                Your Child
              </p>
              <p className="text-ink-muted text-sm">The star of every story</p>
            </div>
            <a
              href="/create"
              className="text-brand text-sm font-semibold hover:underline flex-shrink-0"
            >
              Edit Hero →
            </a>
          </div>
        </div>

        {/* Supporting characters */}
        <div className="mb-8 flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="font-[family-name:var(--font-display)] font-bold text-ink text-xl flex items-center gap-2">
              <span className="text-2xl">👥</span> Supporting Cast
            </h2>
            <p className="text-ink-muted text-sm mt-1">
              {filledCount} of {SLOTS.length} characters added — choose who joins each story
            </p>
          </div>
          {filledCount > 0 && (
            <span className="bg-brand-50 text-brand text-xs font-semibold px-3 py-1.5 rounded-full">
              {filledCount} characters ready
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {SLOTS.map((slot) => {
            const filled = characters[slot.id];
            return (
              <div key={slot.id} className="relative group">
                {filled ? (
                  /* Filled card */
                  <div className="bg-white rounded-2xl shadow-card p-5 flex flex-col items-center text-center h-full">
                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => handleRemove(slot.id)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-ink/80 hover:bg-error rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10"
                    >
                      <X className="w-3.5 h-3.5 text-white" />
                    </button>

                    {/* Avatar */}
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-brand-50 flex items-center justify-center mb-3 flex-shrink-0">
                      {filled.photoPreview ? (
                        <img src={filled.photoPreview} alt={filled.name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-3xl">{slot.emoji}</span>
                      )}
                    </div>

                    <div className="absolute top-3 right-3 w-5 h-5 bg-brand rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-white" />
                    </div>

                    <p className="font-[family-name:var(--font-display)] font-bold text-ink text-sm leading-tight">
                      {filled.name}
                    </p>
                    <p className="text-ink-muted text-xs mt-0.5">{slot.label}</p>

                    <button
                      type="button"
                      onClick={() => setEditingSlot({ ...slot, ...filled })}
                      className="mt-3 text-brand text-xs font-semibold hover:underline"
                    >
                      Edit
                    </button>
                  </div>
                ) : (
                  /* Empty slot */
                  <button
                    type="button"
                    onClick={() => setEditingSlot(slot)}
                    className="w-full h-full bg-white border-2 border-dashed border-ink/15 hover:border-brand rounded-2xl p-5 flex flex-col items-center text-center gap-3 transition-all group-hover:shadow-card"
                  >
                    <div className="w-16 h-16 rounded-full bg-ink/5 group-hover:bg-brand-50 flex items-center justify-center text-3xl transition-colors">
                      {slot.emoji}
                    </div>
                    <div>
                      <p className="text-ink-mid text-sm font-semibold">{slot.label}</p>
                      <p className="text-brand text-xs font-medium mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        + Add
                      </p>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* CTA */}
        {filledCount > 0 && (
          <div className="mt-12 bg-brand-gradient rounded-2xl p-8 text-center text-white">
            <p className="font-[family-name:var(--font-display)] font-bold text-xl mb-2">
              Your cast is ready! ✨
            </p>
            <p className="text-white/70 text-sm mb-6">
              Create a story and choose which characters join the adventure.
            </p>
            <a
              href="/create"
              className="bg-white text-brand hover:bg-gold hover:text-white font-bold px-8 py-3 rounded-full transition-all hover:scale-105 inline-block"
            >
              Create a Story →
            </a>
          </div>
        )}
      </main>

      <Footer />

      {/* Modal */}
      {editingSlot && (
        <AddCharacterModal
          slot={editingSlot}
          onSave={handleSave}
          onClose={() => setEditingSlot(null)}
        />
      )}
    </div>
  );
}
