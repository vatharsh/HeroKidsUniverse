const themes = [
  { emoji: "🚀", name: "Space Adventure", gradient: "from-indigo-950 to-purple-900" },
  { emoji: "⚡", name: "Superhero Mission", gradient: "from-red-950 to-orange-900" },
  { emoji: "🌿", name: "Jungle Quest", gradient: "from-green-950 to-emerald-800" },
  { emoji: "🌊", name: "Underwater Adventure", gradient: "from-blue-950 to-cyan-900" },
  { emoji: "🔍", name: "Detective Mystery", gradient: "from-gray-900 to-slate-800" },
  { emoji: "🎂", name: "Birthday Adventure", gradient: "from-pink-950 to-rose-900" },
];

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
          {themes.map((theme) => (
            <div
              key={theme.name}
              className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-105 hover:ring-2 hover:ring-gold/50"
            >
              <div
                className={`aspect-[4/3] flex flex-col justify-between p-6 bg-gradient-to-br ${theme.gradient}`}
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
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
