import Logo from "@/components/shared/Logo";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-16 relative">
      <a
        href="/"
        className="absolute top-6 left-6 text-ink-muted hover:text-brand text-sm transition"
      >
        ← Back to Home
      </a>

      <div className="bg-white rounded-3xl shadow-card w-full max-w-md p-10">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <Logo />
        </div>

        {/* Parent-only fun banner */}
        <div className="bg-brand-50 border border-brand/20 rounded-2xl p-4 text-center mb-6">
          <p className="text-2xl mb-1">🦸 Hey there, superhero parent!</p>
          <p className="text-ink-mid text-sm leading-relaxed">
            This is a grown-ups zone. Kids get to be the <strong className="text-brand">heroes</strong> —
            parents do the sign-up. 😄
          </p>
        </div>

        <h1 className="font-[family-name:var(--font-display)] font-black text-ink text-3xl text-center mb-2">
          Join HeroVerse Kids
        </h1>
        <p className="text-ink-muted text-sm text-center mb-8">
          Start creating magical stories for your child today
        </p>

        <form className="flex flex-col gap-5">
          <div>
            <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="name">
              Your name <span className="text-ink-muted font-normal">(parent / guardian)</span>
            </label>
            <input
              id="name"
              type="text"
              placeholder="e.g. Priya Sharma"
              className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            />
          </div>

          <div>
            <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            />
          </div>

          <div>
            <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            />
            <p className="text-ink-muted text-xs mt-1">At least 8 characters</p>
          </div>

          <div>
            <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="referral">
              Referral code <span className="text-ink-muted font-normal">(optional)</span>
            </label>
            <input
              id="referral"
              type="text"
              placeholder="Have a referral code?"
              className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            />
            <p className="text-ink-muted text-xs mt-1">
              Enter a friend&apos;s code to get bonus credits
            </p>
          </div>

          <button
            type="submit"
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-full transition-all hover:scale-[1.02] shadow-brand"
          >
            Create Free Account →
          </button>
        </form>

        <p className="text-center text-sm text-ink-mid mt-6">
          Already have an account?{" "}
          <a href="/login" className="text-brand font-semibold hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
