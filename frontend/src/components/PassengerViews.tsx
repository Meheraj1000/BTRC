"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/map/LiveMap";
import { Badge, EmptyState, ErrorState, StatCard } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { isEmergencyComplaint } from "@/lib/inbox";
import type { AuthUser } from "@/lib/types";

type RouteRow = {
  id: string;
  code: string;
  name: string;
  city: string;
  startName: string;
  endName: string;
  status: string;
  assignedVehicleCount?: number;
  stops?: Array<{ id?: string; name: string; sequence: number; latitude: number; longitude: number }>;
  polyline?: Array<{ lat: number; lng: number }>;
  buses?: Array<{ id: string; registrationNo: string; operationalStatus: string }>;
};

type BusRow = {
  id: string;
  registrationNo: string;
  vehicleType?: string;
  operationalStatus?: string;
  trackingState?: string;
  company?: { name?: string | null } | null;
  route?: { id?: string; name?: string; code?: string } | null;
  driver?: { name?: string | null } | null;
  latestLoc?: { latitude?: number; longitude?: number; speed?: number; timestamp?: string } | null;
};

type ComplaintRow = {
  id: string;
  category: string;
  description: string;
  status: string;
  resolution?: string | null;
  createdAt: string;
  bus?: { registrationNo?: string } | null;
};

type NoteRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt?: string | null;
  createdAt: string;
};

