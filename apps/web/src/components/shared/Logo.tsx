interface LogoMarkProps {
  size?: number;
}

export function LogoMark({ size = 40 }: LogoMarkProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      {/* Deep space background */}
      <rect width="40" height="40" rx="11" fill="#3B1A8A" />

      {/* Distant star dots — universe */}
      <circle cx="7"  cy="7"  r="1"   fill="#F59E0B" fillOpacity="0.9" />
      <circle cx="33" cy="6"  r="0.8" fill="white"   fillOpacity="0.55" />
      <circle cx="30" cy="12" r="0.7" fill="#F59E0B" fillOpacity="0.6" />
      <circle cx="5"  cy="16" r="0.7" fill="white"   fillOpacity="0.4" />
      <circle cx="35" cy="19" r="0.8" fill="white"   fillOpacity="0.35" />

      {/* Open storybook — "Story" element ────────────────────────────── */}
      {/* Left page (slightly dimmer — verso) */}
      <path
        d="M5 35 L5 23 Q12.5 19 20 21 L20 36 Q12.5 33 5 35Z"
        fill="white" fillOpacity="0.82"
      />
      {/* Right page (recto) */}
      <path
        d="M35 35 L35 23 Q27.5 19 20 21 L20 36 Q27.5 33 35 35Z"
        fill="white" fillOpacity="0.95"
      />
      {/* Spine */}
      <line x1="20" y1="21" x2="20" y2="36"
        stroke="#3B1A8A" strokeWidth="1.2" strokeOpacity="0.35" />
      {/* Tiny "text lines" on right page */}
      <line x1="23" y1="25.5" x2="32" y2="26" stroke="#3B1A8A" strokeWidth="0.65" strokeOpacity="0.2" />
      <line x1="23" y1="28.5" x2="32" y2="29" stroke="#3B1A8A" strokeWidth="0.65" strokeOpacity="0.2" />

      {/* Superhero kid — "Hero + Kid" element ──────────────────────────*/}
      {/* Cape (gold, renders behind body) */}
      <path
        d="M18 18 Q11 23 13.5 28 Q16.5 24 20 23 Q23.5 24 26.5 28 Q29 23 22 18Z"
        fill="#F59E0B" fillOpacity="0.92"
      />
      {/* Body */}
      <rect x="18.5" y="17" width="3" height="5" rx="1.5"
        fill="white" fillOpacity="0.96" />
      {/* Head */}
      <circle cx="20" cy="13.5" r="3.5" fill="white" fillOpacity="0.97" />
      {/* Eye glint */}
      <circle cx="18.8" cy="13" r="0.7" fill="#3B1A8A" fillOpacity="0.6" />
      <circle cx="21.2" cy="13" r="0.7" fill="#3B1A8A" fillOpacity="0.6" />
      {/* Tiny star on chest */}
      <path
        d="M20 19 L20.3 20 L21.2 20 L20.5 20.5 L20.8 21.4 L20 20.9 L19.2 21.4 L19.5 20.5 L18.8 20 L19.7 20Z"
        fill="#F59E0B" fillOpacity="0.85"
      />

      {/* 4-point sparkle star above head — "Universe / magic" ─────────*/}
      <path
        d="M20 4.5 L20.7 6.5 L22.5 6.5 L21.1 7.7 L21.6 9.5 L20 8.4 L18.4 9.5 L18.9 7.7 L17.5 6.5 L19.3 6.5Z"
        fill="#F59E0B" fillOpacity="0.95"
      />
    </svg>
  );
}

interface LogoProps {
  className?: string;
}

export default function Logo({ className = "" }: LogoProps) {
  return (
    <a href="/" aria-label="HeroVerse Kids home" className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark size={36} />
      <span className="font-[family-name:var(--font-display)] font-black text-2xl leading-none">
        <span className="text-gradient-brand">HeroVerse</span>
        <span className="text-gold ml-1">Kids</span>
      </span>
    </a>
  );
}
