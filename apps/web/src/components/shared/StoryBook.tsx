"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* ── Reusable comic elements ──────────────────────────────────────── */

/** Classic oval speech bubble with a pointed tail */
function SpeechBubble({
  text,
  x, y, w = 100, h = 36,
  tailX = 50, tailY = 36, tailTipX = 40, tailTipY = 52,
  fontSize = 10,
}: {
  text: string; x: number; y: number; w?: number; h?: number;
  tailX?: number; tailY?: number; tailTipX?: number; tailTipY?: number;
  fontSize?: number;
}) {
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Bubble outline */}
      <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2}
        fill="white" stroke="#111" strokeWidth="2" />
      {/* Tail */}
      <polygon
        points={`${tailX - 7},${tailY} ${tailX + 4},${tailY} ${tailTipX},${tailTipY}`}
        fill="white" stroke="#111" strokeWidth="2" strokeLinejoin="round"
        style={{ paintOrder: "stroke" }}
      />
      {/* Text — wrapping handled by tspan */}
      <text
        x={w / 2} y={h / 2 + fontSize * 0.35}
        textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif"
        fontSize={fontSize}
        fontWeight="bold"
        fill="#111"
        style={{ textTransform: "uppercase" }}
      >
        {text.split("\n").map((line, i, arr) => (
          <tspan
            key={i}
            x={w / 2}
            dy={i === 0 ? -(arr.length - 1) * fontSize * 0.6 : fontSize * 1.2}
          >
            {line}
          </tspan>
        ))}
      </text>
    </g>
  );
}

/** Starburst explosion background + action word */
function ActionWord({
  text, x, y, r = 28, color = "#FFE236", textColor = "#111", rotate = -8, fontSize = 13,
}: {
  text: string; x: number; y: number; r?: number; color?: string;
  textColor?: string; rotate?: number; fontSize?: number;
}) {
  // Build star-burst polygon (12 spikes)
  const spikes = 12;
  const pts: string[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (Math.PI / spikes) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.72;
    pts.push(`${x + Math.cos(angle) * rad},${y + Math.sin(angle) * rad}`);
  }
  return (
    <g transform={`rotate(${rotate},${x},${y})`}>
      <polygon points={pts.join(" ")} fill={color} stroke="#111" strokeWidth="1.5" />
      <text
        x={x} y={y + fontSize * 0.38}
        textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif"
        fontSize={fontSize}
        fontWeight="bold"
        fill={textColor}
        style={{ WebkitTextStroke: "0.5px #111" } as React.CSSProperties}
      >
        {text}
      </text>
    </g>
  );
}

/** Yellow narrative caption box */
function Caption({ text, x, y, w, h = 18 }: { text: string; x: number; y: number; w: number; h?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#FFE236" stroke="#111" strokeWidth="1.5" />
      <text
        x={x + w / 2} y={y + h * 0.68}
        textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif"
        fontSize="8.5"
        fill="#111"
        fontWeight="bold"
        style={{ textTransform: "uppercase" }}
      >
        {text}
      </text>
    </g>
  );
}

/* ── Character helpers ────────────────────────────────────────────── */

