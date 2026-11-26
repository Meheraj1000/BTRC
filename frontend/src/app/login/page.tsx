"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { homeFor, useAuth } from "@/lib/auth";
import { AuthLoading, LanguageToggle, useI18n } from "@/lib/i18n";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

const DEMOS: Array<[string, string, string]> = [
  ["admin@nirapad.gov.bd", "Super Admin", "You can open every part of the system."],
  ["government@nirapad.gov.bd", "Government", "You can watch buses and emergencies across the country."],
  ["brta@nirapad.gov.bd", "BRTA", "You can check fitness certificates, licenses, and violations."],
  ["police@nirapad.gov.bd", "Police · Dhaka", "You can look up a bus and respond to emergencies in Dhaka."],
  ["police.ctg@nirapad.gov.bd", "Police · Chattogram", "You can look up a bus and respond to emergencies in Chattogram."],
  ["police.sylhet@nirapad.gov.bd", "Police · Sylhet", "You can look up a bus and respond to emergencies in Sylhet."],
  ["police.rajshahi@nirapad.gov.bd", "Police · Rajshahi", "You can look up a bus and respond to emergencies in Rajshahi."],
  ["police.khulna@nirapad.gov.bd", "Police · Khulna", "You can look up a bus and respond to emergencies in Khulna."],
  ["owner.greenline@demo.bd", "Bus owner", "You can see your company's buses, drivers, and complaints."],
  ["driver.rahim@demo.bd", "Driver", "You can see your bus, your route, and today's trip."],
  ["passenger.fatima@demo.bd", "Passenger", "You can find a bus, scan its code, and ask for help."],
];

function LoginForm() {
  const { login } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const search = useSearchParams();
  const next = safeNext(search.get("next"));
  const [email, setEmail] = useState("admin@nirapad.gov.bd");
  const [password, setPassword] = useState("Demo@12345");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const selected = DEMOS.find(([address]) => address === email);

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
        <div className="mb-4 flex justify-end">
          <LanguageToggle invert />
        </div>
        <div className="mb-6 flex justify-center">
          <BrandMark invert subtitle={t("Bangladesh · Safe public transport")} href="/" />
        </div>
        <div className="brand-banner mb-4 rounded-xl px-3 py-2 text-sm leading-relaxed">
          {t("Practice password for every sample account:")} <strong>Demo@12345</strong>
        </div>
        <form onSubmit={onSubmit} className="auth-panel" noValidate>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{t("Sign in")}</h1>
          <p className="mt-1 text-sm leading-relaxed text-[var(--text-muted)]">
            {t("Choose a role below, then press Sign in. The practice password is already filled in.")}
          </p>
          <label className="mt-5 block text-sm font-medium" htmlFor="login-email">{t("Email")}</label>
          <input
            id="login-email"
            className="input mt-1"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="text"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            required
          />
          <label className="mt-3 block text-sm font-medium" htmlFor="login-password">{t("Password")}</label>
          <div className="relative mt-1">
            <input
              id="login-password"
              className="input pr-28"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "login-error" : undefined}
              required
            />
            <button
              type="button"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-[var(--surface-secondary)]"
              aria-pressed={showPassword}
              onClick={() => setShowPassword((value) => !value)}
            >
              {showPassword ? t("Hide password") : t("Show password")}
            </button>
          </div>
          {error && (
            <p id="login-error" className="mt-3 rounded-lg bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]" role="alert">
              {t(error)}
            </p>
          )}
          <button className="btn btn-primary mt-5 w-full" disabled={busy}>
            {busy ? t("Signing in…") : t("Sign in")}
          </button>
          <p className="mt-3 text-center text-sm text-[var(--text-muted)]">
            <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">
              {t("Passenger register")}
            </Link>
            {" · "}
            <Link href="/register/driver" className="font-semibold text-brand-600 hover:text-brand-700">
              {t("Driver register")}
            </Link>
          </p>
        </form>
        <div className="mt-4 rounded-2xl border border-white/15 bg-white/95 p-4 text-xs text-[var(--text-secondary)]">
          <div className="mb-2 font-semibold text-[var(--text-primary)]">{t("Demo accounts")}</div>
          <div className="flex flex-wrap gap-2">
            {DEMOS.map(([address, role]) => (
              <button
                key={address}
                type="button"
                aria-pressed={email === address}
                className={`rounded-full border px-2.5 py-1 transition ${
                  email === address
                    ? "border-brand-600 bg-[var(--surface-secondary)] text-brand-700"
                    : "border-[var(--border)] hover:border-brand-600 hover:text-brand-700"
                }`}
                onClick={() => setEmail(address)}
              >
                {t(role)}
              </button>
            ))}
          </div>
          {selected && <p className="mt-3 text-sm leading-relaxed text-[var(--text-secondary)]">{t(selected[2])}</p>}
          <p className="mt-2 text-[var(--text-muted)]">{email}</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthLoading />}>
      <LoginForm />
    </Suspense>
  );
}
