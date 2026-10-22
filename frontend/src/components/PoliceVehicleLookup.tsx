"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/map/LiveMap";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import type { BusLive } from "@/lib/types";

type LookupBus = {
  id: string;
  registrationNo: string;
  vehicleType?: string;
  capacity?: number;
  manufacturer?: string | null;
  model?: string | null;
  yearOfManufacture?: number | null;
  operationalStatus?: string;
  fitnessStatus?: string;
  registrationStatus?: string;
  insuranceStatus?: string;
  trackingState?: string;
  complianceStatus?: string | null;
  verificationLabel?: string;
  company?: { id?: string; name?: string | null; city?: string | null } | null;
  route?: {
    id?: string;
    name?: string;
    code?: string;
    startName?: string;
    endName?: string;
    city?: string;
    allowedSpeed?: number;
  } | null;
  driver?: {
    id?: string;
    name?: string | null;
    licenseStatus?: string | null;
    experienceYears?: number | null;
    status?: string | null;
  } | null;
  latestLoc?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading?: number;
    timestamp: string;
  } | null;
};

function toneFor(status?: string | null): "green" | "yellow" | "red" | "slate" | "teal" {
  if (!status) return "slate";
  if (["ACTIVE", "FIT", "VALID", "ONLINE", "ON_ROUTE"].includes(status)) return "green";
  if (["PENDING", "MAINTENANCE", "NEAR_ROUTE", "DEVIATING", "STALE"].includes(status)) return "yellow";
  if (["SUSPENDED", "UNFIT", "EXPIRED", "OFFLINE", "OFF_ROUTE"].includes(status)) return "red";
  return "slate";
}