/** Arjun — bold kid-hero silhouette */
function Arjun({ x, y, scale = 1, flip = false }: { x: number; y: number; scale?: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x},${y}) scale(${flip ? -scale : scale},${scale})`} style={{ transformOrigin: "0 0" }}>
      {/* Cape */}
      <path d="M-9 4 Q-18 15 -14 24 L-4 18 Z" fill="#F59E0B" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M9 4 Q18 15 14 24 L4 18 Z"  fill="#F59E0B" stroke="#111" strokeWidth="1.2" strokeLinejoin="round" />
      {/* Body */}
      <rect x="-6" y="3" width="12" height="15" rx="2" fill="#5B21B6" stroke="#111" strokeWidth="1.2" />
      {/* Chest star */}
      <path d="M0 6 L1 9 L4 9 L2 11 L3 14 L0 12.5 L-3 14 L-2 11 L-4 9 L-1 9Z"
        fill="#FFE236" stroke="#111" strokeWidth="0.6" />
      {/* Head */}
      <circle cx="0" cy="-3" r="7" fill="#FBBF24" stroke="#111" strokeWidth="1.5" />
      {/* Mask stripe */}
      <path d="M-7 -4 Q0 -7 7 -4 Q7 -1.5 0 -1.5 Q-7 -1.5 -7 -4Z" fill="#5B21B6" fillOpacity="0.55" />
      {/* Eyes */}
      <ellipse cx="-2.5" cy="-3.5" rx="1.3" ry="1.4" fill="#111" />
      <ellipse cx="2.5"  cy="-3.5" rx="1.3" ry="1.4" fill="#111" />
      <circle  cx="-2"   cy="-4"   r="0.4" fill="white" />
      <circle  cx="3"    cy="-4"   r="0.4" fill="white" />
      {/* Smile */}
      <path d="M-2.5 -0.5 Q0 1.5 2.5 -0.5" stroke="#111" strokeWidth="1" fill="none" strokeLinecap="round" />
      {/* Boots */}
      <rect x="-6" y="17" width="4.5" height="7" rx="1.5" fill="#3730A3" stroke="#111" strokeWidth="1" />
      <rect x="1.5" y="17" width="4.5" height="7" rx="1.5" fill="#3730A3" stroke="#111" strokeWidth="1" />
    </g>
  );
}

/** Alien character */
function Alien({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x},${y}) scale(${scale})`}>
      {/* Antennae */}
      <line x1="-3" y1="-14" x2="-6" y2="-22" stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="-6" cy="-22" r="1.8" fill="#A78BFA" stroke="#111" strokeWidth="1" />
      <line x1="3" y1="-14" x2="6" y2="-22" stroke="#111" strokeWidth="1.2" strokeLinecap="round" />
      <circle cx="6" cy="-22" r="1.8" fill="#A78BFA" stroke="#111" strokeWidth="1" />
      {/* Head (large oval) */}
      <ellipse cx="0" cy="-8" rx="9" ry="10" fill="#34D399" stroke="#111" strokeWidth="1.5" />
      {/* Big eyes */}
      <ellipse cx="-3.5" cy="-9" rx="3"  ry="4" fill="#111" />
      <ellipse cx="3.5"  cy="-9" rx="3"  ry="4" fill="#111" />
      <circle  cx="-2.5" cy="-10" r="1.2" fill="white" />
      <circle  cx="4.5"  cy="-10" r="1.2" fill="white" />
      {/* Mouth line */}
      <path d="M-4 -2 Q0 1 4 -2" stroke="#111" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {/* Body */}
      <rect x="-7" y="2" width="14" height="16" rx="3" fill="#34D399" stroke="#111" strokeWidth="1.5" />
      {/* Arms */}
      <path d="M-7 6 Q-14 10 -12 16" stroke="#34D399" strokeWidth="4" strokeLinecap="round"
        fill="none" />
      <path d="M-7 6 Q-14 10 -12 16" stroke="#111" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M7 6 Q14 10 12 16" stroke="#34D399" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M7 6 Q14 10 12 16" stroke="#111" strokeWidth="1.2" strokeLinecap="round" fill="none" />
    </g>
  );
}

/* ── Page scene SVGs ──────────────────────────────────────────────── */

