export default function CTABanner() {
  return (
    <section className="relative overflow-hidden bg-brand-gradient py-24">
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl pointer-events-none z-0" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-black/10 rounded-full blur-3xl pointer-events-none z-0" />

      <div className="relative z-10 max-w-3xl mx-auto px-6 text-center">
        <h2 className="font-[family-name:var(--font-display)] font-black text-white text-4xl md:text-5xl mb-4">
          Every Child Deserves to Be a Hero
        </h2>
        <p className="text-white/70 text-lg mb-8">
          Join parents creating magical memories their children will treasure forever.
        </p>
        <a
          href="/create"
          className="bg-white text-brand hover:bg-gold hover:text-white font-bold px-10 py-4 rounded-full text-lg transition-all hover:scale-105 shadow-lg inline-block"
        >
          Create Your Hero&apos;s Story →
        </a>
      </div>
    </section>
  );
}
