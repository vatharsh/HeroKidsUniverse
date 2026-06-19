"use client";

import { Check, CreditCard } from "lucide-react";
import { useState } from "react";

import Navbar from "@/components/layout/Navbar";
import { cn } from "@/lib/utils";

type Step = 0 | 1 | 2;
type HeroGender = "boy" | "girl" | "other" | "";

const steps = ["Your Hero", "Adventure", "Generate"];

const themes = [
  { emoji: "🚀", name: "Space Adventure", gradient: "from-indigo-950 to-purple-900" },
  { emoji: "⚡", name: "Superhero Mission", gradient: "from-red-950 to-orange-900" },
  { emoji: "🌿", name: "Jungle Quest", gradient: "from-green-950 to-emerald-800" },
  { emoji: "🌊", name: "Underwater Adventure", gradient: "from-blue-950 to-cyan-900" },
  { emoji: "🔍", name: "Detective Mystery", gradient: "from-gray-900 to-slate-800" },
  { emoji: "🎂", name: "Birthday Adventure", gradient: "from-pink-950 to-rose-900" },
];

const genderOptions: { label: string; value: HeroGender }[] = [
  { label: "Boy", value: "boy" },
  { label: "Girl", value: "girl" },
  { label: "Non-binary", value: "other" },
];

