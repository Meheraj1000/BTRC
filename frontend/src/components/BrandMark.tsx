"use client";

import Link from "next/link";
import { Shield } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function BrandMark({
  invert = false,
  compact = false,
  subtitle,
  href,
}: {
  invert?: boolean;
  compact?: boolean;
  subtitle?: string;
  /** When set, the mark is a navigable link (home / landing). */
  href?: string;
}) {
  const { t } = useI18n();

  const inner = (
    <>
      <span
        className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
          invert ? "bg-white/10" : "bg-[var(--surface-secondary)]"
        }`}
      >
        <Shield className={`h-5 w-5 ${invert ? "text-brand-400" : "text-brand-600"}`} aria-hidden />
      </span>
      {!compact && (
        <div className="min-w-0">
          <div className={`font-display truncate text-base font-semibold leading-tight tracking-tight ${invert ? "text-white" : "text-ink-900"}`}>
            {t("Nirapad Transit")}
          </div>
          {subtitle && (
            <div className={`truncate text-[11px] font-medium ${invert ? "text-slate-400" : "text-[var(--text-muted)]"}`}>
              {subtitle}
            </div>
          )}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none transition hover:opacity-90 focus-visible:ring-2 focus-visible:ring-brand-500"
        aria-label={t("Nirapad Transit home")}
      >
        {inner}
      </Link>
    );
  }

  return <div className="flex min-w-0 items-center gap-2.5">{inner}</div>;
}
