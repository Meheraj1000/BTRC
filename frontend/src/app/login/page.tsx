"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { homeFor, useAuth } from "@/lib/auth";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

const DEMOS = [
  ["admin@nirapad.gov.bd", "Super Admin"],
  ["government@nirapad.gov.bd", "Government"],
  ["brta@nirapad.gov.bd", "BRTA"],
  ["police@nirapad.gov.bd", "Police"],
  ["owner.greenline@demo.bd", "Bus owner"],
  ["driver.rahim@demo.bd", "Driver"],
  ["passenger.fatima@demo.bd", "Passenger"],
];

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  const [email, setEmail] = useState("admin@nirapad.gov.bd");
  const [password, setPassword] = useState("Demo@12345");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const user = await login(email, password);
      router.push(next ?? homeFor(user.roles));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <div className="w-full max-w-md animate-fade-up px-0">
        <div className="mb-6 flex justify-center">
          <BrandMark invert subtitle="Bangladesh · Safe public transport" href="/" />
        </div>
        <div className="brand-banner mb-4 rounded-xl px-3 py-2 text-xs">
          Demo password for all seeded accounts: <strong>Demo@12345</strong>
        </div>
        <form onSubmit={onSubmit} className="auth-panel">
          <h1 className="font-display text-2xl font-semibold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Role-based access for the national transport command demo.
          </p>
          <label className="mt-5 block text-sm font-medium" htmlFor="login-email">Email</label>
          <input
            id="login-email"
            className="input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="username"
            required
          />
          <label className="mt-3 block text-sm font-medium" htmlFor="login-password">Password</label>
          <input
            id="login-password"
            className="input mt-1"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            autoComplete="current-password"
            required
          />
          {error && (
            <p className="mt-3 rounded-lg bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]" role="alert">
              {error}
            </p>
          )}
          <button className="btn btn-primary mt-5 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
          <p className="mt-3 text-center text-sm text-[var(--text-muted)]">
            Passenger?{" "}
            <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              Create an account
            </Link>
          </p>
        </form>
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/95 p-4 text-xs text-[var(--text-secondary)]">
          <div className="mb-2 font-semibold text-[var(--text-primary)]">Demo accounts</div>
          <div className="flex flex-wrap gap-2">
            {DEMOS.map(([e, r]) => (
              <button
                key={e}
                type="button"
                className={`rounded-full border px-2.5 py-1 transition ${
                  email === e
                    ? "border-brand-600 bg-[var(--surface-secondary)] text-brand-700"
                    : "border-[var(--border)] hover:border-brand-600 hover:text-brand-700"
                }`}
                onClick={() => setEmail(e)}
              >
                {r}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[var(--text-muted)]">{email}</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="auth-shell text-sm text-slate-300">Loading…</div>}>
      <LoginForm />
    </Suspense>
  );
}