/** Cover — styled like a Marvel comic cover */
function CoverPage() {
  return (
    <svg viewBox="0 0 290 330" className="w-full h-full" role="img" aria-label="Comic cover">
      {/* Sky gradient (flat bands like Silver Age comics) */}
      <rect width="290" height="330" fill="#0B0034" />
      {/* Space — star field */}
      {([[30,20],[80,15],[140,30],[200,10],[250,25],[20,80],[265,70],[150,60],[90,55],[230,95]] as [number,number][]).map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.8 : 1} fill="white" fillOpacity={0.4 + (i % 4) * 0.12} />
      ))}
      {/* Planet */}
      <circle cx="245" cy="55" r="28" fill="#5B21B6" fillOpacity="0.7" />
      <ellipse cx="245" cy="55" rx="40" ry="9" fill="none" stroke="#A78BFA" strokeWidth="3" strokeOpacity="0.55" />

      {/* Halftone overlay */}
      <rect width="290" height="330" fill="url(#dots)" fillOpacity="0.18" />
      <defs>
        <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="3" cy="3" r="1" fill="#000" />
        </pattern>
        <pattern id="dots2" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="0.9" fill="#000" />
        </pattern>
      </defs>

      {/* Publisher banner */}
      <rect x="0" y="0" width="290" height="22" fill="#FFE236" />
      <rect x="0" y="0" width="290" height="22" fill="none" stroke="#111" strokeWidth="2" />
      <text x="145" y="15" textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif" fontSize="11" fontWeight="bold" fill="#111"
        style={{ textTransform: "uppercase", letterSpacing: "0.15em" }}>
        HEROVERSE KIDS GROUP
      </text>
      {/* Issue + price badges */}
      <rect x="0" y="0" width="52" height="22" fill="#5B21B6" />
      <text x="26" y="15" textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif" fontSize="10" fontWeight="bold" fill="#FFE236">
        #001
      </text>
      <rect x="238" y="0" width="52" height="22" fill="#5B21B6" />
      <text x="264" y="15" textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif" fontSize="10" fontWeight="bold" fill="#FFE236">
        FREE!
      </text>

      {/* Rocket with glow */}
      <g transform="translate(155,140) rotate(-30)">
        <ellipse cx="0" cy="0" rx="24" ry="8" fill="#A78BFA" fillOpacity="0.3" />
        <rect x="-10" y="-42" width="20" height="48" rx="10" fill="#E0E7FF" stroke="#111" strokeWidth="2" />
        <path d="-10,-42 0,-60 10,-42" fill="#F59E0B" stroke="#111" strokeWidth="1.5" />
        <polygon points="-10,-42 0,-60 10,-42" fill="#F59E0B" stroke="#111" strokeWidth="1.5" />
        {/* Cockpit window */}
        <circle cx="0" cy="-25" r="7" fill="#60A5FA" stroke="#111" strokeWidth="1.5" />
        {/* Arjun face in window */}
        <circle cx="0" cy="-25" r="5" fill="#FBBF24" />
        <ellipse cx="-1.5" cy="-26" rx="1" ry="1.1" fill="#111" />
        <ellipse cx="1.5"  cy="-26" rx="1" ry="1.1" fill="#111" />
        {/* Fins */}
        <polygon points="-10,0 -18,12 -10,10" fill="#F59E0B" stroke="#111" strokeWidth="1.5" />
        <polygon points="10,0 18,12 10,10"  fill="#F59E0B" stroke="#111" strokeWidth="1.5" />
        {/* Flame */}
        <path d="M-6 6 Q0 22 6 6 Q3 14 0 18 Q-3 14 -6 6Z" fill="#F97316" stroke="#111" strokeWidth="1" />
        <path d="M-3 6 Q0 16 3 6 Q1.5 12 0 14 Q-1.5 12 -3 6Z" fill="#FFE236" />
      </g>

      {/* Arjun hero stance */}
      <Arjun x={85} y={200} scale={2.4} />

      {/* ActionWord */}
      <ActionWord text="ZOOM!" x={55} y={145} r={26} rotate={-12} fontSize={14} />

      {/* Main title */}
      <text x="145" y="265"
        textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif"
        fontSize="30"
        fontWeight="bold"
        fill="#FFE236"
        stroke="#111"
        strokeWidth="2"
        paintOrder="stroke"
        style={{ letterSpacing: "0.03em" }}>
        ARJUN'S
      </text>
      <text x="145" y="295"
        textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif"
        fontSize="22"
        fontWeight="bold"
        fill="white"
        stroke="#111"
        strokeWidth="1.5"
        paintOrder="stroke"
        style={{ letterSpacing: "0.05em" }}>
        SPACE ADVENTURE!
      </text>
      {/* Tagline */}
      <rect x="20" y="305" width="250" height="18" fill="#5B21B6" stroke="#111" strokeWidth="1.5" />
      <text x="145" y="317"
        textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif"
        fontSize="9"
        fill="#FFE236"
        style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}>
        THE GALAXY'S GREATEST HERO TAKES FLIGHT!
      </text>
    </svg>
  );
}

