"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import Logo from "@/components/shared/Logo";
import { ApiError, useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const me = await login(email, password);
      router.push(
        me.role === "admin"
          ? "/admin"
          : me.role === "influencer"
          ? "/influencer/dashboard"
          : "/dashboard",
      );
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

        <div className="bg-gold-light/30 border border-gold/30 rounded-2xl p-4 text-center mb-6">
          <p className="text-xl mb-1">👋 Are you a parent?</p>
          <p className="text-ink-mid text-sm">
            Only parents &amp; guardians have accounts here.
            Kids just get to be the <strong className="text-brand">hero</strong>! 🦸
          </p>
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-ink text-3xl text-center mb-2">
          Welcome back
        </h1>
        <p className="text-ink-muted text-sm text-center mb-8">
          Sign in to continue creating stories
        </p>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
            {error}
          </div>
        )}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
            />
            <a href="/forgot-password" className="text-brand text-xs hover:underline block text-right mt-1">
              Forgot password?
            </a>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all hover:scale-[1.02] shadow-brand"
          >
            {loading ? "Signing in…" : "Sign In →"}
          </button>

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
