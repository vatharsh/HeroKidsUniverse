"use client";

import { useAuth } from "@/contexts/AuthContext";

function StepIllustration({ step }: { step: number }) {
  if (step === 1) return (
    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden>
      {/* Camera body */}
      <rect x="20" y="40" width="80" height="55" rx="10" fill="#7C3AED" opacity="0.15" />
      <rect x="20" y="40" width="80" height="55" rx="10" fill="none" stroke="#7C3AED" strokeWidth="3" opacity="0.7" />
      {/* Lens */}
      <circle cx="60" cy="67" r="18" fill="#7C3AED" opacity="0.2" />
      <circle cx="60" cy="67" r="18" fill="none" stroke="#7C3AED" strokeWidth="2.5" opacity="0.8" />
      <circle cx="60" cy="67" r="10" fill="#7C3AED" opacity="0.35" />
      {/* Flash */}
      <rect x="70" y="31" width="18" height="12" rx="4" fill="#F59E0B" opacity="0.8" />
      {/* Shutter button */}
      <circle cx="75" cy="43" r="5" fill="#F59E0B" opacity="0.6" />
      {/* Sparkle — magic transformation */}
      <text x="85" y="35" fontSize="18" fill="#F59E0B" opacity="0.9">✦</text>
      <text x="14" y="38" fontSize="12" fill="#7C3AED" opacity="0.7">✦</text>
      {/* Small avatar silhouette peeking from lens */}
      <circle cx="60" cy="62" r="5" fill="#7C3AED" opacity="0.6" />
      <path d="M52 72 Q60 68 68 72" fill="#7C3AED" opacity="0.5" />
    </svg>
  );

  if (step === 2) return (
    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden>
      {/* Open book */}
      <path d="M60 35 L20 42 L20 90 L60 83Z" fill="#7C3AED" opacity="0.2" />
      <path d="M60 35 L100 42 L100 90 L60 83Z" fill="#7C3AED" opacity="0.15" />
      <path d="M60 35 L20 42 L20 90 L60 83Z" fill="none" stroke="#7C3AED" strokeWidth="2.5" opacity="0.8" />
      <path d="M60 35 L100 42 L100 90 L60 83Z" fill="none" stroke="#7C3AED" strokeWidth="2.5" opacity="0.8" />
      {/* Spine */}
      <line x1="60" y1="35" x2="60" y2="83" stroke="#7C3AED" strokeWidth="3" opacity="0.9" />
      {/* Lines on pages */}
      {[50, 58, 66, 74].map((y, i) => (
        <line key={i} x1="28" y1={y} x2="55" y2={y - 2} stroke="#7C3AED" strokeWidth="1.5" opacity="0.3" />
      ))}
      {[50, 58, 66, 74].map((y, i) => (
        <line key={i} x1="65" y1={y} x2="92" y2={y + 2} stroke="#7C3AED" strokeWidth="1.5" opacity="0.3" />
      ))}
      {/* Sparkles */}
      <text x="95" y="32" fontSize="16" fill="#F59E0B" opacity="0.9">✨</text>
      <text x="10" y="45" fontSize="12" fill="#F59E0B" opacity="0.6">⭐</text>
      <text x="55" y="28" fontSize="14" fill="#F59E0B" opacity="0.7">✦</text>
    </svg>
  );

  return (
    <svg viewBox="0 0 120 120" className="w-full h-full" aria-hidden>
      {/* Galaxy / growing universe */}
      <circle cx="60" cy="60" r="30" fill="#7C3AED" opacity="0.1" />
      <circle cx="60" cy="60" r="20" fill="#7C3AED" opacity="0.15" />
      <circle cx="60" cy="60" r="8"  fill="#7C3AED" opacity="0.6" />
      {/* Orbiting dots */}
      <circle cx="90" cy="60" r="4" fill="#F59E0B" opacity="0.8" />
      <circle cx="30" cy="60" r="3" fill="#A78BFA" opacity="0.8" />
      <circle cx="60" cy="30" r="3.5" fill="#34D399" opacity="0.8" />
      <circle cx="60" cy="90" r="3" fill="#F59E0B" opacity="0.7" />
      <circle cx="81" cy="39" r="2.5" fill="#A78BFA" opacity="0.7" />
      <circle cx="39" cy="81" r="2.5" fill="#34D399" opacity="0.7" />
      {/* Orbit ring */}
      <ellipse cx="60" cy="60" rx="30" ry="10" fill="none" stroke="#7C3AED" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
      <ellipse cx="60" cy="60" rx="10" ry="30" fill="none" stroke="#A78BFA" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.4" />
      {/* Growth arrows */}
      <text x="96" y="24" fontSize="20" fill="#F59E0B" opacity="0.9">↗</text>
      <text x="8"  y="28" fontSize="14" fill="#7C3AED" opacity="0.6">✦</text>
    </svg>
  );
}