export default function CreatePage() {
  const [currentStep, setCurrentStep] = useState<Step>(0);
  const [heroName, setHeroName] = useState("");
  const [heroAge, setHeroAge] = useState("");
  const [heroGender, setHeroGender] = useState<HeroGender>("");
  const [selectedTheme, setSelectedTheme] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const selectedThemeData = themes.find((theme) => theme.name === selectedTheme);

  const goToStep = (step: Step) => setCurrentStep(step);

  return (
    <div className="min-h-screen bg-cream">
      <Navbar />
      <main className="max-w-lg mx-auto px-6 pt-28 pb-16">
        <div className="flex items-start justify-center gap-0 mb-12">
          {steps.map((step, index) => (
            <div key={step} className="flex items-start">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold",
                    index < currentStep && "bg-brand text-white",
                    index === currentStep && "bg-brand text-white ring-4 ring-brand/20",
                    index > currentStep && "bg-ink/10 text-ink-muted",
                  )}
                >
                  {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span className="text-xs text-ink-muted mt-1 hidden sm:block">{step}</span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    "flex-1 h-0.5 bg-ink/10 mx-1 max-w-[60px] w-[60px] mt-4",
                    index < currentStep && "bg-brand",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {currentStep === 0 && (
          <section>
            <h2 className="font-[family-name:var(--font-display)] font-black text-ink text-3xl mb-2">
              Who is the hero?
            </h2>
            <p className="text-ink-muted mb-8">
              Tell us about your child so we can make them the star.
            </p>

            <div className="flex flex-col items-center mb-8">
              <input
                type="file"
                accept="image/*"
                id="photo-upload"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    setPhotoPreview(URL.createObjectURL(file));
                  }
                }}
              />
              <label
                htmlFor="photo-upload"
                className="w-32 h-32 rounded-full overflow-hidden cursor-pointer border-2 border-dashed border-brand/40 hover:border-brand bg-brand-50 transition flex flex-col items-center justify-center"
              >
                {photoPreview ? (
                  <img src={photoPreview} alt="Uploaded hero preview" className="w-full h-full object-cover" />
                ) : (
                  <>
                    <span className="text-4xl">📸</span>
                    <span className="text-brand text-xs font-medium mt-1">Upload Photo</span>
                  </>
                )}
              </label>
              <p className="text-ink-muted text-xs text-center mt-3 max-w-[200px]">
                Helps us create a character that looks like your child (optional)
              </p>
            </div>

            <div className="flex flex-col gap-5">
              <div>
                <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="hero-name">
                  Hero Name
                </label>
                <input
                  id="hero-name"
                  type="text"
                  value={heroName}
                  onChange={(event) => setHeroName(event.target.value)}
                  placeholder="What's your child's name?"
                  className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                />
              </div>

              <div>
                <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="hero-age">
                  Age
                </label>
                <select
                  id="hero-age"
                  value={heroAge}
                  onChange={(event) => setHeroAge(event.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
                >
                  <option value="" disabled>
                    Select age
                  </option>
                  {Array.from({ length: 9 }, (_, index) => index + 4).map((age) => (
                    <option key={age} value={age}>
                      {age}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="text-ink-mid text-sm font-medium block mb-1.5">They are a...</p>
                <div className="flex gap-3">
                  {genderOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={cn(
                        "flex-1 py-2.5 rounded-xl border text-sm font-semibold transition cursor-pointer",
                        heroGender === option.value
                          ? "border-brand bg-brand text-white"
                          : "border-ink/15 bg-cream text-ink-mid hover:border-brand/40",
                      )}
                      onClick={() => setHeroGender(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              type="button"
              disabled={!heroName.trim()}
              className="w-full mt-4 bg-brand disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all hover:scale-[1.02] shadow-brand"
              onClick={() => goToStep(1)}
            >
              Choose Adventure →
            </button>
          </section>
        )}

        {currentStep === 1 && (
          <section>
            <h2 className="font-[family-name:var(--font-display)] font-black text-ink text-3xl mb-2">
              Choose their adventure
            </h2>
            <p className="text-ink-muted mb-8">What world will your hero explore?</p>

            <div className="grid grid-cols-2 gap-4">
              {themes.map((theme) => (
                <button
                  key={theme.name}
                  type="button"
                  className={cn(
                    "group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-gold/50 text-left",
                    selectedTheme === theme.name && "ring-2 ring-brand scale-105",
                  )}
                  onClick={() => setSelectedTheme(theme.name)}
                >
                  <div
                    className={`aspect-[1/1] flex flex-col justify-between p-6 bg-gradient-to-br ${theme.gradient}`}
                  >
                    <span className="text-5xl leading-none">{theme.emoji}</span>
                    <div>
                      <h3 className="text-white font-[family-name:var(--font-display)] font-bold text-xl">
                        {theme.name}
                      </h3>
                      <p className="text-white/0 group-hover:text-gold/80 transition-all text-sm">
                        Explore →
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-4 mt-8">
              <button
                type="button"
                className="text-ink-muted hover:text-ink px-6 py-3 rounded-full"
                onClick={() => goToStep(0)}
              >
                ← Back
              </button>
              <button
                type="button"
                disabled={!selectedTheme}
                className="flex-1 bg-brand disabled:bg-ink/20 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all hover:scale-[1.02] shadow-brand"
                onClick={() => goToStep(2)}
              >
                Review Story →
              </button>
            </div>
          </section>
        )}

        {currentStep === 2 && (
          <section>
            <h2 className="font-[family-name:var(--font-display)] font-black text-ink text-3xl mb-2">
              Ready to create magic?
            </h2>
            <p className="text-ink-muted mb-8">Here&apos;s what we&apos;ll create for {heroName}.</p>

            <div className="bg-brand-50 border border-brand/20 rounded-2xl p-6 text-center mb-8">
              {photoPreview ? (
                <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-4">
                  <img src={photoPreview} alt="Uploaded hero preview" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 rounded-full bg-brand/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🦸</span>
                </div>
              )}
              <h3 className="font-[family-name:var(--font-display)] font-black text-ink text-xl">
                {heroName}
              </h3>
              <p className="text-ink-muted text-sm mt-1">
                Age {heroAge} · {heroGender}
              </p>
              {selectedThemeData && (
                <span className="inline-block mt-3 bg-brand text-white text-sm font-semibold px-4 py-1 rounded-full">
                  {selectedThemeData.emoji} {selectedThemeData.name}
                </span>
              )}
              <div className="flex items-center justify-center gap-1.5 mt-4 text-ink-muted text-sm">
                <CreditCard className="w-4 h-4" />
                <span>1 credit will be used</span>
              </div>
            </div>

            <button
              type="button"
              className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-4 rounded-full text-lg shadow-brand transition-all hover:scale-[1.02]"
            >
              ✨ Generate My Story
            </button>
            <p className="text-ink-muted text-xs text-center mt-4">
              Story generation takes 2–4 minutes.
            </p>
            <button
              type="button"
              className="text-ink-muted text-sm text-center block mt-4 hover:text-ink mx-auto"
              onClick={() => goToStep(1)}
            >
              ← Go Back
            </button>
          </section>
        )}
      </main>
    </div>
  );
}
