"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import Logo from "@/components/shared/Logo";
import { ApiError, useAuth } from "@/contexts/AuthContext";

export default function RegisterPage() {
  const { register } = useAuth();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(name, email, password, referralCode || undefined);
      router.push("/onboarding");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-16 relative">
      <a href="/" className="absolute top-6 left-6 text-ink-muted hover:text-brand text-sm transition">
        ← Back to Home
      </a>

      <div className="bg-white rounded-3xl shadow-card w-full max-w-md p-10">
        <div className="flex justify-center mb-8">
          <Logo iconSize={80} animated={false} />
        </div>

        <div className="bg-brand-50 border border-brand/20 rounded-2xl p-4 text-center mb-6">
          <p className="text-2xl mb-1">🦸 Hey there, superhero parent!</p>
          <p className="text-ink-mid text-sm leading-relaxed">
            This is a grown-ups zone. Kids get to be the <strong className="text-brand">heroes</strong> —
            parents do the sign-up. 😄
          </p>
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-ink text-3xl text-center mb-2">
          Join Hero Kids Universe
        </h1>
        <p className="text-ink-muted text-sm text-center mb-8">
          Start creating magical stories for your child today
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <div>
            <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="name">
              Your name <span className="text-ink-muted font-normal">(parent / guardian)</span>
            </label>
            <input
              id="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
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
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
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
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
              value={referralCode}
              onChange={(e) => setReferralCode(e.target.value)}
              placeholder="Have a referral code?"
              className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            />
            <p className="text-ink-muted text-xs mt-1">Enter a friend&apos;s code to get bonus credits</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all hover:scale-[1.02] shadow-brand"
          >
            {loading ? "Creating account…" : "Create Free Account →"}
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
