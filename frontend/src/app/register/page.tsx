"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { useAuth } from "@/lib/auth";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await register({ fullName, email, phone, password });
      router.push(next ? `/login?next=${encodeURIComponent(next)}` : "/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form onSubmit={onSubmit} className="auth-panel animate-fade-up">
        <div className="mb-4">
          <BrandMark subtitle="Passenger registration" href="/" />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Create passenger account</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">Creates a passenger role account only.</p>
        <label className="mt-5 block text-sm font-medium" htmlFor="reg-name">Full name</label>
        <input id="reg-name" className="input mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
        <label className="mt-3 block text-sm font-medium" htmlFor="reg-email">Email</label>
        <input id="reg-email" className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label className="mt-3 block text-sm font-medium" htmlFor="reg-phone">Phone</label>
        <input id="reg-phone" className="input mt-1" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label className="mt-3 block text-sm font-medium" htmlFor="reg-password">Password</label>
        <input
          id="reg-password"
          className="input mt-1"
          type="password"
          placeholder="Minimum 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        {error && (
          <p className="mt-3 rounded-lg bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]" role="alert">
            {error}
          </p>
        )}
        <button className="btn btn-primary mt-5 w-full" disabled={busy}>
          {busy ? "Creating…" : "Create account"}
        </button>
        <p className="mt-3 text-center text-sm">
          <Link
            href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
            className="font-semibold text-brand-600 hover:text-brand-700"
          >
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="auth-shell text-sm text-slate-300">Loading…</div>}>
      <RegisterForm />
    </Suspense>
  );
}
