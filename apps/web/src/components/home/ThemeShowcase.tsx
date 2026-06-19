/* ── SVG illustrations for each theme ─────────────────────────────── */

function SpaceArt() {
  return (
    <svg viewBox="0 0 200 140" className="absolute inset-0 w-full h-full" aria-hidden>
      {/* Stars */}
      {[[18,12],[55,8],[90,22],[130,6],[165,18],[145,55],[30,65],[80,75],[175,70]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 2 : 1.2} fill="white" opacity={0.5 + (i % 3) * 0.15} />
      ))}
      {/* Saturn-like planet */}
      <circle cx="158" cy="42" r="24" fill="#7C3AED" opacity="0.55" />
      <ellipse cx="158" cy="42" rx="36" ry="7" fill="none" stroke="white" strokeWidth="3.5" strokeOpacity="0.45" />
      {/* Rocket */}
      <g transform="translate(60,90) rotate(-40)">
        <rect x="-6" y="-22" width="12" height="28" rx="6" fill="white" opacity="0.85" />
        <polygon points="-6,6 6,6 0,18" fill="#F59E0B" opacity="0.9" />
        <rect x="-10" y="2" width="6" height="9" rx="2" fill="white" opacity="0.5" />
        <rect x="4"  y="2" width="6" height="9" rx="2" fill="white" opacity="0.5" />
      </g>
      {/* Moon */}
      <circle cx="28" cy="115" r="16" fill="white" opacity="0.12" />
      <circle cx="35" cy="109" r="16" fill="#1e1b4b" opacity="0.6" />
    </svg>
  );
}

function SuperheroArt() {
  return (
    <svg viewBox="0 0 200 140" className="absolute inset-0 w-full h-full" aria-hidden>
      {/* City skyline silhouette */}
      <rect x="0"   y="95" width="20"  height="45" fill="black" opacity="0.35" />
      <rect x="18"  y="80" width="25"  height="60" fill="black" opacity="0.3" />
      <rect x="40"  y="88" width="15"  height="52" fill="black" opacity="0.35" />
      <rect x="52"  y="70" width="22"  height="70" fill="black" opacity="0.3" />
      <rect x="72"  y="85" width="18"  height="55" fill="black" opacity="0.35" />
      <rect x="130" y="75" width="28"  height="65" fill="black" opacity="0.3" />
      <rect x="156" y="90" width="20"  height="50" fill="black" opacity="0.35" />
      <rect x="174" y="78" width="26"  height="62" fill="black" opacity="0.3" />
      {/* Windows */}
      {[[22,85],[26,93],[44,92],[56,75],[56,83],[135,80],[135,88],[160,95]].map(([x,y],i) => (
        <rect key={i} x={x} y={y} width="5" height="5" fill="#F59E0B" opacity="0.7" />
      ))}
      {/* Lightning bolt */}
      <polygon points="100,20 90,65 100,60 90,120 115,55 103,60 115,20" fill="#F59E0B" opacity="0.9" />
      {/* Radial glow */}
      <circle cx="100" cy="70" r="35" fill="#F59E0B" opacity="0.07" />
      {/* Stars */}
      <circle cx="30"  cy="25" r="1.5" fill="white" opacity="0.6" />
      <circle cx="170" cy="30" r="1"   fill="white" opacity="0.5" />
      <circle cx="60"  cy="15" r="1.5" fill="white" opacity="0.4" />
    </svg>
  );
}

function JungleArt() {
  return (
    <svg viewBox="0 0 200 140" className="absolute inset-0 w-full h-full" aria-hidden>
      {/* Left leaves */}
      <path d="M0 140 Q20 80 45 100 Q25 110 0 140Z" fill="#065f46" opacity="0.7" />
      <path d="M0 120 Q30 60 55 90 Q35 100 0 120Z" fill="#047857" opacity="0.55" />
      <path d="M-5 80 Q30 40 50 70 Q30 75 -5 80Z"  fill="#065f46" opacity="0.5" />
      {/* Right leaves */}
      <path d="M200 140 Q180 80 155 100 Q175 110 200 140Z" fill="#065f46" opacity="0.7" />
      <path d="M200 115 Q170 60 145 90 Q165 100 200 115Z" fill="#047857" opacity="0.55" />
      <path d="M205 75 Q170 40 150 65 Q170 70 205 75Z"   fill="#065f46" opacity="0.5" />
      {/* Hanging vine */}
      <path d="M100 0 Q105 30 95 60 Q105 80 100 110" fill="none" stroke="#065f46" strokeWidth="3" strokeOpacity="0.6" />
      {/* Hidden animal eyes in bush */}
      <ellipse cx="90"  cy="95" rx="6" ry="4" fill="#111" opacity="0.5" />
      <ellipse cx="110" cy="95" rx="6" ry="4" fill="#111" opacity="0.5" />
      <circle cx="90"  cy="95" r="2.5" fill="#F59E0B" opacity="0.9" />
      <circle cx="110" cy="95" r="2.5" fill="#F59E0B" opacity="0.9" />
      {/* Flowers */}
      <circle cx="75"  cy="125" r="5" fill="#FB923C" opacity="0.7" />
      <circle cx="125" cy="120" r="5" fill="#F472B6" opacity="0.7" />
    </svg>
  );
}

