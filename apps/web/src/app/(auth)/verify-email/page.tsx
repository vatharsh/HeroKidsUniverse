"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, type FormEvent, useEffect, useState } from "react";

import Logo from "@/components/shared/Logo";
import { ApiError, useAuth } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";

function VerifyEmailInner() {
  const { user, loading, refreshUser, logout } = useAuth();
  const router = useRouter();
  const next = useSearchParams().get("next");
  const destination = next && next.startsWith("/") ? next : "/dashboard";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  // Signed out → sign in first; already verified → carry on.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?redirect=${encodeURIComponent(`/verify-email?next=${destination}`)}`);
    else if (!user.emailVerificationRequired) router.replace(destination);
  }, [loading, user, router, destination]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await authApi.verifyEmail(code);
      await refreshUser();
      router.replace(destination);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resend() {
    setError("");
    setInfo("");
    try {
      const res = await authApi.resendVerification();
      setInfo("We've sent a new code. Check your inbox (and the spam folder).");
      setCooldown(res.resendInSeconds || 60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't send a new code. Please try again.");
    }
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-16">
      <div className="bg-white rounded-3xl shadow-card w-full max-w-md p-8 sm:p-10">
        <div className="flex justify-center mb-6">
          <Logo iconSize={72} animated={false} />
        </div>

        <h1 className="font-[family-name:var(--font-display)] text-ink text-3xl text-center mb-2">Check your email</h1>
        <p className="text-ink-muted text-sm text-center mb-8">
          We sent a 6-digit code to <strong className="text-ink">{user?.email ?? "your email"}</strong>. Enter it below to
          finish setting up your account.
        </p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>}
        {info && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-5">{info}</div>}

        <form className="flex flex-col gap-5" onSubmit={handleSubmit}>
          <label className="sr-only" htmlFor="code">Verification code</label>
          <input
            id="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="••••••"
            className="w-full text-center text-3xl tracking-[0.5em] font-bold px-4 py-4 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition"
          />
          <button
            type="submit"
            disabled={submitting || code.length !== 6}
            className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-full transition-all shadow-brand"
          >
            {submitting ? "Checking…" : "Verify email →"}
          </button>
        </form>

        <div className="text-center text-sm text-ink-mid mt-6 space-y-2">
          <p>
            Didn&apos;t get it?{" "}
            {cooldown > 0 ? (
              <span className="text-ink-muted">Send a new code in {cooldown}s</span>
            ) : (
              <button type="button" onClick={resend} className="text-brand font-semibold hover:underline">
                Send a new code
              </button>
            )}
          </p>
          <p>
            Wrong email?{" "}
            <button type="button" onClick={() => void logout().then(() => router.replace("/register"))} className="text-brand font-semibold hover:underline">
              Sign up again
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}
