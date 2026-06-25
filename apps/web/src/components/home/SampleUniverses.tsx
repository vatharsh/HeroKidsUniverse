"use client";

import Image from "next/image";

/* ── Static demo universe data ─────────────────────────────────────── */

const UNIVERSES = [
  {
    id: "arjun",
    heroName: "Arjun",
    heroAge: 8,
    universeName: "Arjun's Starfire Chronicles",
    theme: "Space Adventure",
    themeEmoji: "🚀",
    gradient: "from-indigo-950 via-purple-900 to-indigo-800",
    accentColor: "#A78BFA",
    episodes: 9,
    powers: ["Cosmic Flame", "Zero-G Speed", "Star Shield"],
    companion: "Nova — Robotic Star Guardian",
    companionEmoji: "🤖",
    villain: "The Shadow Swirl",
    description: "Arjun discovers a distress signal from deep space and embarks on a mission to restore light to a dying galaxy.",
    coverBg: "bg-gradient-to-br from-indigo-950 to-purple-900",
    isReal: true, // We have actual story panels for this
  },
  {
    id: "priya",
    heroName: "Priya",
    heroAge: 7,
    universeName: "Priya's Ocean Kingdom",
    theme: "Underwater Adventure",
    themeEmoji: "🌊",
    gradient: "from-blue-950 via-cyan-900 to-blue-800",
    accentColor: "#67E8F9",
    episodes: 5,
    powers: ["Deep Breath", "Coral Armor", "Tidal Whirl"],
    companion: "Bubbles — Ancient Glowing Jellyfish",
    companionEmoji: "🪼",
    villain: "The Tide Crusher",
    description: "Priya dives into a hidden ocean world to save the Sea Crystal before eternal darkness swallows the depths.",
    coverBg: "bg-gradient-to-br from-blue-950 to-cyan-900",
    isReal: false,
  },
  {
    id: "zara",
    heroName: "Zara",
    heroAge: 10,
    universeName: "Zara's Shadow Agency",
    theme: "Detective Mystery",
    themeEmoji: "🔍",
    gradient: "from-gray-900 via-slate-800 to-gray-900",
    accentColor: "#FDE68A",
    episodes: 7,
    powers: ["Memory Vision", "Invisibility Cloak", "Truth Sense"],
    companion: "Shadow — A perceptive black cat",
    companionEmoji: "🐱",
    villain: "The Riddle Master",
    description: "Zara runs a secret detective agency solving mysteries no adult can crack — until the Riddle Master steals the city's memories.",
    coverBg: "bg-gradient-to-br from-gray-900 to-slate-800",
    isReal: false,
  },
  {
    id: "rohan",
    heroName: "Rohan",
    heroAge: 6,
    universeName: "Rohan's Jungle Kingdom",
    theme: "Jungle Quest",
    themeEmoji: "🌿",
    gradient: "from-green-950 via-emerald-900 to-green-800",
    accentColor: "#6EE7B7",
    episodes: 4,
    powers: ["Animal Speech", "Vine Leap", "Healing Roots"],
    companion: "Raja — A noble tiger cub",
    companionEmoji: "🐯",
    villain: "The Stone Serpent",
    description: "Rohan is chosen as guardian of the ancient jungle by the Council of Animals — if he can prove himself worthy.",
    coverBg: "bg-gradient-to-br from-green-950 to-emerald-900",
    isReal: false,
  },
  {
    id: "aanya",
    heroName: "Aanya",
    heroAge: 9,
    universeName: "Aanya's Hero Academy",
    theme: "Superhero Mission",
    themeEmoji: "⚡",
    gradient: "from-red-950 via-orange-900 to-red-800",
    accentColor: "#FCA5A5",
    episodes: 11,
    powers: ["Lightning Speed", "Force Shield", "Mind Bolt"],
    companion: "Bolt — An electric silver fox",
    companionEmoji: "🦊",
    villain: "Lord Vortex",
    description: "Aanya enrolls in the world's most secret superhero school — but discovers the school itself may be the greatest danger.",
    coverBg: "bg-gradient-to-br from-red-950 to-orange-900",
    isReal: false,
  },
  {
    id: "dev",
    heroName: "Dev",
    heroAge: 5,
    universeName: "Dev's Birthday Universe",
    theme: "Birthday Adventure",
    themeEmoji: "🎂",
    gradient: "from-pink-950 via-rose-900 to-purple-900",
    accentColor: "#F9A8D4",
    episodes: 3,
    powers: ["Time Freeze", "Wish Granting", "Party Blast"],
    companion: "Confetti — A rainbow butterfly",
    companionEmoji: "🦋",
    villain: "The Grumpy Clock",
    description: "On his 5th birthday, Dev discovers time is broken — he must fix the clocks of the universe before the day ends.",
    coverBg: "bg-gradient-to-br from-pink-950 to-rose-900",
    isReal: false,
  },
];