function OceanArt() {
  return (
    <svg viewBox="0 0 200 140" className="absolute inset-0 w-full h-full" aria-hidden>
      {/* Water shimmer at top */}
      <path d="M0 30 Q50 20 100 30 Q150 40 200 30 L200 0 L0 0Z" fill="white" opacity="0.08" />
      <path d="M0 45 Q50 35 100 45 Q150 55 200 45 L200 30 Q150 40 100 30 Q50 20 0 30Z" fill="white" opacity="0.05" />
      {/* Seabed */}
      <path d="M0 130 Q50 120 100 130 Q150 140 200 128 L200 140 L0 140Z" fill="#155e75" opacity="0.5" />
      {/* Coral */}
      <path d="M30 140 Q28 120 30 115 Q32 110 34 115 Q36 120 34 140" fill="#F97316" opacity="0.5" />
      <path d="M35 140 Q33 125 38 118 Q40 113 42 118 Q44 125 40 140" fill="#EC4899" opacity="0.5" />
      <path d="M165 140 Q163 122 168 116 Q170 111 172 116 Q174 122 168 140" fill="#F97316" opacity="0.5" />
      {/* Fish */}
      <ellipse cx="80"  cy="60"  rx="14" ry="8"  fill="#06B6D4" opacity="0.7" />
      <polygon points="94,60 106,52 106,68" fill="#06B6D4" opacity="0.7" />
      <circle cx="76" cy="58" r="2.5" fill="white" opacity="0.9" />
      <ellipse cx="140" cy="85"  rx="10" ry="6"  fill="#F59E0B" opacity="0.7" />
      <polygon points="150,85 160,79 160,91" fill="#F59E0B" opacity="0.7" />
      <circle cx="137" cy="83" r="2" fill="white" opacity="0.9" />
      {/* Bubbles */}
      {[[55,40],[90,25],[120,50],[150,35],[170,60]].map(([cx,cy],i) => (
        <circle key={i} cx={cx} cy={cy} r={i % 2 === 0 ? 4 : 2.5} fill="none" stroke="white" strokeWidth="1.2" strokeOpacity="0.5" />
      ))}
      {/* Seaweed */}
      <path d="M60 140 Q55 120 65 110 Q70 100 60 90" fill="none" stroke="#059669" strokeWidth="3" strokeOpacity="0.6" />
      <path d="M155 140 Q150 122 158 112 Q163 102 155 92" fill="none" stroke="#059669" strokeWidth="3" strokeOpacity="0.6" />
    </svg>
  );
}

function DetectiveArt() {
  return (
    <svg viewBox="0 0 200 140" className="absolute inset-0 w-full h-full" aria-hidden>
      {/* City at night bg lines */}
      {[[0,100,0,140],[25,85,25,140],[50,95,50,140],[90,75,90,140],[120,88,120,140],[155,80,155,140],[180,92,180,140]].map(([x1,y1,x2,y2],i) => (
        <rect key={i} x={x1} y={y1} width="22" height={140 - y1} fill="black" opacity="0.25" />
      ))}
      {/* Window lights */}
      {[[28,88],[55,98],[95,80],[124,92],[158,84]].map(([x,y],i) => (
        <rect key={i} x={x} y={y} width="5" height="4" fill="#FDE68A" opacity="0.8" />
      ))}
      {/* Magnifying glass */}
      <circle cx="110" cy="58" r="28" fill="none" stroke="white" strokeWidth="4.5" strokeOpacity="0.6" />
      <circle cx="110" cy="58" r="28" fill="white" opacity="0.06" />
      <line x1="130" y1="78" x2="152" y2="102" stroke="white" strokeWidth="5" strokeOpacity="0.5" strokeLinecap="round" />
      {/* Footprints */}
      <ellipse cx="40"  cy="60" rx="5" ry="7" fill="white" opacity="0.25" transform="rotate(-10,40,60)" />
      <ellipse cx="52"  cy="72" rx="5" ry="7" fill="white" opacity="0.25" transform="rotate(10,52,72)" />
      <ellipse cx="62"  cy="60" rx="5" ry="7" fill="white" opacity="0.25" transform="rotate(-10,62,60)" />
      {/* Question marks */}
      <text x="22"  y="38" fontSize="18" fill="white" opacity="0.3" fontWeight="bold">?</text>
      <text x="170" y="50" fontSize="14" fill="white" opacity="0.25" fontWeight="bold">?</text>
      <text x="150" y="30" fontSize="10" fill="white" opacity="0.2" fontWeight="bold">?</text>
    </svg>
  );
}

