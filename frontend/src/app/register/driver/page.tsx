"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { api } from "@/lib/api";
import { LanguageToggle, useI18n } from "@/lib/i18n";

type CompanyOpt = { id: string; name: string; city?: string | null };

export default function DriverRegisterPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [companies, setCompanies] = useState<CompanyOpt[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [experienceYears, setExperienceYears] = useState("0");
  const [companyId, setCompanyId] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<CompanyOpt[]>("/public/companies")
      .then(setCompanies)
      .catch(() => setCompanies([]));
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setDone("");
    try {
      const result = await api<{ message?: string }>("/auth/register-driver", {
        method: "POST",
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          password,
          licenseNumber: licenseNumber.trim(),
          licenseExpiry: licenseExpiry || null,
          experienceYears: Number(experienceYears) || 0,
          companyId: companyId || null,
        }),
      });
      setDone(
        result.message
          || "Registration submitted. A Super Admin must review and accept your application before you can sign in.",
      );
      window.setTimeout(() => router.push("/login"), 3500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <form onSubmit={onSubmit} className="auth-panel animate-fade-up max-w-lg">
        <div className="mb-4 flex items-start justify-between gap-3">
          <BrandMark subtitle={t("Driver self-registration")} href="/" />
          <LanguageToggle />
        </div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">{t("Register as a driver")}</h1>
        <p className="mt-1 text-sm text-[var(--text-muted)]">
          {t("Submit your details for Super Admin review. You cannot sign in until the registration is accepted.")}
        </p>

        <label className="mt-5 block text-sm font-medium" htmlFor="drv-name">{t("Full name")}</label>
        <input id="drv-name" className="input mt-1" value={fullName} onChange={(e) => setFullName(e.target.value)} required minLength={2} />

        <label className="mt-3 block text-sm font-medium" htmlFor="drv-email">{t("Email")}</label>
        <input id="drv-email" className="input mt-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label className="mt-3 block text-sm font-medium" htmlFor="drv-phone">{t("Phone (01XXXXXXXXX)")}</label>
        <input
          id="drv-phone"
          className="input mt-1"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          pattern="01[3-9][0-9]{8}"
          title="Bangladesh mobile: 01XXXXXXXXX"
          placeholder="01712345678"
        />

        <label className="mt-3 block text-sm font-medium" htmlFor="drv-password">{t("Password")}</label>
        <input
          id="drv-password"
          className="input mt-1"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
          placeholder={t("Minimum 8 characters")}
        />

        <label className="mt-3 block text-sm font-medium" htmlFor="drv-license">{t("Driving license number")}</label>
        <input
          id="drv-license"
          className="input mt-1"
          value={licenseNumber}
          onChange={(e) => setLicenseNumber(e.target.value)}
          required
          minLength={4}
          placeholder={t("e.g. DHAKA-DL-12345")}
        />

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-medium" htmlFor="drv-expiry">
            {t("License expiry")}
            <input
              id="drv-expiry"
              className="input mt-1"
              type="date"
              value={licenseExpiry}
              onChange={(e) => setLicenseExpiry(e.target.value)}
            />
          </label>
          <label className="block text-sm font-medium" htmlFor="drv-exp">
            {t("Experience (years)")}
            <input
              id="drv-exp"
              className="input mt-1"
              type="number"
              min={0}
              max={60}
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
            />
          </label>
        </div>

        <label className="mt-3 block text-sm font-medium" htmlFor="drv-company">{t("Preferred operator (optional)")}</label>
        <select id="drv-company" className="input mt-1" value={companyId} onChange={(e) => setCompanyId(e.target.value)}>
          <option value="">{t("Select later / Super Admin will assign")}</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}{c.city ? ` · ${c.city}` : ""}
            </option>
          ))}
        </select>

        {error && (
          <p className="mt-3 rounded-lg bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]" role="alert">
            {t(error)}
          </p>
        )}
        {done && (
          <p className="mt-3 rounded-lg px-3 py-2 text-sm" style={{ background: "var(--success-bg)", color: "var(--success)" }} role="status">
            {t(done)}
          </p>
        )}

        <button className="btn btn-primary mt-5 w-full" disabled={busy || Boolean(done)} type="submit">
          {busy ? t("Submitting…") : t("Submit for review")}
        </button>
        <p className="mt-3 text-center text-sm text-[var(--text-muted)]">
          {t("Already registered?")}{" "}
          <Link href="/login" className="font-semibold text-brand-600 hover:text-brand-700">{t("Sign in")}</Link>
          {" · "}
          <Link href="/register" className="font-semibold text-brand-600 hover:text-brand-700">{t("Passenger register")}</Link>
        </p>
      </form>
    </div>
  );
}
