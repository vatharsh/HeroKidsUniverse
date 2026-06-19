const testimonials = [
  {
    quote:
      "My daughter cried happy tears when she saw herself as a superhero. She has asked for a new story every single week since.",
    name: "Meera Iyer",
    role: "Mum of Ananya, age 6",
    emoji: "👩",
    theme: "Superhero Mission",
  },
  {
    quote:
      "We gifted this to our son for his birthday. He read his space adventure story five times in one evening. Worth every rupee.",
    name: "Rahul Sharma",
    role: "Dad of Kabir, age 8",
    emoji: "👨",
    theme: "Space Adventure",
  },
  {
    quote:
      "The quality of the illustrations is stunning. I printed and framed two pages. My kids' grandparents were absolutely floored.",
    name: "Divya Nair",
    role: "Mum of Rohan & Priya, ages 5 & 9",
    emoji: "👩",
    theme: "Jungle Quest",
  },
];

export default function Testimonials() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-brand text-xs font-bold tracking-widest uppercase mb-3">
            PARENT STORIES
          </p>
          <h2 className="font-[family-name:var(--font-display)] font-black text-ink text-4xl md:text-5xl mb-4">
            Real Magic, Real Memories
          </h2>
          <p className="text-ink-mid text-lg">
            From parents who have seen their child&apos;s face light up.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {testimonials.map((t) => (
            <div key={t.name} className="bg-cream rounded-2xl p-8 flex flex-col gap-5">
              {/* Stars */}
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4].map((i) => (
                  <span key={i} className="text-gold text-lg">★</span>
                ))}
              </div>

              {/* Quote */}
              <p className="text-ink-mid text-base leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>

              {/* Theme badge */}
              <span className="inline-block bg-brand-50 text-brand text-xs font-semibold px-3 py-1 rounded-full w-fit">
                {t.theme}
              </span>

              {/* Author */}
              <div className="flex items-center gap-3 border-t border-ink/10 pt-5">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-xl">
                  {t.emoji}
                </div>
                <div>
                  <p className="font-semibold text-ink text-sm">{t.name}</p>
                  <p className="text-ink-muted text-xs">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Aggregate trust badge */}
        <div className="flex flex-wrap justify-center items-center gap-8 mt-16 text-center">
          {[
            { value: "4.9 / 5", label: "Average rating" },
            { value: "500+", label: "Stories created" },
            { value: "98%", label: "Would recommend" },
          ].map((stat) => (
            <div key={stat.label}>
              <p className="font-[family-name:var(--font-display)] font-black text-brand text-3xl">
                {stat.value}
              </p>
              <p className="text-ink-muted text-sm mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