function BirthdayArt() {
  return (
    <svg viewBox="0 0 200 140" className="absolute inset-0 w-full h-full" aria-hidden>
      {/* Confetti dots */}
      {[[20,20,"#F59E0B"],[45,10,"#A78BFA"],[70,25,"#34D399"],[100,8,"#F472B6"],[130,18,"#60A5FA"],[160,12,"#F59E0B"],[185,28,"#F472B6"],[15,55,"#34D399"],[55,45,"#F59E0B"],[175,50,"#A78BFA"]].map(([cx,cy,fill],i) => (
        <circle key={i} cx={cx as number} cy={cy as number} r="4" fill={fill as string} opacity="0.7" />
      ))}
      {/* Streamers */}
      <path d="M0 0 Q30 40 20 80 Q10 100 30 130"  fill="none" stroke="#F59E0B" strokeWidth="2.5" strokeOpacity="0.4" />
      <path d="M200 0 Q170 50 185 90 Q195 110 175 140" fill="none" stroke="#A78BFA" strokeWidth="2.5" strokeOpacity="0.4" />
      {/* Balloon 1 */}
      <ellipse cx="65"  cy="55" rx="18" ry="22" fill="#EC4899" opacity="0.65" />
      <line   x1="65"  y1="77"  x2="65" y2="110" stroke="#EC4899" strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Balloon 2 */}
      <ellipse cx="105" cy="48" rx="20" ry="24" fill="#8B5CF6" opacity="0.65" />
      <line   x1="105" y1="72" x2="105" y2="110" stroke="#8B5CF6" strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Balloon 3 */}
      <ellipse cx="145" cy="58" rx="18" ry="22" fill="#F59E0B" opacity="0.65" />
      <line   x1="145" y1="80" x2="145" y2="110" stroke="#F59E0B" strokeWidth="1.5" strokeOpacity="0.5" />
      {/* Stars */}
      <text x="30"  y="25" fontSize="14" fill="white" opacity="0.7">★</text>
      <text x="165" y="32" fontSize="12" fill="white" opacity="0.6">★</text>
      <text x="100" y="125" fontSize="10" fill="white" opacity="0.5">★</text>
    </svg>
  );
}

/* ── Theme data ────────────────────────────────────────────────────── */
const themes = [
  { emoji: "🚀", name: "Space Adventure",      gradient: "from-indigo-950 to-purple-900",  Art: SpaceArt },
  { emoji: "⚡", name: "Superhero Mission",    gradient: "from-red-950 to-orange-900",      Art: SuperheroArt },
  { emoji: "🌿", name: "Jungle Quest",         gradient: "from-green-950 to-emerald-800",   Art: JungleArt },
  { emoji: "🌊", name: "Underwater Adventure", gradient: "from-blue-950 to-cyan-900",        Art: OceanArt },
  { emoji: "🔍", name: "Detective Mystery",    gradient: "from-gray-900 to-slate-800",       Art: DetectiveArt },
  { emoji: "🎂", name: "Birthday Adventure",   gradient: "from-pink-950 to-rose-900",        Art: BirthdayArt },
];

/* ── Section ───────────────────────────────────────────────────────── */
export default function ThemeShowcase() {
  return (
    <section id="themes" className="py-24 bg-space-gradient">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <h2 className="font-[family-name:var(--font-display)] font-black text-white text-4xl md:text-5xl mb-4">
            Choose Your Adventure
          </h2>
          <p className="text-white/60 text-lg">Six magical worlds waiting for your little hero</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {themes.map(({ emoji, name, gradient, Art }) => (
            <div
              key={name}
              className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-gold/50"
            >
              <div className={`relative aspect-[4/3] bg-gradient-to-br ${gradient} overflow-hidden`}>
                {/* SVG illustration */}
                <Art />

                {/* Content overlay */}
                <div className="absolute inset-0 flex flex-col justify-between p-5">
                  <span className="text-5xl leading-none drop-shadow-lg">{emoji}</span>
                  <div>
                    <h3 className="text-white font-[family-name:var(--font-display)] font-bold text-xl drop-shadow">
                      {name}
                    </h3>
                    <p className="text-white/0 group-hover:text-gold/90 transition-all duration-200 text-sm font-medium">
                      Explore →
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