export function PoliceVehicleLookup() {
  const { t } = useI18n();
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<LookupBus[]>([]);
  const [total, setTotal] = useState(0);
  const [selected, setSelected] = useState<LookupBus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(q.trim()), 250);
    return () => window.clearTimeout(t);
  }, [q]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  // Prefill from ?q= when opened from dashboard.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initial = params.get("q");
    if (initial) setQ(initial);
  }, []);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "12", sortBy: "registrationNo" });
    if (debounced) p.set("q", debounced);
    return p.toString();
  }, [page, debounced]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items: LookupBus[]; total?: number }>(`/buses?${query}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? data.items?.length ?? 0);
      setSelected((cur) => {
        if (!cur) return data.items?.[0] ?? null;
        return data.items?.find((b) => b.id === cur.id) ?? data.items?.[0] ?? null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load vehicles");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const pages = Math.max(1, Math.ceil(total / 12));

  const live: BusLive | null = useMemo(() => {
    if (!selected?.latestLoc) return null;
    const loc = selected.latestLoc;
    return {
      busId: selected.id,
      registrationNo: selected.registrationNo,
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      speed: Number(loc.speed ?? 0),
      heading: Number(loc.heading ?? 0),
      timestamp: String(loc.timestamp ?? ""),
      trackingState: selected.trackingState === "STALE" ? "STALE" : "ONLINE",
      dataLabel: "SIMULATED",
      routeName: selected.route?.name,
      complianceStatus: selected.complianceStatus ?? undefined,
    };
  }, [selected]);

  return (
    <AppShell allow={["POLICE", "SUPER_ADMIN"]} title="Vehicle lookup">
      <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
        Roadside / incident lookup. Search by registration to see the operating driver, vehicle details, and route point of
        origin. GPS is SIMULATED. License numbers and phone numbers are not shown.
      </p>

      <div className="toolbar mb-4">
        <input
          className="input max-w-md"
          aria-label="Search registration"
          placeholder="Registration number (e.g. DHAKA-METRO-D-DEMO-11)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button type="button" className="btn btn-ghost" onClick={() => void load()}>
          Refresh
        </button>
        <Link className="btn btn-ghost" href="/police/dashboard">
          Dashboard
        </Link>
        <span className="text-xs text-[var(--text-muted)]">{total} vehicles</span>
      </div>

      {error && <ErrorState message={error} />}

      {loading && !items.length ? (
        <p className="text-sm text-[var(--text-muted)]">Loading vehicles…</p>
      ) : !items.length ? (
        <EmptyState title="No vehicles found" body="Try another registration fragment, or clear the search." />
      ) : (
        <div className="stack-panel">
          <div className="card table-wrap min-w-0">
            <table className="data">
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Operator</th>
                  <th>Driver</th>
                  <th>Origin</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={selected?.id === row.id ? "bg-[var(--surface-secondary)]" : "cursor-pointer"}
                    onClick={() => setSelected(row)}
                  >
                    <td className="font-medium">{row.registrationNo}</td>
                    <td>{row.company?.name ?? "—"}</td>
                    <td>{row.driver?.name ?? "Unassigned"}</td>
                    <td>{row.route?.startName ?? "—"}</td>
                    <td>
                      <Badge tone={toneFor(row.operationalStatus)}>{row.operationalStatus ?? "—"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pager px-3 py-2">
              <span>
                Page {page} of {pages}
              </span>
              <div className="pager-actions">
                <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  Previous
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </button>
              </div>
            </div>
          </div>

          <aside className="card space-y-4 p-4 sm:p-5">
            {!selected ? (
              <p className="text-sm text-[var(--text-muted)]">Select a vehicle to view roadside details.</p>
            ) : (
              <>
                <header>
                  <h2 className="font-display text-lg font-semibold tracking-tight">{selected.registrationNo}</h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    {selected.verificationLabel ?? "MANUAL / SIMULATED VERIFICATION"}
                  </p>
                </header>

                <section className="space-y-2 border-l-4 border-l-[var(--brand-primary)] pl-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {t("Point of origin")}
                  </h3>
                  {!selected.route ? (
                    <p className="text-sm text-[var(--text-muted)]">No route assigned — origin unknown.</p>
                  ) : (
                    <>
                      <p className="text-base font-semibold">{selected.route.startName ?? "—"}</p>
                      <p className="text-sm text-[var(--text-secondary)]">
                        {t("Destination")}: {selected.route.endName ?? "—"}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        {selected.route.code} · {selected.route.name}
                        {selected.route.city ? ` · ${selected.route.city}` : ""}
                        {selected.route.allowedSpeed != null ? ` · limit ${selected.route.allowedSpeed} km/h` : ""}
                      </p>
                    </>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {t("Operating driver")}
                  </h3>
                  {!selected.driver ? (
                    <p className="text-sm text-[var(--text-muted)]">No driver currently assigned.</p>
                  ) : (
                    <dl className="grid gap-2 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-xs text-[var(--text-muted)]">Name</dt>
                        <dd className="font-medium">{selected.driver.name ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--text-muted)]">Duty status</dt>
                        <dd>{selected.driver.status ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--text-muted)]">License status</dt>
                        <dd>
                          <Badge tone={toneFor(selected.driver.licenseStatus)}>
                            {selected.driver.licenseStatus ?? "—"}
                          </Badge>
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-[var(--text-muted)]">Experience</dt>
                        <dd>
                          {selected.driver.experienceYears != null
                            ? `${selected.driver.experienceYears} years`
                            : "—"}
                        </dd>
                      </div>
                    </dl>
                  )}
                </section>

                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                    {t("Vehicle information")}
                  </h3>
                  <dl className="grid gap-2 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs text-[var(--text-muted)]">Type</dt>
                      <dd>{(selected.vehicleType ?? "—").replaceAll("_", " ")}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--text-muted)]">Capacity</dt>
                      <dd>{selected.capacity ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--text-muted)]">Make / model</dt>
                      <dd>
                        {[selected.manufacturer, selected.model].filter(Boolean).join(" ") || "—"}
                        {selected.yearOfManufacture ? ` (${selected.yearOfManufacture})` : ""}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[var(--text-muted)]">Operator</dt>
                      <dd>
                        {selected.company?.name ?? "—"}
                        {selected.company?.city ? ` · ${selected.company.city}` : ""}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap gap-1 pt-1">
                    <Badge tone={toneFor(selected.operationalStatus)}>{selected.operationalStatus ?? "—"}</Badge>
                    {selected.registrationStatus && (
                      <Badge tone={toneFor(selected.registrationStatus)}>Reg {selected.registrationStatus}</Badge>
                    )}
                    {selected.fitnessStatus && (
                      <Badge tone={toneFor(selected.fitnessStatus)}>Fitness {selected.fitnessStatus}</Badge>
                    )}
                    {selected.insuranceStatus && (
                      <Badge tone={toneFor(selected.insuranceStatus)}>Token {selected.insuranceStatus}</Badge>
                    )}
                    {selected.complianceStatus && (
                      <Badge tone={toneFor(selected.complianceStatus)}>{selected.complianceStatus}</Badge>
                    )}
                    {selected.trackingState && (
                      <Badge tone={toneFor(selected.trackingState)}>GPS {selected.trackingState}</Badge>
                    )}
                  </div>
                </section>

                {live && (
                  <section className="space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                      {t("Last known location")}
                    </h3>
                    <p className="text-xs text-[var(--text-muted)]">
                      {live.trackingState} · {live.speed.toFixed(0)} km/h ·{" "}
                      {live.timestamp ? new Date(live.timestamp).toLocaleString() : "—"} · SIMULATED
                    </p>
                    <LiveMap buses={[live]} />
                  </section>
                )}

                <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
                  <Link className="btn btn-primary" href={`/police/complaints?busId=${selected.id}`}>
                    {t("Open complaint")}
                  </Link>
                  <Link className="btn btn-ghost" href="/police/emergencies">
                    {t("Emergencies")}
                  </Link>
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}
