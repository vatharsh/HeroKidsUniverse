"use client";

import { useId, useSyncExternalStore } from "react";

/**
 * "Comic Bubble Galaxy": a comic speech bubble (storytelling) holding a slowly turning spiral galaxy, with a
 * tiny rocket flying through it. Bold silhouette so it reads at header size; still when the viewer prefers
 * reduced motion.
 */
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// Rounded bubble with a tail at the bottom-left.
const BUBBLE = "M15 3 H33 A12 12 0 0 1 45 15 V24 A12 12 0 0 1 33 36 H20 L9.5 45 L12.5 36 H15 A12 12 0 0 1 3 24 V15 A12 12 0 0 1 15 3 Z";
// The rocket enters at the lower left, arcs over the galaxy and leaves at the right (clipped by the bubble).
const FLIGHT = "M-2 33 Q 20 2 52 17";

export default function UniverseBubbleIcon({ size = 42, fast = false }: { size?: number; fast?: boolean }) {
  const id = useId().replace(/:/g, "");
  const still = useSyncExternalStore(subscribe, () => window.matchMedia(reducedMotionQuery).matches, () => true);

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <radialGradient id={`${id}-space`} cx="0.5" cy="0.42" r="0.7">
          <stop offset="0" stopColor="#4C1D95" />
          <stop offset="1" stopColor="#160733" />
        </radialGradient>
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
        <clipPath id={`${id}-inside`}>
          <path d={BUBBLE} />
        </clipPath>
      </defs>

      {/* bubble */}
      <path d={BUBBLE} fill={`url(#${id}-space)`} />

      <g clipPath={`url(#${id}-inside)`}>
        {/* background stars */}
        <circle cx="9" cy="11" r="0.9" fill="#fff" opacity="0.8" />
        <circle cx="39" cy="29" r="0.8" fill="#fff" opacity="0.7" />
        <circle cx="36" cy="8" r="0.7" fill="#FDE68A" opacity="0.9" />

        {/* spiral galaxy — slowly turning */}
        <g
          className={still ? "" : "uni-anim animate-[spin_14s_linear_infinite]"}
          style={{ transformBox: "view-box", transformOrigin: "24px 19.5px" }}
        >
          {/* soft glowing disc, so the swirl reads as a galaxy rather than a letter */}
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

        {/* tiny rocket flying through */}
        <g transform={still ? "translate(26 13) rotate(-25)" : undefined}>
          <g>
            <path d="M-3.5 -1 L-7.5 0 L-3.5 1 Z" fill="#F97316" />
            <path d="M-3.5 -1.7 L-5.2 -3.4 L-1.8 -1.7 Z M-3.5 1.7 L-5.2 3.4 L-1.8 1.7 Z" fill="#EF4444" />
            <path d="M-3.5 -1.7 H1.2 Q4 -1.7 5.2 0 Q4 1.7 1.2 1.7 H-3.5 Z" fill="#FFFFFF" />
            <circle cx="1.2" cy="0" r="0.75" fill="#38BDF8" />
            {!still && <animateMotion dur={fast ? "1.4s" : "3.6s"} repeatCount="indefinite" rotate="auto" path={FLIGHT} />}
          </g>
        </g>
      </g>

      {/* bubble outline on top */}
      <path d={BUBBLE} fill="none" stroke="#FCD34D" strokeWidth="2.2" strokeLinejoin="round" />
    </svg>
  );
}
