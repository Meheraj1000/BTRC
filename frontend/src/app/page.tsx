"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { LanguageToggle, useI18n } from "@/lib/i18n";

export default function HomePage() {
  const { t } = useI18n();
  return (
    <div className="min-h-[100dvh] bg-ink-950 text-slate-100">
      <section className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden px-4 py-12 pt-[max(3rem,env(safe-area-inset-top))] pb-[max(3rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-16">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(ellipse 80% 60% at 20% 30%, rgb(0 103 71 / 0.55), transparent 55%), radial-gradient(ellipse 50% 40% at 85% 70%, rgb(42 155 106 / 0.25), transparent 50%), linear-gradient(165deg, #07111c 0%, #0b1f33 50%, #062819 100%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255 / 0.35) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.35) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="relative mx-auto w-full max-w-5xl">
          <div className="mb-4 flex justify-end">
            <LanguageToggle invert />
          </div>
          <div className="animate-fade-up origin-left scale-100 sm:scale-110 md:scale-125">
            <BrandMark invert subtitle={t("Bangladesh · National transport safety")} href="/" />
          </div>
          <h1 className="animate-fade-up animate-delay-1 font-display mt-8 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:mt-10 sm:text-5xl md:text-6xl">
            Nirapad Transit
          </h1>
          <p className="animate-fade-up animate-delay-2 mt-4 max-w-xl text-base text-slate-300 sm:mt-5 sm:text-lg md:text-xl">
            {t("Find a bus, follow a route, or ask for help.")}
          </p>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
            {t("This is a practice system for learning how public transport safety works in Bangladesh. It is not a live government service.")}
          </p>
          <div className="animate-fade-in animate-delay-2 mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link href="/login" className="btn btn-primary w-full px-6 py-3 text-base sm:w-auto">
              {t("Sign in")}
            </Link>
            <Link
              href="/register"
              className="btn w-full border border-white/25 bg-transparent px-6 py-3 text-base text-white hover:bg-white/10 sm:w-auto"
            >
              {t("Create a passenger account")}
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0a1826] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-sm leading-relaxed text-amber-100 sm:px-4">
            {t("Practice system. Bus locations are simulated. For a real emergency, call 999.")}
          </p>
          <h2 className="font-display mt-10 text-xl font-semibold tracking-tight text-white sm:mt-12 sm:text-2xl">{t("What do you want to do?")}</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              ["/register", "I am a passenger", "See buses near you, scan the code on a bus, and report a problem.", "Create a passenger account"],
              ["/register/driver", "I drive a bus", "Create an account, then see your bus, your route, and today's trip.", "Driver register"],
              ["/login", "I already have an account", "On the sign-in page, choose a role. The practice password is filled in for you.", "Sign in"],
            ].map(([href, title, body, action]) => (
              <Link key={href + title} href={href} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:border-white/30 hover:bg-white/10">
                <div className="font-display text-lg font-semibold text-white">{t(title)}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{t(body)}</p>
                <span className="mt-4 inline-block text-sm font-semibold text-brand-400">{t(action)}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