/** Page 1 — The discovery */
function Page1() {
  return (
    <svg viewBox="0 0 290 330" className="w-full h-full" role="img" aria-label="Page 1">
      {/* Panel borders + gutters */}
      <rect width="290" height="330" fill="#E8E0D0" /> {/* gutter color */}

      {/* Caption strip */}
      <rect x="3" y="3" width="284" height="22" fill="#FFE236" stroke="#111" strokeWidth="2" />
      <text x="145" y="17" textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif" fontSize="9" fontWeight="bold" fill="#111"
        style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Tuesday night. A quiet neighbourhood…
      </text>

      {/* Panel 1 — BIG top panel (left 60%) */}
      <rect x="3" y="29" width="174" height="186" fill="#1A1033" stroke="#111" strokeWidth="2.5" />
      {/* Night scene */}
      {([[20,50],[50,40],[80,60],[130,42],[160,55],[100,75],[40,90]] as [number,number][]).map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy + 29} r={i % 2 === 0 ? 1.5 : 0.9} fill="white" fillOpacity="0.5" />
      ))}
      {/* House silhouette */}
      <polygon points="10,175 10,130 45,100 80,130 80,175" fill="#111" fillOpacity="0.7" transform="translate(3,29)" />
      <rect x="30" y="148" width="12" height="16" fill="#F59E0B" fillOpacity="0.6" transform="translate(3,29)" />
      {/* Rocket glowing */}
      <g transform="translate(130,160)">
        <circle cx="0" cy="0" r="22" fill="#8B5CF6" fillOpacity="0.2" />
        <circle cx="0" cy="0" r="14" fill="#A78BFA" fillOpacity="0.25" />
        <rect x="-7" y="-26" width="14" height="32" rx="7" fill="#E0E7FF" stroke="#111" strokeWidth="2" />
        <polygon points="-7,-26 0,-40 7,-26" fill="#F59E0B" stroke="#111" strokeWidth="1.5" />
        <circle cx="0" cy="-14" r="5" fill="#60A5FA" stroke="#111" strokeWidth="1.2" />
        <polygon points="-7,4 -13,14 -7,12" fill="#F59E0B" stroke="#111" strokeWidth="1.2" />
        <polygon points="7,4 13,14 7,12" fill="#F59E0B" stroke="#111" strokeWidth="1.2" />
      </g>
      {/* Arjun running toward rocket */}
      <Arjun x={65} y={175} scale={1.5} />
      <ActionWord text="GLOW!" x={90} y={80} r={20} color="#A78BFA" rotate={5} fontSize={11} />

      {/* Panel 2 — right top */}
      <rect x="181" y="29" width="106" height="90" fill="#FFE9C5" stroke="#111" strokeWidth="2.5" />
      {/* Arjun face close-up — shocked expression */}
      <circle cx="234" cy="69" r="32" fill="#FBBF24" stroke="#111" strokeWidth="2" />
      <ellipse cx="222" cy="65" rx="5" ry="6" fill="#111" />
      <ellipse cx="246" cy="65" rx="5" ry="6" fill="#111" />
      <circle cx="224" cy="62" r="2" fill="white" />
      <circle cx="248" cy="62" r="2" fill="white" />
      {/* Open-mouthed WOW expression */}
      <ellipse cx="234" cy="77" rx="6" ry="5" fill="#111" />
      <ellipse cx="234" cy="77" rx="4" ry="3.5" fill="#E11D48" />
      {/* Eyebrows raised */}
      <path d="M217 57 Q222 54 227 57" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M241 57 Q246 54 251 57" stroke="#111" strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Sweat drop */}
      <path d="M257 52 Q259 48 261 52 Q261 56 259 56 Q257 56 257 52Z" fill="#60A5FA" stroke="#111" strokeWidth="0.8" />

      {/* Panel 3 — right bottom */}
      <rect x="181" y="123" width="106" height="92" fill="#0B0034" stroke="#111" strokeWidth="2.5" />
      {/* Rocket up close */}
      <g transform="translate(234,169)">
        <circle cx="0" cy="0" r="26" fill="#7C3AED" fillOpacity="0.2" />
        <rect x="-11" y="-36" width="22" height="46" rx="11" fill="#E0E7FF" stroke="#111" strokeWidth="2" />
        <polygon points="-11,-36 0,-54 11,-36" fill="#F59E0B" stroke="#111" strokeWidth="2" />
        <circle cx="0" cy="-18" r="8" fill="#60A5FA" stroke="#111" strokeWidth="1.5" />
        {/* Stars around rocket */}
        <circle cx="-20" cy="-30" r="1.2" fill="white" fillOpacity="0.6" />
        <circle cx="22" cy="-20" r="1" fill="white" fillOpacity="0.5" />
        <circle cx="-18" cy="-10" r="0.9" fill="#FFE236" fillOpacity="0.7" />
      </g>

      {/* Speech bubble — bottom panel */}
      <SpeechBubble text={"A ROCKET!\nJUST MY SIZE!"} x={8} y={232} w={174} h={50}
        tailX={55} tailY={50} tailTipX={48} tailTipY={68} fontSize={11} />

      {/* Bottom caption */}
      <rect x="3" y="302" width="284" height="25" fill="#FFE236" stroke="#111" strokeWidth="2" />
      <text x="145" y="317" textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif" fontSize="9" fontWeight="bold" fill="#111"
        style={{ textTransform: "uppercase", letterSpacing: "0.04em" }}>
        Could this night get any more incredible?
      </text>
    </svg>
  );
}

