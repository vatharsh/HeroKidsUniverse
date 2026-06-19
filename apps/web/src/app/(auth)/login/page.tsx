import Logo from "@/components/shared/Logo";

export default function LoginPage() {
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

        {/* Parent check banner */}
        <div className="bg-gold-light/30 border border-gold/30 rounded-2xl p-4 text-center mb-6">
          <p className="text-xl mb-1">👋 Are you a parent?</p>
          <p className="text-ink-mid text-sm">
            Only parents &amp; guardians have accounts here.
            Kids just get to be the <strong className="text-brand">hero</strong>! 🦸
          </p>
        </div>

        <h1 className="font-[family-name:var(--font-display)] font-black text-ink text-3xl text-center mb-2">
          Welcome back
        </h1>
        <p className="text-ink-muted text-sm text-center mb-8">
          Sign in to continue creating stories
        </p>

        <form className="flex flex-col gap-5">
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
            <a href="/forgot-password" className="text-brand text-xs hover:underline block text-right mt-1">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-3.5 rounded-full transition-all hover:scale-[1.02] shadow-brand"
          >
            Sign In →
          </button>

          <div className="flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-ink/10" />
            <span className="text-ink-muted text-xs">or</span>
            <div className="flex-1 h-px bg-ink/10" />
          </div>

          <p className="text-center text-sm text-ink-mid mt-2">
            Don&apos;t have an account?{" "}
            <a href="/register" className="text-brand font-semibold hover:underline">
              Create one free
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}
