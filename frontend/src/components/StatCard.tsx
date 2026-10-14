export function StatCard({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="absolute inset-y-0 left-0 w-1 bg-brand-600" aria-hidden />
      <div className="pl-2">
        <div className="section-label">{label}</div>
        <div className="font-display mt-1 text-2xl font-semibold tracking-tight text-ink-900">{value}</div>
        {hint && <div className="mt-1 text-xs text-[var(--text-muted)]">{hint}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="card p-10 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-secondary)] text-brand-600" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      </div>
      <div className="font-display text-base font-semibold">{title}</div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{body}</p>
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div
      className="rounded-xl border px-4 py-3 text-sm"
      style={{ borderColor: "var(--error)", background: "var(--error-bg)", color: "var(--error)" }}
      role="alert"
    >
      {message}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "yellow" | "red" | "teal" }) {
  const map = {
    slate: "bg-[var(--surface-secondary)] text-[var(--text-secondary)]",
    green: "bg-[var(--success-bg)] text-[var(--success)]",
    yellow: "bg-[var(--warning-bg)] text-[var(--warning)]",
    red: "bg-[var(--error-bg)] text-[var(--error)]",
    teal: "bg-[var(--info-bg)] text-[var(--info)]",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>
      {children}
    </span>
  );
}