/** Page 2 — Blast off! */
function Page2() {
  return (
    <svg viewBox="0 0 290 330" className="w-full h-full" role="img" aria-label="Page 2">
      <rect width="290" height="330" fill="#E8E0D0" />

      {/* Top full-width panel — launch! */}
      <rect x="3" y="3" width="284" height="175" fill="#0B0034" stroke="#111" strokeWidth="2.5" />
      {/* Speed lines radiate from launch point */}
      {Array.from({ length: 16 }).map((_, i) => {
        const angle = (Math.PI * 2 / 16) * i;
        const x1 = 145 + Math.cos(angle) * 20;
        const y1 = 100 + Math.sin(angle) * 20;
        const x2 = 145 + Math.cos(angle) * 120;
        const y2 = 100 + Math.sin(angle) * 120;
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="0.7" strokeOpacity="0.12" />;
      })}
      {/* Rocket launching */}
      <g transform="translate(145,95) rotate(0)">
        <path d="M0 50 Q-15 60 -20 80 Q0 65 0 65 Q0 65 20 80 Q15 60 0 50Z"
          fill="#F97316" stroke="#111" strokeWidth="1.2" />
        <path d="M0 50 Q-8 58 -10 70 Q0 60 0 60 Q0 60 10 70 Q8 58 0 50Z" fill="#FFE236" />
        <rect x="-13" y="-52" width="26" height="56" rx="13" fill="#E0E7FF" stroke="#111" strokeWidth="2" />
        <polygon points="-13,-52 0,-72 13,-52" fill="#F59E0B" stroke="#111" strokeWidth="2" />
        <circle cx="0" cy="-28" r="9" fill="#60A5FA" stroke="#111" strokeWidth="1.5" />
        {/* Arjun face in window */}
        <circle cx="0" cy="-28" r="6.5" fill="#FBBF24" />
        <ellipse cx="-2" cy="-29.5" rx="1.4" ry="1.5" fill="#111" />
        <ellipse cx="2"  cy="-29.5" rx="1.4" ry="1.5" fill="#111" />
        <path d="M-2.5 -26 Q0 -24 2.5 -26" stroke="#111" strokeWidth="1" fill="none" strokeLinecap="round" />
        <polygon points="-13,3 -22,18 -13,14" fill="#F59E0B" stroke="#111" strokeWidth="1.5" />
        <polygon points="13,3 22,18 13,14"  fill="#F59E0B" stroke="#111" strokeWidth="1.5" />
      </g>
      {/* Stars */}
      {([[20,20],[60,15],[220,18],[265,30],[30,100],[260,90],[40,160],[270,155]] as [number,number][]).map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 2 === 0 ? 1.5 : 1} fill="white" fillOpacity={0.35 + (i % 3) * 0.1} />
      ))}
      {/* Moon */}
      <path d="M248 40 Q258 35 262 50 Q270 45 268 60 Q258 65 248 62 Q240 52 248 40Z" fill="#FDE68A" stroke="#111" strokeWidth="1.5" />
      <circle cx="256" cy="48" r="2" fill="#111" fillOpacity="0.15" />
      <circle cx="262" cy="57" r="1.5" fill="#111" fillOpacity="0.12" />

      <ActionWord text="WHOOOOSH!" x={80} y={50} r={30} color="#FFE236" rotate={-6} fontSize={13} />

      {/* Speech bubble from cockpit */}
      <SpeechBubble text={"HERE I GO!"} x={160} y={14} w={120} h={36}
        tailX={60} tailY={36} tailTipX={90} tailTipY={55} fontSize={12} />

      {/* Bottom left panel — Earth receding */}
      <rect x="3" y="182" width="138" height="118" fill="#1a3a5c" stroke="#111" strokeWidth="2.5" />
      <circle cx="72" cy="241" r="42" fill="#3B82F6" stroke="#111" strokeWidth="2" />
      <circle cx="72" cy="241" r="42" fill="url(#dots2)" fillOpacity="0.15" />
      {/* Continent blobs */}
      <ellipse cx="60" cy="230" rx="14" ry="10" fill="#16A34A" />
      <ellipse cx="82" cy="248" rx="10" ry="8"  fill="#16A34A" />
      {/* Clouds */}
      <ellipse cx="50" cy="238" rx="8" ry="4" fill="white" fillOpacity="0.6" />
      <ellipse cx="90" cy="235" rx="6" ry="3" fill="white" fillOpacity="0.55" />
      {/* Speech bubble */}
      <SpeechBubble text={"I CAN SEE\nOUR HOUSE!"} x={8} y={183} w={125} h={48}
        tailX={55} tailY={48} tailTipX={65} tailTipY={66} fontSize={10} />

      {/* Bottom right panel — stars and moon */}
      <rect x="145" y="182" width="142" height="118" fill="#0B0034" stroke="#111" strokeWidth="2.5" />
      {/* Large moon */}
      <circle cx="216" cy="241" r="38" fill="#FDE68A" stroke="#111" strokeWidth="2" />
      <circle cx="205" cy="228" r="5" fill="#111" fillOpacity="0.1" />
      <circle cx="225" cy="248" r="3.5" fill="#111" fillOpacity="0.1" />
      <circle cx="210" cy="250" r="2.5" fill="#111" fillOpacity="0.08" />
      {/* Stars */}
      {([[155,195],[285,190],[150,280],[287,285],[270,220]] as [number,number][]).map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="1.2" fill="white" fillOpacity="0.5" />
      ))}
      <Caption text="400,000 MILES AND CLIMBING!" x={148} y={293} w={139} h={16} />
    </svg>
  );
}

