"use client";

import { useId, useSyncExternalStore } from "react";

/**
 * Header "My Universe" icon: a slowly turning spiral galaxy with a tiny rocket circling it on a tilted orbit.
 * Still when the viewer prefers reduced motion.
 */
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// Rocket orbit: an ellipse around the galaxy (tilted by the group it sits in).
const ORBIT = "M1,24 a23,10 0 1,0 46,0 a23,10 0 1,0 -46,0";

export default function UniverseGalaxyIcon({ size = 54, fast = false }: { size?: number; fast?: boolean }) {
  const id = useId().replace(/:/g, "");
  const still = useSyncExternalStore(subscribe, () => window.matchMedia(reducedMotionQuery).matches, () => true);

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <radialGradient id={`${id}-core`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FFFBEB" />
          <stop offset="0.45" stopColor="#FCD34D" />
          <stop offset="1" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-arm`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F9A8D4" />
          <stop offset="1" stopColor="#A78BFA" />
        </linearGradient>
        <radialGradient id={`${id}-disc`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#F0ABFC" stopOpacity="0.75" />
          <stop offset="0.55" stopColor="#8B5CF6" stopOpacity="0.35" />
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* a few stars around */}
      <circle cx="6" cy="9" r="0.9" fill="#fff" opacity="0.8" />
      <circle cx="43" cy="38" r="0.8" fill="#fff" opacity="0.7" />
      <circle cx="41" cy="8" r="0.7" fill="#FDE68A" opacity="0.9" />
      <circle cx="8" cy="40" r="0.7" fill="#FDE68A" opacity="0.8" />

      {/* spiral galaxy — slowly turning */}
      <g
        className={still ? "" : "uni-anim animate-[spin_14s_linear_infinite]"}
        style={{ transformBox: "view-box", transformOrigin: "24px 24px" }}
      >
        {/* scaled up to fill the icon; the rocket orbits just outside it */}
        <g transform="translate(24 24) scale(1.3) translate(-24 -19.5)">
          <ellipse cx="24" cy="19.5" rx="15" ry="11" fill={`url(#${id}-disc)`} />
          <path d="M24 19.5 C 24 13.5, 33 12.5, 35 18.5 C 37 24.5, 30 29.5, 24 28.5 C 20 27.8, 18.5 26, 18 24.5" fill="none" stroke={`url(#${id}-arm)`} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M24 19.5 C 24 25.5, 15 26.5, 13 20.5 C 11 14.5, 18 9.5, 24 10.5 C 28 11.2, 29.5 13, 30 14.5" fill="none" stroke={`url(#${id}-arm)`} strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="32" cy="13" r="0.8" fill="#fff" />
          <circle cx="15.5" cy="25.5" r="0.8" fill="#fff" />
          <circle cx="35.5" cy="22" r="0.6" fill="#FDE68A" />
          <circle cx="12.5" cy="16.5" r="0.6" fill="#FDE68A" />
          <circle cx="27.5" cy="27.8" r="0.55" fill="#fff" />
          <circle cx="20" cy="11.4" r="0.55" fill="#fff" />
          <circle cx="24" cy="19.5" r="5.5" fill={`url(#${id}-core)`} />
        </g>
      </g>

      {/* tiny rocket circling the galaxy */}
      <g transform="rotate(-20 24 24)">
        <g transform={still ? "translate(47 24) rotate(-90)" : undefined}>
          <path d="M-3.5 -1 L-7.5 0 L-3.5 1 Z" fill="#F97316" />
          <path d="M-3.5 -1.7 L-5.2 -3.4 L-1.8 -1.7 Z M-3.5 1.7 L-5.2 3.4 L-1.8 1.7 Z" fill="#EF4444" />
          <path d="M-3.5 -1.7 H1.2 Q4 -1.7 5.2 0 Q4 1.7 1.2 1.7 H-3.5 Z" fill="#FFFFFF" />
          <circle cx="1.2" cy="0" r="0.75" fill="#38BDF8" />
          {!still && <animateMotion dur={fast ? "1.6s" : "4.5s"} repeatCount="indefinite" rotate="auto" path={ORBIT} />}
        </g>
      </g>
    </svg>
  );
}
