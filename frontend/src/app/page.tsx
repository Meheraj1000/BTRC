import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";

export default function HomePage() {
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
          <div className="animate-fade-up origin-left scale-100 sm:scale-110 md:scale-125">
            <BrandMark invert subtitle="Bangladesh · National transport safety" href="/" />
          </div>
          <h1 className="animate-fade-up animate-delay-1 font-display mt-8 max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight sm:mt-10 sm:text-5xl md:text-6xl">
            Nirapad Transit
          </h1>
          <p className="animate-fade-up animate-delay-2 mt-4 max-w-xl text-base text-slate-300 sm:mt-5 sm:text-lg md:text-xl">
            Safe public transport monitoring for Bangladesh — GPS tracking, compliance, and emergency workflows in one civic platform.
          </p>
          <div className="animate-fade-in animate-delay-2 mt-8 flex w-full flex-col gap-3 sm:mt-10 sm:w-auto sm:flex-row sm:flex-wrap">
            <Link href="/login" className="btn btn-primary w-full px-6 py-3 text-base sm:w-auto">
              Sign in
            </Link>
            <Link
              href="/register"
              className="btn w-full border border-white/25 bg-transparent px-6 py-3 text-base text-white hover:bg-white/10 sm:w-auto"
            >
              Passenger register
            </Link>
            <Link
              href="/register/driver"
              className="btn w-full border border-white/25 bg-transparent px-6 py-3 text-base text-white hover:bg-white/10 sm:w-auto"
            >
              Driver register
            </Link>
          </div>
        </div>
      </section>

      <section className="border-t border-white/10 bg-[#0a1826] px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-5xl">
          <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-3 text-xs text-amber-100 sm:px-4 sm:text-sm">
            Research / FYDP prototype. GPS is simulated unless a real device feed is configured. Demo accounts are not government credentials.
          </p>
          <h2 className="font-display mt-10 text-xl font-semibold tracking-tight text-white sm:mt-12 sm:text-2xl">Who it serves</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-400">One national brand across passenger, operator, and authority experiences.</p>
          <div className="mt-8 grid gap-6 sm:gap-8 md:grid-cols-3">
            {[
              ["Passengers", "Nearby buses, live map, route search, SOS, and complaints."],
              ["Operators & drivers", "Fleet, assignments, trips, GPS sharing, and alerts."],
              ["Authorities", "Government, BRTA, and police monitoring with role-based access."],
            ].map(([title, body]) => (
              <div key={title} className="border-l-2 border-brand-400 pl-4">
                <div className="font-display text-lg font-semibold text-white">{title}</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