/** Page 3 — Planet Zephyr */
function Page3() {
  return (
    <svg viewBox="0 0 290 330" className="w-full h-full" role="img" aria-label="Page 3">
      <rect width="290" height="330" fill="#E8E0D0" />

      {/* Caption */}
      <rect x="3" y="3" width="284" height="20" fill="#FFE236" stroke="#111" strokeWidth="2" />
      <text x="145" y="16" textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif" fontSize="9" fontWeight="bold" fill="#111"
        style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Planet Zephyr — 400 million miles from home
      </text>

      {/* Big top panel — landing */}
      <rect x="3" y="27" width="284" height="150" fill="#1a0d2e" stroke="#111" strokeWidth="2.5" />
      {/* Alien sky gradient strips */}
      <rect x="5" y="29" width="280" height="40" fill="#4C1D95" />
      <rect x="5" y="69" width="280" height="40" fill="#5B21B6" fillOpacity="0.6" />
      {/* Alien ground */}
      <ellipse cx="145" cy="175" rx="145" ry="28" fill="#065F46" />
      <ellipse cx="145" cy="168" rx="145" ry="22" fill="#047857" />
      {/* Alien plants */}
      {[[30,160],[60,155],[220,158],[260,162]] .map(([x,y],i) => (
        <g key={i} transform={`translate(${x},${y})`}>
          <line x1="0" y1="0" x2="0" y2="-22" stroke="#065F46" strokeWidth="3" />
          <ellipse cx="0" cy="-22" rx="8" ry="5" fill="#34D399" stroke="#111" strokeWidth="1" />
        </g>
      ))}
      {/* Rocket landed */}
      <g transform="translate(220,130)">
        <rect x="-10" y="-42" width="20" height="42" rx="10" fill="#E0E7FF" stroke="#111" strokeWidth="2" />
        <polygon points="-10,-42 0,-58 10,-42" fill="#F59E0B" stroke="#111" strokeWidth="2" />
        <circle cx="0" cy="-24" r="7" fill="#60A5FA" stroke="#111" strokeWidth="1.5" />
        <polygon points="-10,0 -16,12 -10,10" fill="#F59E0B" stroke="#111" strokeWidth="1.2" />
        <polygon points="10,0 16,12 10,10"  fill="#F59E0B" stroke="#111" strokeWidth="1.2" />
      </g>
      {/* Arjun landed */}
      <Arjun x={110} y={152} scale={1.8} />
      {/* Alien greeting */}
      <Alien x={175} y={148} scale={1.4} />

      <ActionWord text="BOOM!" x={55} y={75} r={24} color="#F97316" rotate={-8} fontSize={12} />

      {/* Two speech bubbles */}
      <SpeechBubble text={"THE HERO\nHAS ARRIVED!"} x={3} y={28} w={130} h={50}
        tailX={95} tailY={50} tailTipX={148} tailTipY={70} fontSize={10} />

      {/* Bottom left panel — face-off */}
      <rect x="3" y="181" width="140" height="122" fill="#065F46" stroke="#111" strokeWidth="2.5" />
      <Arjun x={70} y={265} scale={1.9} />
      {/* Arjun speech */}
      <SpeechBubble text={"DON'T WORRY—\nI'M HERE\nTO HELP!"} x={5} y={182} w={136} h={55}
        tailX={55} tailY={55} tailTipX={68} tailTipY={74} fontSize={9} />

      {/* Bottom right panel — alien close-up */}
      <rect x="147" y="181" width="140" height="122" fill="#1a0d2e" stroke="#111" strokeWidth="2.5" />
      <Alien x={217} y={268} scale={1.7} />
      <SpeechBubble text={"WE KNEW\nYOU'D COME!"} x={149} y={182} w={136} h={50}
        tailX={80} tailY={50} tailTipX={70} tailTipY={68} fontSize={10} />

      {/* Stars in right panel */}
      {([[155,240],[280,230],[160,295],[280,295]] as [number,number][]).map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r="1" fill="white" fillOpacity="0.4" />
      ))}
    </svg>
  );
}