/* ── Universe Card SVG Art ─────────────────────────────────────────── */

function UniverseArt({ id }: { id: string }) {
  if (id === "arjun") return (
    <svg viewBox="0 0 240 160" className="absolute inset-0 w-full h-full" aria-hidden>
      {[[18,12],[55,8],[90,22],[130,6],[165,18],[145,55],[30,65],[80,75],[175,70],[210,30],[220,90],[8,90]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2 : 1.2} fill="white" opacity={0.4 + (i % 3) * 0.15} />
      ))}
      <circle cx="185" cy="42" r="28" fill="#7C3AED" opacity="0.5" />
      <ellipse cx="185" cy="42" rx="42" ry="8" fill="none" stroke="white" strokeWidth="3.5" strokeOpacity="0.4" />
      <g transform="translate(75,105) rotate(-40)">
        <rect x="-7" y="-26" width="14" height="32" rx="7" fill="white" opacity="0.8" />
        <polygon points="-7,6 7,6 0,20" fill="#F59E0B" opacity="0.9" />
        <rect x="-11" y="2" width="7" height="10" rx="2" fill="white" opacity="0.5" />
        <rect x="4" y="2" width="7" height="10" rx="2" fill="white" opacity="0.5" />
      </g>
      <text x="155" y="128" fontSize="22" opacity="0.8">🔥</text>
    </svg>
  );

  if (id === "priya") return (
    <svg viewBox="0 0 240 160" className="absolute inset-0 w-full h-full" aria-hidden>
      <path d="M0 40 Q60 25 120 40 Q180 55 240 40 L240 0 L0 0Z" fill="white" opacity="0.06" />
      {[[55,45],[90,28],[120,52],[155,38],[185,62],[210,40]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 2 === 0 ? 4 : 2.5} fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.45" />
      ))}
      <ellipse cx="95" cy="75" rx="18" ry="11" fill="#06B6D4" opacity="0.65" />
      <polygon points="113,75 128,65 128,85" fill="#06B6D4" opacity="0.65" />
      <circle cx="90" cy="72" r="3" fill="white" opacity="0.9" />
      <ellipse cx="160" cy="100" rx="13" ry="8" fill="#F59E0B" opacity="0.65" />
      <polygon points="173,100 185,93 185,107" fill="#F59E0B" opacity="0.65" />
      <text x="195" y="118" fontSize="24" opacity="0.9">🪼</text>
    </svg>
  );

  if (id === "zara") return (
    <svg viewBox="0 0 240 160" className="absolute inset-0 w-full h-full" aria-hidden>
      {[[0,105,0,160],[28,88,28,160],[58,98,58,160],[95,78,95,160],[128,90,128,160],[162,82,162,160],[192,96,192,160]].map(([x1,y1,x2,y2],i) => (
        <rect key={i} x={x1} y={y1} width="24" height={160 - y1} fill="black" opacity="0.22" />
      ))}
      {[[32,92],[62,102],[98,82],[132,95],[166,88]].map(([x,y],i) => (
        <rect key={i} x={x} y={y} width="5" height="5" fill="#FDE68A" opacity="0.75" />
      ))}
      <circle cx="120" cy="65" r="32" fill="none" stroke="white" strokeWidth="4" strokeOpacity="0.55" />
      <line x1="143" y1="88" x2="165" y2="112" stroke="white" strokeWidth="5" strokeOpacity="0.45" strokeLinecap="round" />
      <text x="10" y="42" fontSize="16" fill="white" opacity="0.3" fontWeight="bold">?</text>
      <text x="192" y="55" fontSize="12" fill="white" opacity="0.25" fontWeight="bold">?</text>
      <text x="175" y="32" fontSize="24" opacity="0.9">🐱</text>
    </svg>
  );

  if (id === "rohan") return (
    <svg viewBox="0 0 240 160" className="absolute inset-0 w-full h-full" aria-hidden>
      <path d="M0 160 Q24 95 55 118 Q30 130 0 160Z" fill="#065f46" opacity="0.7" />
      <path d="M0 138 Q36 72 66 108 Q42 120 0 138Z" fill="#047857" opacity="0.55" />
      <path d="M240 160 Q216 95 185 118 Q210 130 240 160Z" fill="#065f46" opacity="0.7" />
      <path d="M240 138 Q204 72 174 108 Q198 120 240 138Z" fill="#047857" opacity="0.55" />
      <path d="M120 0 Q126 36 114 72 Q126 96 120 132" fill="none" stroke="#065f46" strokeWidth="3" strokeOpacity="0.55" />
      <ellipse cx="108" cy="112" rx="7" ry="5" fill="#111" opacity="0.5" />
      <ellipse cx="132" cy="112" rx="7" ry="5" fill="#111" opacity="0.5" />
      <circle cx="108" cy="112" r="3" fill="#F59E0B" opacity="0.9" />
      <circle cx="132" cy="112" r="3" fill="#F59E0B" opacity="0.9" />
      <text x="175" y="42" fontSize="28" opacity="0.85">🐯</text>
    </svg>
  );

  if (id === "aanya") return (
    <svg viewBox="0 0 240 160" className="absolute inset-0 w-full h-full" aria-hidden>
      {[[0,108,0,160],[26,88,26,160],[52,98,52,160],[98,78,98,160],[130,90,130,160],[160,83,160,160],[190,95,190,160]].map(([x1,y1,x2,y2],i) => (
        <rect key={i} x={x1} y={y1} width="24" height={160 - y1} fill="black" opacity="0.28" />
      ))}
      {[[28,92],[55,102],[102,82],[134,98],[164,88]].map(([x,y],i) => (
        <rect key={i} x={x} y={y} width="6" height="5" fill="#F59E0B" opacity="0.7" />
      ))}
      <polygon points="120,18 108,72 120,65 108,138 138,58 122,65 138,18" fill="#F59E0B" opacity="0.9" />
      <circle cx="120" cy="75" r="40" fill="#F59E0B" opacity="0.06" />
      <text x="175" y="50" fontSize="26" opacity="0.9">🦊</text>
    </svg>
  );

  return (
    <svg viewBox="0 0 240 160" className="absolute inset-0 w-full h-full" aria-hidden>
      {[[22,22,"#F59E0B"],[48,12,"#A78BFA"],[78,28,"#34D399"],[112,9,"#F472B6"],[142,20,"#60A5FA"],[172,14,"#F59E0B"],[200,30,"#F472B6"],[18,60,"#34D399"],[60,48,"#F59E0B"],[190,55,"#A78BFA"],[220,38,"#34D399"]].map(([cx,cy,fill],i) => (
        <circle key={i} cx={cx as number} cy={cy as number} r="4" fill={fill as string} opacity="0.65" />
      ))}
      <path d="M0 0 Q36 48 24 96 Q12 118 36 154" fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeOpacity="0.38" />
      <path d="M240 0 Q204 58 222 108 Q234 128 210 160" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeOpacity="0.38" />
      <ellipse cx="78" cy="65" rx="20" ry="25" fill="#EC4899" opacity="0.6" />
      <ellipse cx="120" cy="58" rx="22" ry="27" fill="#8B5CF6" opacity="0.6" />
      <ellipse cx="162" cy="68" rx="20" ry="25" fill="#F59E0B" opacity="0.6" />
      <text x="172" y="38" fontSize="26" opacity="0.9">🦋</text>
    </svg>
  );
}