const steps = [
  {
    badge: "1",
    step: 1,
    title: "Upload a photo or choose an avatar",
    body: "Take a photo of your child, or pick from our illustrated avatar gallery. Our AI transforms it into a unique storybook hero — your child, reimagined.",
    highlight: "Your child becomes the hero",
    color: "from-brand/10 to-brand/5",
    borderColor: "border-brand/20",
  },
  {
    badge: "2",
    step: 2,
    title: "Create your first adventure",
    body: "Choose a world — Space, Jungle, Ocean, Superhero City and more. Add family members, friends, even pets. Give a hint or let the AI surprise you.",
    highlight: "6 worlds · Unlimited adventures",
    color: "from-gold/10 to-gold/5",
    borderColor: "border-gold/20",
  },
  {
    badge: "3",
    step: 3,
    title: "Watch your universe grow forever",
    body: "Every story earns new powers, unlocks quests, and adds to a living timeline. The universe remembers every adventure — and the best is always ahead.",
    highlight: "Powers, quests & memories persist",
    color: "from-emerald-500/10 to-emerald-500/5",
    borderColor: "border-emerald-400/20",
  },
];

export default function HowItWorks() {
  const { user } = useAuth();

  return (
    <section id="how-it-works" className="py-24 bg-cream relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-brand/4 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-brand text-xs font-bold tracking-[0.2em] uppercase mb-3">HOW IT WORKS</p>
          <h2 className="font-[family-name:var(--font-display)] text-ink text-4xl md:text-5xl mb-4">
            Three steps to a living universe
          </h2>
          <p className="text-ink-mid text-lg max-w-xl mx-auto">
            Built once — grows forever. Each episode connects to the last and builds toward the next.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-[4.5rem] left-[calc(16.66%+3rem)] right-[calc(16.66%+3rem)] h-0.5 bg-gradient-to-r from-brand/40 via-gold/40 to-emerald-400/40 z-0" />

          {steps.map((step, i) => (
            <div
              key={step.badge}
              className={`relative bg-gradient-to-br ${step.color} border ${step.borderColor} rounded-3xl p-8 text-center z-10 flex flex-col items-center backdrop-blur-sm`}
            >
              {/* Step badge */}
              <div className="w-10 h-10 rounded-full bg-brand text-white text-sm font-bold flex items-center justify-center mb-4 shadow-brand z-10">
                {step.badge}
              </div>

              {/* Illustration */}
              <div className="w-24 h-24 mb-5 relative">
                <StepIllustration step={step.step} />
              </div>

              <h3 className="font-[family-name:var(--font-display)] text-ink text-xl mb-3 leading-snug">
                {step.title}
              </h3>
              <p className="text-ink-mid text-sm leading-relaxed mb-4">{step.body}</p>

              {/* Highlight pill */}
              <span className="mt-auto text-xs font-bold text-ink-muted bg-ink/5 border border-ink/10 px-3 py-1.5 rounded-full">
                {step.highlight}
              </span>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a
            href={user ? "/create" : "/register"}
            className="inline-block bg-brand hover:bg-brand-dark text-white font-[family-name:var(--font-display)] text-xl px-10 py-4 rounded-full shadow-brand transition-all hover:scale-105 active:scale-95"
          >
            {user ? "Continue Your Universe →" : "Start Your Universe →"}
          </a>
          <p className="text-ink-muted text-xs mt-3">3 free story credits · No credit card required</p>
        </div>
      </div>
    </section>
  );
}
