"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Bell, LogOut, Menu, X } from "lucide-react";
import { BrandMark } from "@/components/BrandMark";
import { homeFor, useAuth } from "@/lib/auth";
import { notificationsPathFor } from "@/lib/inbox";
import { LanguageToggle, useI18n } from "@/lib/i18n";
import { NAV, primaryRole } from "@/lib/nav";
import type { RoleCode } from "@/lib/types";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";

const ROLE_LABEL: Record<RoleCode, string> = {
  SUPER_ADMIN: "Super Admin",
  GOVERNMENT: "Government",
  BRTA: "BRTA",
  POLICE: "Police",
  TRANSPORT_OWNER: "Operator",
  DRIVER: "Driver",
  PASSENGER: "Passenger",
};

export function AppShell({
  allow,
  title,
  children,
}: {
  allow: RoleCode[];
  title: string;
  children: React.ReactNode;
}) {
  const { user, loading, logout, hasRole } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      const next =
        pathname && pathname.startsWith("/") && !pathname.startsWith("//")
          ? `?next=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/login${next}`);
      return;
    }
    if (!hasRole(...allow)) {
      router.replace(homeFor(user.roles));
    }
  }, [user, loading, allow, hasRole, router, pathname]);

  useEffect(() => {
    if (!user) return;
    const refreshUnread = () => {
      api<Array<{ readAt: string | null; type?: string; title?: string; body?: string; payload?: unknown }>>("/notifications")
        .then((items) => setUnread(items.filter((n) => !n.readAt).length))
        .catch(() => undefined);
    };
    refreshUnread();
    const socket = getSocket();
    socket.on("notification:new", refreshUnread);
    return () => {
      socket.off("notification:new", refreshUnread);
    };
  }, [user]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("nav-open", open);
    return () => document.body.classList.remove("nav-open");
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (loading || !user || !hasRole(...allow)) {
    return (
      <div className="grid min-h-[100dvh] place-items-center gap-3 bg-[var(--background)] px-4">
        <div className="spinner" aria-hidden />
        <p className="text-sm text-[var(--text-muted)]">{t("Loading session…")}</p>
      </div>
    );
  }

  const role = primaryRole(user.roles);
  const items = NAV[role] ?? [];

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[var(--background)]">
      <div className="brand-banner shrink-0 px-3 py-1.5 text-center text-[10px] font-medium leading-snug tracking-wide sm:px-4 sm:text-[11px]">
        {t("DEMO / SIMULATION — Not connected to a live government API or physical GPS device.")}
      </div>
      <div className="flex min-h-0 flex-1">
        {open && (
          <button
            type="button"
            className="fixed inset-0 z-20 bg-ink-950/45 md:hidden"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
        )}
        <aside
          className={`${open ? "translate-x-0" : "-translate-x-full"} fixed inset-y-0 left-0 z-30 flex w-[min(18rem,88vw)] flex-col bg-ink-900 pl-[env(safe-area-inset-left)] text-slate-100 shadow-2xl transition duration-200 ease-out md:static md:inset-auto md:h-full md:w-64 md:max-w-none md:translate-x-0 md:pl-0 md:shadow-none md:self-stretch`}
        >
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-white/10 px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-4 sm:py-4">
            <BrandMark invert subtitle={t(ROLE_LABEL[role])} href={homeFor(user.roles)} />
            <button type="button" className="rounded-lg p-2 text-slate-300 md:hidden" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-2 py-3 pb-[max(2rem,env(safe-area-inset-bottom))] sm:px-3 sm:py-4" aria-label="Primary">
            <p className="section-label mb-2 px-3 text-slate-500">{t("Navigation")}</p>
            {items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-link ${active ? "nav-link-active" : "nav-link-idle"}`}
                >
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>
        </aside>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <header className="z-10 flex shrink-0 items-center justify-between gap-2 border-b border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 sm:px-4 sm:py-3">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button type="button" className="icon-btn shrink-0 md:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <h1 className="font-display truncate text-base font-semibold tracking-tight sm:text-lg md:text-xl">{t(title)}</h1>
                <p className="truncate text-[11px] text-[var(--text-muted)] sm:text-xs">Asia/Dhaka · BDT · {user.fullName}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <LanguageToggle />
              <Link
                href={notificationsPathFor(user.roles)}
                className="icon-btn"
                aria-label={unread > 0 ? `${unread} ${t("Notifications")}` : t("Notifications")}
              >
                <Bell className="h-4 w-4" />
                {unread > 0 && (
                  <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--error)] px-1 text-[10px] font-semibold text-white">
                    {unread > 99 ? "99+" : unread}
                  </span>
                )}
              </Link>
              <button className="btn btn-ghost px-2.5 sm:px-4" onClick={() => logout()}>
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{t("Sign out")}</span>
              </button>
            </div>
          </header>
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-4 md:p-6">
            <div className="mx-auto w-full max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
