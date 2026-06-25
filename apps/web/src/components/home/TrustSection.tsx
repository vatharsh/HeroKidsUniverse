const TRUST_POINTS = [
  {
    icon: "🗑️",
    title: "Photos deleted immediately",
    body: "Your child's photo is used only to generate their avatar. The original is permanently deleted from our servers the moment the avatar is created — never stored, never retained.",
    badge: "Always",
    badgeColor: "bg-emerald-500/15 text-emerald-500 border-emerald-400/20",
  },
  {
    icon: "🔒",
    title: "We never train AI on your data",
    body: "Your child's avatar, stories, and universe are never used to train any AI model. Your family's data belongs to your family — not to us, not to any third party.",
    badge: "Guaranteed",
    badgeColor: "bg-brand/15 text-brand border-brand/20",
  },
  {
    icon: "🌟",
    title: "Child-safe content, every story",
    body: "Every generated story is filtered through our child-safety layer. No violence, fear, or inappropriate content — only positive, empowering adventures appropriate for ages 4–12.",
    badge: "Every story",
    badgeColor: "bg-gold/15 text-gold-dark border-gold/20",
  },
  {
    icon: "📖",
    title: "You own your universe",
    body: "Every story, illustration, avatar, and piece of your child's universe is yours to download, print, and keep forever. No vendor lock-in. Your universe survives us.",
    badge: "Forever",
    badgeColor: "bg-sky-500/15 text-sky-500 border-sky-400/20",
  },
];

export default function TrustSection() {
  return (
    <section className="py-24 bg-space-gradient relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-brand/15 rounded-full blur-[100px] pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <p className="text-gold text-xs font-bold tracking-[0.2em] uppercase mb-3">BUILT FOR FAMILIES</p>
          <h2 className="font-[family-name:var(--font-display)] font-black text-white text-4xl md:text-5xl mb-4">
            Privacy is not a feature.<br />It&apos;s a promise.
          </h2>
          <p className="text-white/60 text-lg max-w-xl mx-auto">
            You&apos;re trusting us with your child&apos;s likeness. We take that seriously.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {TRUST_POINTS.map((t) => (
            <div
              key={t.title}
              className="bg-white/5 backdrop-blur border border-white/10 rounded-3xl p-8 hover:bg-white/8 hover:border-white/20 transition-all duration-300"
            >
              <div className="flex items-start gap-5">
                {/* Icon */}
                <div className="w-14 h-14 rounded-2xl bg-white/8 border border-white/10 flex items-center justify-center text-3xl shrink-0">
                  {t.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <h3 className="font-[family-name:var(--font-display)] text-white text-xl">{t.title}</h3>
                    <span className={`text-[10px] font-bold uppercase tracking-wider border px-2 py-0.5 rounded-full ${t.badgeColor}`}>
                      {t.badge}
                    </span>
                  </div>
                  <p className="text-white/55 text-sm leading-relaxed">{t.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Certification strip */}
        <div className="mt-12 bg-white/5 border border-white/10 rounded-2xl px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔐</span>
            <div>
              <p className="text-white font-semibold text-sm">Data never leaves India</p>
              <p className="text-white/45 text-xs">Hosted on Indian servers · DPDP Act compliant</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">👶</span>
            <div>
              <p className="text-white font-semibold text-sm">COPPA-aware design</p>
              <p className="text-white/45 text-xs">No child data collected beyond what&apos;s essential</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">💬</span>
            <div>
              <p className="text-white font-semibold text-sm">Questions? We answer.</p>
              <p className="text-white/45 text-xs">hello@herokidsuniverse.com</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
