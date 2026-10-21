"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

import Logo from "@/components/shared/Logo";
import { ApiError } from "@/contexts/AuthContext";
import { authApi } from "@/lib/api";

const inputClass =
  "w-full px-4 py-3 rounded-xl border border-ink/15 bg-cream text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"email" | "reset">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await authApi.forgotPassword(email);
      setInfo(res.message);
      setStep("reset");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authApi.resetPassword({ email, code, newPassword: password });
      router.push("/login?reset=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-cream flex flex-col items-center justify-center px-4 py-16 relative">
      <a href="/login" className="absolute top-6 left-6 text-ink-muted hover:text-brand text-sm transition">
        ← Back to sign in
      </a>
      <div className="bg-white rounded-3xl shadow-card w-full max-w-md p-8 sm:p-10">
        <div className="flex justify-center mb-6">
          <Logo iconSize={72} animated={false} />
        </div>
        <h1 className="font-[family-name:var(--font-display)] text-ink text-3xl text-center mb-2">Reset your password</h1>
        <p className="text-ink-muted text-sm text-center mb-8">
          {step === "email"
            ? "Enter your account email and we'll send you a 6-digit code."
            : "Enter the code from the email and choose a new password."}
        </p>

        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>}
        {info && step === "reset" && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-5">{info}</div>}

        {step === "email" ? (
          <form className="flex flex-col gap-5" onSubmit={sendCode}>
            <div>
              <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="email">Email address</label>
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={inputClass} />
            </div>
            <button type="submit" disabled={busy} className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold py-3.5 rounded-full transition-all shadow-brand">
              {busy ? "Sending…" : "Send code →"}
            </button>
          </form>
        ) : (
          <form className="flex flex-col gap-5" onSubmit={reset}>
            <div>
              <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="code">6-digit code</label>
              <input
                id="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className={`${inputClass} text-center text-2xl tracking-[0.4em] font-bold`}
              />
            </div>
            <div>
              <label className="text-ink-mid text-sm font-medium block mb-1.5" htmlFor="password">New password</label>
              <input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
              <p className="text-ink-muted text-xs mt-1">At least 8 characters</p>
            </div>
            <button type="submit" disabled={busy || code.length !== 6} className="w-full bg-brand hover:bg-brand-dark disabled:opacity-60 text-white font-bold py-3.5 rounded-full transition-all shadow-brand">
              {busy ? "Saving…" : "Set new password →"}
            </button>
            <button type="button" onClick={() => { setStep("email"); setCode(""); setInfo(""); }} className="text-brand text-sm font-semibold hover:underline">
              Didn&apos;t get a code? Send again
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