/* ── Section ───────────────────────────────────────────────────────── */

export default function SampleUniverses() {
  return (
    <section id="sample-universes" className="py-24 bg-space-gradient relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-brand/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-gold text-xs font-bold tracking-[0.2em] uppercase mb-3">REAL UNIVERSES · BUILT BY FAMILIES</p>
          <h2 className="font-[family-name:var(--font-display)] font-black text-white text-4xl md:text-5xl mb-4">
            Every universe is unique
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            Each child gets a world built entirely around them — with powers they earn, companions they meet, and a story that never ends.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {UNIVERSES.map((u) => (
            <div
              key={u.id}
              className="group relative rounded-3xl overflow-hidden border border-white/10 hover:border-white/25 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-brand/20"
            >
              {/* Cover illustration */}
              <div className={`relative aspect-[4/3] bg-gradient-to-br ${u.gradient}`}>
                <UniverseArt id={u.id} />

                {/* Overlay gradient for text readability */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

                {/* Top badges */}
                <div className="absolute top-4 left-4 right-4 flex items-start justify-between gap-2">
                  <span className="bg-black/40 backdrop-blur text-white text-xs font-semibold px-2.5 py-1 rounded-full border border-white/15">
                    {u.themeEmoji} {u.theme}
                  </span>
                  {u.isReal && (
                    <span className="bg-gold/80 text-black text-[10px] font-black px-2 py-0.5 rounded-full">
                      REAL STORY
                    </span>
                  )}
                </div>

                {/* Bottom text overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <h3 className="font-[family-name:var(--font-display)] text-white text-xl leading-tight">
                        {u.universeName}
                      </h3>
                      <p className="text-white/60 text-xs mt-0.5">
                        Hero: {u.heroName}, age {u.heroAge}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-gold font-bold text-lg">{u.episodes}</span>
                      <p className="text-white/50 text-[10px]">episodes</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="bg-white/5 backdrop-blur border-t border-white/8 p-4 space-y-3">
                <p className="text-white/60 text-xs leading-relaxed">{u.description}</p>

                {/* Powers */}
                <div>
                  <p className="text-white/35 text-[10px] font-bold uppercase tracking-wider mb-1.5">Powers earned</p>
                  <div className="flex flex-wrap gap-1.5">
                    {u.powers.map((p) => (
                      <span key={p} className="text-[10px] font-semibold bg-brand/20 border border-brand/30 text-brand-light px-2 py-0.5 rounded-full">
                        ⚡ {p}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Companion + Villain row */}
                <div className="flex gap-3 pt-0.5">
                  <div className="flex-1 bg-white/5 rounded-xl p-2.5">
                    <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mb-1">Companion</p>
                    <p className="text-white/80 text-xs font-semibold flex items-center gap-1">
                      {u.companionEmoji} {u.companion}
                    </p>
                  </div>
                  <div className="flex-1 bg-white/5 rounded-xl p-2.5">
                    <p className="text-white/35 text-[9px] font-bold uppercase tracking-wider mb-1">Villain</p>
                    <p className="text-white/80 text-xs font-semibold flex items-center gap-1">
                      ⚔️ {u.villain}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-14">
          <p className="text-white/40 text-sm mb-6">Your child&apos;s universe will be entirely their own — different heroes, different powers, different worlds.</p>
          <a
            href="/register"
            className="inline-block bg-brand hover:bg-brand-dark text-white font-bold px-10 py-4 rounded-full shadow-brand transition-all hover:scale-105 text-lg"
          >
            Start Building Your Universe →
          </a>
        </div>
      </div>
    </section>
  );
}