export function PassengerHome() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [nearby, setNearby] = useState<Array<Record<string, unknown>>>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async (lat: number, lng: number) => {
      const [catalog, near] = await Promise.all([
        api<RouteRow[]>("/routes"),
        api<{ items: Array<Record<string, unknown>> }>(`/gps/nearby?lat=${lat}&lng=${lng}&radiusM=8000`),
      ]);
      setRoutes(Array.isArray(catalog) ? catalog : []);
      setNearby(near.items ?? []);
    };
    const fallback = () => load(23.7563, 90.3900);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => load(pos.coords.latitude, pos.coords.longitude).catch((e: Error) => setError(e.message)), () => fallback().catch((e: Error) => setError(e.message)));
    } else {
      fallback().catch((e: Error) => setError(e.message));
    }
    setLoading(false);
  }, []);

  const filtered = routes.filter((r) => {
    const hay = `${r.name} ${r.code} ${r.city} ${r.startName} ${r.endName}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Passenger home">
      {error && <ErrorState message={error} />}
      <p className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">{t("Passenger view only. GPS is SIMULATED. This is not a government or emergency dispatch service.")}</p>
      <section className="card mb-4 border-l-4 border-l-[var(--brand-primary)] p-4 sm:p-5">
        <h2 className="font-display text-base font-semibold tracking-tight">{t("Boarded a bus?")}</h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {t("Scan the QR on the vehicle to see bus and driver details, lodge a complaint, or report an emergency.")}
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <Link className="btn btn-primary" href="/passenger/scan">{t("Scan bus QR")}</Link>
          <Link className="btn btn-ghost" href="/passenger/complaints">{t("My complaints")}</Link>
        </div>
      </section>
      <div className="grid gap-4 lg:grid-cols-3">
        <StatCard label={t("Active routes")} value={routes.length} />
        <StatCard label={t("Nearby buses")} value={nearby.length} hint={t("SIMULATED positions")} />
        <StatCard label={t("Cities")} value={[...new Set(routes.map((r) => r.city))].length} />
      </div>
      <div className="toolbar my-4">
        <input className="input" aria-label={t("Filter routes")} placeholder={t("Filter routes on this page")} value={q} onChange={(e) => setQ(e.target.value)} />
        <Link className="btn btn-primary" href="/passenger/scan">{t("Scan bus QR")}</Link>
        <Link className="btn btn-ghost" href="/passenger/routes">{t("Search all routes")}</Link>
        <Link className="btn btn-ghost" href="/passenger/map">{t("Live map")}</Link>
      </div>
      {loading && !routes.length ? <p className="text-sm text-slate-500">{t("Loading…")}</p> : null}
      <h2 className="font-display mb-2 text-base font-semibold tracking-tight">{t("Nearby / trackable buses")}</h2>
      {!nearby.length ? <EmptyState title={t("No nearby buses")} body={t("No simulated positions are within 8 km of your location (or Dhaka fallback).")} /> : (
        <div className="mb-4 grid gap-3 md:grid-cols-2">
          {nearby.slice(0, 6).map((b) => (
            <Link key={String(b.busId)} href={`/passenger/buses/${String(b.busId)}`} className="card block p-4">
              <div className="font-semibold">{String(b.registrationNo ?? t("Bus"))}</div>
              <div className="text-sm text-slate-500">{String(b.routeName ?? t("Unassigned"))} · {String(b.trackingState ?? "ONLINE")} · {Number(b.speed).toFixed(0)} {t("km/h")}</div>
            </Link>
          ))}
        </div>
      )}
      <h2 className="font-display mb-2 text-base font-semibold tracking-tight">{t("Available routes")}</h2>
      {!filtered.length ? <EmptyState title={t("No routes")} body={t("No catalog routes match this filter.")} /> : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((r) => (
            <Link key={r.id} href={`/passenger/routes/${r.id}`} className="card block p-4">
              <div className="font-semibold">{r.name}</div>
              <div className="text-sm text-slate-500">{r.code} · {r.city} · {r.startName} → {r.endName}</div>
              <Badge tone="teal">{t("Demo / simulated")}</Badge>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

export function PassengerRoutes() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<RouteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q), 300);
    return () => window.clearTimeout(t);
  }, [q]);
  useEffect(() => { setPage(1); }, [debounced]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "10" });
    if (debounced.trim()) p.set("q", debounced.trim());
    return p.toString();
  }, [page, debounced]);

  useEffect(() => {
    setLoading(true);
    api<{ items: RouteRow[]; total?: number }>(`/routes?${query}`)
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? data.items?.length ?? 0);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [query]);

  const pages = Math.max(1, Math.ceil(total / 10));

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Search routes">
      {error && <ErrorState message={error} />}
      <input className="input mb-4 w-full max-w-md" aria-label={t("Search routes")} placeholder={t("Name, code, origin, destination, or stop")} value={q} onChange={(e) => setQ(e.target.value)} />
      {loading && !items.length ? <p className="text-sm text-slate-500">{t("Loading…")}</p> : !items.length ? (
        <EmptyState title={t("No routes")} body={t("No active routes match that search.")} />
      ) : (
        <div className="space-y-3">
          {items.map((r) => (
            <Link key={r.id} href={`/passenger/routes/${r.id}`} className="card block p-4">
              <div className="font-semibold">{r.code} · {r.name}</div>
              <div className="text-sm text-slate-500">{r.city} · {r.startName} → {r.endName} · {r.assignedVehicleCount ?? 0} {t("buses")}</div>
            </Link>
          ))}
        </div>
      )}
      <div className="pager">
        <span>{total} {t("routes")}</span>
        <div className="pager-actions">
          <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("Previous")}</button>
          <span className="self-center">{t("Page")} {page} / {pages}</span>
          <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Next")}</button>
        </div>
      </div>
    </AppShell>
  );
}

export function PassengerRouteDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const [route, setRoute] = useState<RouteRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<RouteRow>(`/routes/${id}`)
      .then(setRoute)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Route details">
      {error && <ErrorState message={error} />}
      {!route && !error && <p className="text-sm text-slate-500">{t("Loading…")}</p>}
      {route && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="text-lg font-semibold">{route.name}</div>
            <div className="text-sm text-slate-500">{route.code} · {route.city} · {route.startName} → {route.endName}</div>
            <Badge tone={route.status === "ACTIVE" ? "green" : "slate"}>{route.status}</Badge>
          </div>
          <LiveMap
            buses={[]}
            routes={[{ id: route.id, name: route.name, polyline: route.polyline ?? [], stops: route.stops }]}
          />
          <section className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">{t("Stops")}</h3>
            {!route.stops?.length ? <p className="text-sm text-slate-500">{t("No stops published.")}</p> : (
              <ol className="list-decimal space-y-1 pl-5 text-sm">
                {route.stops.map((s) => <li key={s.id ?? `${s.sequence}-${s.name}`}>{s.name}</li>)}
              </ol>
            )}
          </section>
          <section className="card p-4">
            <h3 className="mb-2 text-sm font-semibold">{t("Assigned buses")}</h3>
            {!route.buses?.length ? <p className="text-sm text-slate-500">{t("No vehicles assigned.")}</p> : (
              <ul className="space-y-1 text-sm">
                {route.buses.map((b) => (
                  <li key={b.id}><Link className="text-brand-700 underline" href={`/passenger/buses/${b.id}`}>{b.registrationNo}</Link> · {b.operationalStatus}</li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

export function PassengerBuses() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BusRow[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => { setPage(1); }, [q]);

  useEffect(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "10", sortBy: "registrationNo" });
    if (q.trim()) p.set("q", q.trim());
    api<{ items: BusRow[]; total?: number }>(`/buses?${p.toString()}`)
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? 0);
        setError("");
      })
      .catch((err: Error) => setError(err.message));
  }, [q, page]);

  const pages = Math.max(1, Math.ceil(total / 10));

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Find a bus">
      {error && <ErrorState message={error} />}
      <input className="input mb-4 w-full max-w-md" aria-label={t("Search buses")} placeholder={t("Registration")} value={q} onChange={(e) => setQ(e.target.value)} />
      {!items.length ? <EmptyState title={t("No buses")} body={t("No passenger-visible vehicles match.")} /> : (
        <div className="space-y-3">
          {items.map((b) => (
            <Link key={b.id} href={`/passenger/buses/${b.id}`} className="card block p-4">
              <div className="font-semibold">{b.registrationNo}</div>
              <div className="text-sm text-slate-500">{b.vehicleType ?? t("Bus")} · {b.route?.code ?? b.route?.name ?? t("Unassigned")} · {b.operationalStatus}</div>
            </Link>
          ))}
        </div>
      )}
      <div className="pager">
        <span>{total} {t("buses")}</span>
        <div className="pager-actions">
          <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("Previous")}</button>
          <span className="self-center">{t("Page")} {page} / {pages}</span>
          <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Next")}</button>
        </div>
      </div>
    </AppShell>
  );
}

export function PassengerBusDetail({ id }: { id: string }) {
  const { t } = useI18n();
  const [bus, setBus] = useState<BusRow | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<BusRow>(`/buses/${id}`)
      .then(setBus)
      .catch((err: Error) => setError(err.message));
  }, [id]);

  const loc = bus?.latestLoc;

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Bus details">
      {error && <ErrorState message={error} />}
      {!bus && !error && <p className="text-sm text-slate-500">{t("Loading…")}</p>}
      {bus && (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="text-lg font-semibold">{bus.registrationNo}</div>
            <div className="text-sm text-slate-500">{bus.vehicleType ?? t("Bus")} · {bus.operationalStatus}</div>
            <div className="mt-2 text-sm">{t("Route:")} {bus.route?.id ? <Link className="text-brand-700 underline" href={`/passenger/routes/${bus.route.id}`}>{bus.route.code ?? bus.route.name}</Link> : t("Unassigned")}</div>
            <div className="text-sm">{t("Driver:")} {bus.driver?.name ?? t("Not shown")}</div>
            <div className="text-sm">{t("GPS:")} {bus.trackingState ?? (loc ? "ONLINE" : "—")} · {t("last")} {loc?.timestamp ? new Date(loc.timestamp).toLocaleString() : "—"}</div>
            <div className="text-sm">{t("Speed:")} {loc?.speed != null ? `${Number(loc.speed).toFixed(0)} ${t("km/h")}` : "—"}</div>
            <p className="mt-2 text-xs text-slate-500">{t("Passenger-safe fields only. License, phone, and verification records are not shown.")}</p>
            <Link className="btn btn-primary mt-3" href={`/passenger/complaints?busId=${bus.id}`}>{t("Report complaint / inquiry")}</Link>
          </div>
          {loc?.latitude != null && loc.longitude != null && (
            <LiveMap
              buses={[{
                busId: bus.id,
                registrationNo: bus.registrationNo,
                latitude: Number(loc.latitude),
                longitude: Number(loc.longitude),
                speed: Number(loc.speed ?? 0),
                heading: 0,
                timestamp: String(loc.timestamp ?? ""),
                trackingState: bus.trackingState === "STALE" ? "STALE" : "ONLINE",
                dataLabel: "SIMULATED",
              }]}
            />
          )}
        </div>
      )}
    </AppShell>
  );
}

export function PassengerComplaints() {
  const { t } = useI18n();
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [busId, setBusId] = useState(search?.get("busId") ?? "");
  const [busLabel, setBusLabel] = useState("");
  const [items, setItems] = useState<ComplaintRow[]>([]);
  const [category, setCategory] = useState("OTHER");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  function load() {
    api<ComplaintRow[]>("/complaints")
      .then(setItems)
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("busId") ?? "";
    setBusId(id);
    if (!id) {
      setBusLabel("");
      return;
    }
    api<{ registrationNo?: string; route?: { code?: string; name?: string } | null }>(`/buses/${id}`)
      .then((b) => setBusLabel([b.registrationNo, b.route?.code ?? b.route?.name].filter(Boolean).join(" · ")))
      .catch(() => setBusLabel(id));
  }, []);

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Complaints">
      {error && <ErrorState message={error} />}
      <form
        className="card mb-4 max-w-lg space-y-3 p-4 sm:p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/complaints", {
            method: "POST",
            body: JSON.stringify({
              category,
              description,
              ...(busId ? { busId } : {}),
            }),
          });
          setMsg(t("Complaint submitted. You will see status updates here."));
          setDescription("");
          load();
        }}
      >
        {busId && (
          <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-secondary)] px-3 py-2 text-xs text-[var(--text-secondary)]">
            {t("Linked vehicle (from QR / bus page):")} <strong>{busLabel || busId}</strong>
          </p>
        )}
        <label className="text-sm font-medium" htmlFor="cat">{t("Category")}</label>
        <select id="cat" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="OTHER">{t("General inquiry")}</option>
          <option value="OVERSPEEDING">{t("Bus service / overspeed")}</option>
          <option value="DRIVER_BEHAVIOR">{t("Driver behavior")}</option>
          <option value="ROUTE">{t("Route problem")}</option>
          <option value="BUS_CONDITION">{t("Vehicle condition")}</option>
          <option value="HARASSMENT_SECURITY">{t("Safety issue")}</option>
        </select>
        <textarea className="input min-h-28" required minLength={8} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("Describe what happened. Do not include unnecessary personal data.")} />
        <button className="btn btn-primary">{t("Submit")}</button>
        {msg && <p className="text-sm text-emerald-700">{t(msg)}</p>}
      </form>
      <h2 className="mb-2 text-sm font-semibold">{t("Your complaints")}</h2>
      {!items.length ? <EmptyState title={t("No complaints")} body={t("You have not submitted a complaint in this deployment.")} /> : (
        <div className="space-y-3">
          {items.map((c) => {
            const emergency = isEmergencyComplaint(c);
            return (
              <div
                key={c.id}
                className={`card p-4 text-sm ${
                  emergency ? "border-[var(--error)] bg-[var(--error-bg)] ring-1 ring-[var(--error)]/30" : ""
                }`}
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <strong className={emergency ? "text-[var(--error)]" : ""}>
                    {emergency ? t("Emergency · ") : ""}
                    {c.category}
                  </strong>
                  <div className="flex flex-wrap gap-1">
                    {emergency && <Badge tone="red">{t("EMERGENCY")}</Badge>}
                    <Badge tone={c.status === "RESOLVED" ? "green" : emergency ? "red" : "yellow"}>{c.status}</Badge>
                  </div>
                </div>
                <p className={`mt-1 ${emergency ? "text-[var(--error)]" : ""}`}>{c.description}</p>
                {c.resolution && <p className="mt-1 text-slate-500">{t("Update:")} {c.resolution}</p>}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

type LostFoundRow = {
  id: string;
  reference: string;
  kind: "LOST" | "FOUND";
  category: string;
  title: string;
  description: string;
  status: string;
  claimStatus?: string | null;
  createdAt: string;
  lostAt?: string | null;
  foundAt?: string | null;
  locationText?: string | null;
  busRegistrationNo?: string | null;
  routeCode?: string | null;
  routeName?: string | null;
  potentialMatches?: Array<{ id: string; reference: string; kind: string; category: string; title: string; status: string }>;
  matchCount?: number;
};

const LOST_FOUND_CATEGORIES = [
  "PERSONAL_ITEM",
  "DOCUMENTS",
  "ELECTRONICS",
  "BAG",
  "ACCESSORIES",
  "OTHER",
] as const;

const LOST_FOUND_CATEGORY_LABELS: Record<(typeof LOST_FOUND_CATEGORIES)[number], string> = {
  PERSONAL_ITEM: "Personal item",
  DOCUMENTS: "Documents",
  ELECTRONICS: "Electronics",
  BAG: "Bag",
  ACCESSORIES: "Accessories",
  OTHER: "Other",
};

function formatDateTime(value: string | null | undefined, t: (text: string) => string) {
  if (!value) return t("Not recorded");
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function PassengerLostFound() {
  const { t } = useI18n();
  const [items, setItems] = useState<LostFoundRow[]>([]);
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [buses, setBuses] = useState<BusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ reference: string; kind: "LOST" | "FOUND" } | null>(null);
  const [form, setForm] = useState({
    kind: "LOST" as "LOST" | "FOUND",
    category: "OTHER",
    title: "",
    description: "",
    eventAt: "",
    locationText: "",
    routeId: "",
    busId: "",
  });

  function load() {
    setLoading(true);
    Promise.all([
      api<{ items: LostFoundRow[] } | LostFoundRow[]>('/lost-found'),
      api<RouteRow[] | { items: RouteRow[] }>('/routes'),
      api<BusRow[] | { items: BusRow[] }>('/buses?pageSize=100'),
    ])
      .then(([lostFound, routeData, busData]) => {
        setItems(Array.isArray(lostFound) ? lostFound : lostFound.items ?? []);
        setRoutes(Array.isArray(routeData) ? routeData : routeData.items ?? []);
        setBuses(Array.isArray(busData) ? busData : busData.items ?? []);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload: Record<string, string> = {
      category: form.category,
      title: form.title.trim(),
      description: form.description.trim(),
      locationText: form.locationText.trim(),
    };
    if (!payload.title || payload.title.length < 2) {
      setError(t("Please provide a short item name."));
      return;
    }
    if (payload.description.length < 8) {
      setError(t("Please add a clearer description with at least 8 characters."));
      return;
    }
    if (form.eventAt) payload[form.kind === "LOST" ? "lostAt" : "foundAt"] = new Date(form.eventAt).toISOString();
    if (form.routeId) payload.routeId = form.routeId;
    if (form.busId) payload.busId = form.busId;

    setSubmitting(true);
    setError("");
    setSuccess(null);
    try {
      const endpoint = form.kind === "LOST" ? "/lost-found/lost" : "/lost-found/found";
      const created = await api<{ reference?: string }>(endpoint, { method: "POST", body: JSON.stringify(payload) });
      setSuccess({ reference: created.reference ?? "LF-REQUESTED", kind: form.kind });
      setForm((prev) => ({ ...prev, category: "OTHER", title: "", description: "", eventAt: "", locationText: "", routeId: "", busId: "" }));
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Unable to submit Lost & Found report."));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Lost & Found">
      {error && <ErrorState message={error} />}
      <form className="card mb-6 max-w-2xl space-y-4 p-4 sm:p-6" onSubmit={handleSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold">{t("Report a lost or found item")}</h2>
          <Badge tone="teal">{t("Passenger-safe only")}</Badge>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="lf-kind" className="mb-1 block text-sm font-medium">{t("Report type")}</label>
            <select id="lf-kind" className="input" value={form.kind} onChange={(e) => setForm((prev) => ({ ...prev, kind: e.target.value as "LOST" | "FOUND" }))}>
              <option value="LOST">{t("Lost item")}</option>
              <option value="FOUND">{t("Found item")}</option>
            </select>
          </div>
          <div>
            <label htmlFor="lf-category" className="mb-1 block text-sm font-medium">{t("Category")}</label>
            <select id="lf-category" className="input" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}>
              {LOST_FOUND_CATEGORIES.map((value) => (
                <option key={value} value={value}>{t(LOST_FOUND_CATEGORY_LABELS[value])}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="lf-title" className="mb-1 block text-sm font-medium">{t("Item name")}</label>
          <input id="lf-title" className="input" required minLength={2} value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} placeholder={t("Example: Blue backpack")} />
        </div>

        <div>
          <label htmlFor="lf-description" className="mb-1 block text-sm font-medium">{t("Description")}</label>
          <textarea id="lf-description" className="input min-h-28" required minLength={8} value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} placeholder={t("Describe the item, key identifiers, and where it was seen or lost.")} />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="lf-event-at" className="mb-1 block text-sm font-medium">{form.kind === "LOST" ? t("Lost date/time") : t("Found date/time")}</label>
            <input id="lf-event-at" type="datetime-local" className="input" value={form.eventAt} onChange={(e) => setForm((prev) => ({ ...prev, eventAt: e.target.value }))} />
          </div>
          <div>
            <label htmlFor="lf-location" className="mb-1 block text-sm font-medium">{t("Location")}</label>
            <input id="lf-location" className="input" value={form.locationText} onChange={(e) => setForm((prev) => ({ ...prev, locationText: e.target.value }))} placeholder={t("Route, station, stop, or area")} />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label htmlFor="lf-route" className="mb-1 block text-sm font-medium">{t("Related route (optional)")}</label>
            <select id="lf-route" className="input" value={form.routeId} onChange={(e) => setForm((prev) => ({ ...prev, routeId: e.target.value }))}>
              <option value="">{t("No route selected")}</option>
              {routes.map((route) => <option key={route.id} value={route.id}>{route.code} · {route.name}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="lf-bus" className="mb-1 block text-sm font-medium">{t("Related bus (optional)")}</label>
            <select id="lf-bus" className="input" value={form.busId} onChange={(e) => setForm((prev) => ({ ...prev, busId: e.target.value }))}>
              <option value="">{t("No bus selected")}</option>
              {buses.map((bus) => <option key={bus.id} value={bus.id}>{bus.registrationNo}</option>)}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={submitting}>{submitting ? t("Submitting…") : t("Submit report")}</button>
          <span className="text-xs text-slate-500">{t("Back-end validation is enforced for identity, permissions, and data integrity.")}</span>
        </div>

        {success && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
            {success.kind === "LOST" ? t("Lost item") : t("Found item")} {t("submitted successfully. Reference:")} <strong>{success.reference}</strong>
          </div>
        )}
      </form>

      <section>
        <h2 className="mb-2 text-sm font-semibold">{t("Your reports")}</h2>
        {loading ? <p className="text-sm text-slate-500">{t("Loading your Lost & Found history…")}</p> : !items.length ? (
          <EmptyState title={t("No reports yet")} body={t("You have not submitted any lost or found item reports in this account.")} />
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.id} className="card p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-semibold">{item.reference} · {item.title}</div>
                    <div className="text-xs text-slate-500">{item.kind} · {item.category}</div>
                  </div>
                  <Badge tone={item.status === "CLOSED" || item.status === "RETURNED" ? "green" : item.status === "CANCELLED" ? "slate" : "yellow"}>{item.status}</Badge>
                </div>
                <p className="mt-2 text-slate-600">{item.description}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                  <span>{t("Created:")} {formatDateTime(item.createdAt, t)}</span>
                  <span>{item.kind === "LOST" ? t("Lost") : t("Found")}: {formatDateTime(item.kind === "LOST" ? item.lostAt : item.foundAt, t)}</span>
                  {item.locationText && <span>{t("Location:")} {item.locationText}</span>}
                  {(item.routeName || item.routeCode) && <span>{t("Route:")} {item.routeName ?? item.routeCode}</span>}
                  {item.busRegistrationNo && <span>{t("Bus:")} {item.busRegistrationNo}</span>}
                </div>
                {item.claimStatus && item.claimStatus !== "PENDING" && (
                  <div className="mt-2 text-xs text-slate-500">{t("Claim status:")} <span className="font-medium">{item.claimStatus}</span></div>
                )}
                {item.potentialMatches && item.potentialMatches.length > 0 && (
                  <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">{t("Possible matches")}</div>
                    <ul className="space-y-1 text-xs">
                      {item.potentialMatches.map((match) => (
                        <li key={match.id} className="flex justify-between gap-2 rounded-lg bg-white px-2 py-1">
                          <span>{match.reference} · {match.title}</span>
                          <Badge tone={match.status === "MATCHED" ? "teal" : "yellow"}>{match.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

export { NotificationsInbox as PassengerNotifications } from "@/components/NotificationsInbox";

export function PassengerProfile() {
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [emergencyName, setEmergencyName] = useState(user?.passenger?.emergencyName ?? "");
  const [emergencyContact, setEmergencyContact] = useState(user?.passenger?.emergencyContact ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    setFullName(user?.fullName ?? "");
    setPhone(user?.phone ?? "");
    setEmergencyName(user?.passenger?.emergencyName ?? "");
    setEmergencyContact(user?.passenger?.emergencyContact ?? "");
  }, [user]);

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Profile">
      {error && <ErrorState message={error} />}
      <form
        className="card max-w-lg space-y-3 p-4 sm:p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await api<AuthUser>("/auth/me", {
              method: "PATCH",
              body: JSON.stringify({
                fullName,
                phone: phone || null,
                emergencyName: emergencyName || null,
                emergencyContact: emergencyContact || null,
              }),
            });
            if (currentPassword && newPassword) {
              await api("/auth/change-password", {
                method: "POST",
                body: JSON.stringify({ currentPassword, newPassword }),
              });
              setCurrentPassword("");
              setNewPassword("");
            }
            await refresh();
            setMsg(t("Profile saved. Roles cannot be changed here."));
          } catch (err) {
            setError((err as Error).message);
          }
        }}
      >
        <div className="text-sm text-slate-500">{user?.email} · {(user?.roles ?? []).join(", ")}</div>
        <input className="input" required minLength={2} aria-label={t("Full name")} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <input className="input" aria-label={t("Phone")} placeholder={t("Phone")} value={phone} onChange={(e) => setPhone(e.target.value)} />
        <input className="input" aria-label={t("Emergency contact name")} placeholder={t("Emergency contact name")} value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
        <input className="input" aria-label={t("Emergency contact phone")} placeholder={t("Emergency contact phone")} value={emergencyContact} onChange={(e) => setEmergencyContact(e.target.value)} />
        <input className="input" type="password" aria-label={t("Current password")} placeholder={t("Current password (only to change password)")} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        <input className="input" type="password" aria-label={t("New password")} placeholder={t("New password")} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <button className="btn btn-primary">{t("Save")}</button>
        {msg && <p className="text-sm text-emerald-700">{t(msg)}</p>}
      </form>
    </AppShell>
  );
}