/** Page 4 — THE END */
function Page4() {
  return (
    <svg viewBox="0 0 290 330" className="w-full h-full" role="img" aria-label="The End">
      <rect width="290" height="330" fill="#0B0034" />

      {/* Halftone */}
      <rect width="290" height="330" fill="url(#dots)" fillOpacity="0.12" />

      {/* Celebration burst */}
      <ActionWord text="HOORAY!" x={145} y={120} r={80} color="#FFE236" rotate={0} fontSize={26} />

      {/* Stars and confetti */}
      {([[30,40],[260,35],[20,180],[270,190],[50,280],[240,275],[145,30]] as [number,number][]).map(([cx,cy],i)=>(
        <circle key={i} cx={cx} cy={cy} r={i % 2 === 0 ? 2 : 1.2} fill={["#F59E0B","#A78BFA","#34D399","white"][i % 4]} fillOpacity="0.7" />
      ))}
      {/* Confetti rectangles */}
      {([[40,60,-15,"#F59E0B"],[80,35,20,"#34D399"],[200,55,10,"#F472B6"],[235,70,-20,"#60A5FA"]] as [number,number,number,string][]).map(([x,y,rot,fill],i)=>(
        <rect key={i} x={x} y={y} width="10" height="5" rx="1" fill={fill} fillOpacity="0.7" transform={`rotate(${rot},${x},${y})`} />
      ))}

      {/* Arjun victory pose */}
      <Arjun x={145} y={235} scale={2.8} />

      {/* Trophy */}
      <g transform="translate(50,200)">
        <rect x="-15" y="-10" width="30" height="35" rx="4" fill="#FFD700" stroke="#111" strokeWidth="2" />
        <path d="M-15 0 Q-28 -5 -25 -20 Q-20 -30 -15 -20" fill="#FFD700" stroke="#111" strokeWidth="2" fillRule="evenodd" />
        <path d="M15 0 Q28 -5 25 -20 Q20 -30 15 -20"  fill="#FFD700" stroke="#111" strokeWidth="2" />
        <rect x="-10" y="25" width="20" height="8" rx="2" fill="#B45309" stroke="#111" strokeWidth="1.5" />
        <path d="M0 -5 L1.5 1 L7 1 L2.5 4.5 L4 10 L0 6.5 L-4 10 L-2.5 4.5 L-7 1 L-1.5 1Z"
          fill="white" stroke="#111" strokeWidth="0.8" />
      </g>
      {/* Trophy on right */}
      <g transform="translate(240,200)">
        <rect x="-15" y="-10" width="30" height="35" rx="4" fill="#FFD700" stroke="#111" strokeWidth="2" />
        <path d="M-15 0 Q-28 -5 -25 -20 Q-20 -30 -15 -20" fill="#FFD700" stroke="#111" strokeWidth="2" />
        <path d="M15 0 Q28 -5 25 -20 Q20 -30 15 -20"  fill="#FFD700" stroke="#111" strokeWidth="2" />
        <rect x="-10" y="25" width="20" height="8" rx="2" fill="#B45309" stroke="#111" strokeWidth="1.5" />
      </g>

      {/* THE END box */}
      <rect x="55" y="258" width="180" height="38" fill="#FFE236" stroke="#111" strokeWidth="2.5" />
      <text x="145" y="283"
        textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif"
        fontSize="26"
        fontWeight="bold"
        fill="#111"
        style={{ letterSpacing: "0.08em" }}>
        THE END!
      </text>

      {/* Bottom caption */}
      <rect x="3" y="300" width="284" height="27" fill="#5B21B6" stroke="#111" strokeWidth="2" />
      <text x="145" y="316" textAnchor="middle"
        fontFamily="var(--font-comic), sans-serif" fontSize="9" fontWeight="bold" fill="#FFE236"
        style={{ textTransform: "uppercase", letterSpacing: "0.06em" }}>
        Your child is the hero of the next story!
      </text>
    </svg>
  );
}

