"use client";

import { useId, useSyncExternalStore } from "react";

/**
 * A bold ringed planet — the shape reads as "universe" even at header size. The ring's back half sits behind
 * the planet and its front half in front, a moon rides along the ring and a star twinkles. No motion when the
 * viewer prefers reduced motion.
 */
const reducedMotionQuery = "(prefers-reduced-motion: reduce)";
function subscribe(onChange: () => void) {
  const media = window.matchMedia(reducedMotionQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export default function UniversePlanetIcon({ size = 40, fast = false }: { size?: number; fast?: boolean }) {
  const id = useId().replace(/:/g, "");
  const still = useSyncExternalStore(subscribe, () => window.matchMedia(reducedMotionQuery).matches, () => true);
  // Ring = an ellipse centred on the planet, tilted -20°; the moon travels along it.
  const ringPath = "M2,24 a22,7.5 0 1,0 44,0 a22,7.5 0 1,0 -44,0";

  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden className="shrink-0 overflow-visible">
      <defs>
        <radialGradient id={`${id}-planet`} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stopColor="#FFF3C4" />
          <stop offset="0.25" stopColor="#F8B84E" />
          <stop offset="0.6" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#3B1782" />
        </radialGradient>
        <clipPath id={`${id}-front`}>
          <rect x="0" y="24" width="48" height="24" />
        </clipPath>
        <filter id={`${id}-glow`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* back half of the ring */}
      <g transform="rotate(-20 24 24)">
        <ellipse cx="24" cy="24" rx="22" ry="7.5" fill="none" stroke="#FCD34D" strokeWidth="3" opacity="0.45" />
      </g>

      {/* planet with a soft highlight and two bands */}
      <circle cx="24" cy="24" r="13" fill={`url(#${id}-planet)`} filter={`url(#${id}-glow)`} />
      <path d="M12.5 21.5 Q24 18 35.5 21.5" fill="none" stroke="#FDE68A" strokeOpacity="0.35" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M13 28 Q24 31.5 35 28" fill="none" stroke="#2E1065" strokeOpacity="0.35" strokeWidth="1.6" strokeLinecap="round" />
      <ellipse cx="19.5" cy="17.5" rx="3.6" ry="2.2" fill="#fff" opacity="0.45" transform="rotate(-25 19.5 17.5)" />

      {/* front half of the ring + the moon riding it */}
      <g transform="rotate(-20 24 24)">
        <ellipse cx="24" cy="24" rx="22" ry="7.5" fill="none" stroke="#FDE68A" strokeWidth="3.2" clipPath={`url(#${id}-front)`} />
        <circle r="3" fill="#67E8F9" stroke="#E0F7FF" strokeWidth="0.8" cx={still ? 46 : 0} cy={still ? 24 : 0}>
          {!still && <animateMotion dur={fast ? "1.8s" : "5s"} repeatCount="indefinite" path={ringPath} />}
        </circle>
      </g>

      {/* twinkling star */}
      <path
        d="M40 2.5 L41.3 6.7 L45.5 8 L41.3 9.3 L40 13.5 L38.7 9.3 L34.5 8 L38.7 6.7 Z"
        fill="#FEF3C7"
        className={still ? "" : "uni-anim animate-[uniTwinkle_2.4s_ease-in-out_infinite]"}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
    </svg>
  );
}