/* ── Page registry ────────────────────────────────────────────────── */
interface ComicPage {
  id: number;
  scene: React.ReactNode;
  isCover?: boolean;
}

const PAGES: ComicPage[] = [
  { id: 0, isCover: true, scene: <CoverPage /> },
  { id: 1, scene: <Page1 /> },
  { id: 2, scene: <Page2 /> },
  { id: 3, scene: <Page3 /> },
  { id: 4, scene: <Page4 /> },
];

/* ── StoryBook (comic viewer) ─────────────────────────────────────── */
type FlipDir   = "fwd" | "back";
type FlipState = "idle" | "out" | "in";

export default function StoryBook() {
  const [page, setPage]           = useState(0);
  const [exitPage, setExitPage]   = useState<number | null>(null);
  const [flipDir, setFlipDir]     = useState<FlipDir>("fwd");
  const [flipState, setFlipState] = useState<FlipState>("idle");
  const flipLock                  = useRef(false);

  const goTo = useCallback((next: number, dir: FlipDir) => {
    if (flipLock.current) return;
    flipLock.current = true;
    setFlipDir(dir);
    setExitPage(page);
    setFlipState("out");
    setTimeout(() => {
      setPage(next);
      setExitPage(null);
      setFlipState("in");
      setTimeout(() => {
        setFlipState("idle");
        flipLock.current = false;
      }, 380);
    }, 340);
  }, [page]);

  /* Auto-advance every 5 s */
  useEffect(() => {
    if (flipState !== "idle") return;
    const t = setTimeout(() => goTo((page + 1) % PAGES.length, "fwd"), 5000);
    return () => clearTimeout(t);
  }, [page, flipState, goTo]);

  const enterClass = flipState === "in"
    ? flipDir === "fwd" ? "book-enter-fwd" : "book-enter-back"
    : "";
  const exitClass  = exitPage !== null
    ? flipDir === "fwd" ? "book-exit-fwd"  : "book-exit-back"
    : "";

  return (
    <div className="relative group select-none" style={{ width: 290 }}>
      {/* Drop shadow under the book */}
      <div className="absolute -bottom-3 left-6 right-6 h-5 bg-black/40 blur-lg rounded-full pointer-events-none" />

      {/* Comic book outer frame */}
      <div className="relative overflow-hidden rounded-sm shadow-2xl"
        style={{ border: "5px solid #111", background: "#111" }}>

        {/* Spine accent */}
        <div className="absolute top-0 left-0 bottom-0 w-2 z-20 pointer-events-none"
          style={{ background: "linear-gradient(to right, #000 0%, rgba(0,0,0,0.4) 100%)" }} />

        {/* Page container */}
        <div className="relative cursor-pointer" style={{ height: 330 }}
          onClick={() => goTo((page + 1) % PAGES.length, "fwd")}>

          {/* Exit overlay */}
          {exitPage !== null && (
            <div key={`exit-${exitPage}`}
              className={`absolute inset-0 z-10 ${exitClass}`}
              style={{ background: "#111" }}>
              {PAGES[exitPage].scene}
            </div>
          )}

          {/* Entering page */}
          <div key={`enter-${page}`} className={`w-full h-full ${enterClass}`}>
            {PAGES[page].scene}
          </div>
        </div>
      </div>

      {/* Nav controls */}
      <button type="button"
        onClick={(e) => { e.stopPropagation(); goTo((page - 1 + PAGES.length) % PAGES.length, "back"); }}
        className="absolute -left-11 top-[145px] text-white/40 hover:text-white/80 transition-colors text-3xl font-bold"
        aria-label="Previous page">‹</button>
      <button type="button"
        onClick={(e) => { e.stopPropagation(); goTo((page + 1) % PAGES.length, "fwd"); }}
        className="absolute -right-11 top-[145px] text-white/40 hover:text-white/80 transition-colors text-3xl font-bold"
        aria-label="Next page">›</button>

      {/* Dot nav */}
      <div className="flex justify-center gap-2 mt-3">
        {PAGES.map((p, i) => (
          <button key={p.id} type="button"
            onClick={() => { if (i !== page) goTo(i, i > page ? "fwd" : "back"); }}
            className={`rounded-full transition-all duration-300 ${i === page ? "w-5 h-2.5 bg-gold" : "w-2.5 h-2.5 bg-white/25 hover:bg-white/50"}`}
            aria-label={`Page ${i}`} />
        ))}
      </div>

      <p className="text-center text-white/30 text-xs mt-2 group-hover:text-white/50 transition">
        Click to turn page →
      </p>
    </div>
  );
}
