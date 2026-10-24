"use client";

import { useEffect, useMemo, useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { busHasIssue, vehicleRowHasIssue } from "@/lib/busIssue";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { BusLive, Overview } from "@/lib/types";
import { Badge, EmptyState, ErrorState, StatCard } from "./StatCard";
import { LiveMap } from "./map/LiveMap";

export type DashboardVariant = "admin" | "government" | "brta" | "police" | "owner";

type VehicleRow = {
  id: string;
  registrationNo: string;
  vehicleType?: string;
  operationalStatus?: string;
  trackingState?: string;
  complianceStatus?: string | null;
  company?: { name?: string | null } | null;
  route?: { name?: string; code?: string } | null;
  driver?: { name?: string | null } | null;
  latestLoc?: { timestamp?: string; speed?: number } | null;
};

type DriverRow = {
  id: string;
  fullName?: string | null;
  licenseStatus?: string;
  status?: string;
  company?: { name?: string | null } | null;
  buses?: Array<{ registrationNo: string }>;
};

type RouteRow = {
  id: string;
  code: string;
  name: string;
  startName: string;
  endName: string;
  status: string;
  assignedVehicleCount?: number;
};

type Activity = {
  alerts: Array<{ id: string; type: string; severity: string; message: string; registrationNo?: string | null; createdAt: string }>;
  complianceEvents: Array<{ id: string; registrationNo: string; routeCode?: string | null; fromStatus: string; toStatus: string; createdAt: string }>;
  audit: Array<{ id: string; action: string; entity?: string | null; actor?: string | null; createdAt: string }>;
};

function normalizeLive(row: Record<string, unknown>): BusLive {
  return {
    busId: String(row.busId ?? (row.bus as { id?: string } | undefined)?.id ?? ""),
    registrationNo: String(row.registrationNo ?? (row.bus as { registrationNo?: string } | undefined)?.registrationNo ?? ""),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    speed: Number(row.speed),
    heading: Number(row.heading ?? 0),
    timestamp: String(row.timestamp ?? ""),
    statusColor: (row.statusColor as BusLive["statusColor"]) ?? "GREEN",
    hasIssue: row.hasIssue === true,
    operationalStatus: row.operationalStatus ? String(row.operationalStatus) : undefined,
    source: String(row.source ?? "SIMULATION"),
    dataLabel: String(row.dataLabel ?? "SIMULATED"),
    trackingState: row.trackingState === "STALE" ? "STALE" : "ONLINE",
    complianceStatus: row.complianceStatus ? String(row.complianceStatus) : undefined,
    deviationM: row.deviationM == null ? undefined : Number(row.deviationM),
    routeId: row.routeId ? String(row.routeId) : undefined,
    routeName: row.routeName ? String(row.routeName) : undefined,
  };
}

function tone(status?: string | null): "green" | "yellow" | "red" | "slate" {
  if (!status) return "slate";
  if (["ACTIVE", "ONLINE", "ON_ROUTE", "VALID", "FIT"].includes(status)) return "green";
  if (["PENDING", "NEAR_ROUTE", "DEVIATING", "MAINTENANCE", "YELLOW"].includes(status)) return "yellow";
  if (["OFF_ROUTE", "STALE", "SUSPENDED", "OFFLINE", "EXPIRED", "INACTIVE"].includes(status)) return "red";
  return "slate";
}

function fmtWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

function Pager({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (next: number) => void }) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="pager">
      <span>
        {total} {t("records")}
      </span>
      <div className="pager-actions">
        <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          {t("Previous")}
        </button>
        <span className="self-center">
          {t("Page")} {page} / {pages}
        </span>
        <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          {t("Next")}
        </button>
      </div>
    </div>
  );
}

export function DashboardView({
  showMap = true,
  variant = "admin",
}: {
  showMap?: boolean;
  variant?: DashboardVariant;
}) {
  const { user } = useAuth();
  const { t } = useI18n();
  const roles = user?.roles ?? [];
  const [overview, setOverview] = useState<Overview | null>(null);
  const [series, setSeries] = useState<{ dailyTrips: Array<{ day: string; trips: number }>; speedViolations: Array<{ day: string; count: number }> } | null>(null);
  const [buses, setBuses] = useState<BusLive[]>([]);
  const [pickedBusId, setPickedBusId] = useState<string | null>(null);
  const [routes, setRoutes] = useState<Array<{ id: string; name: string; polyline: Array<{ lat: number; lng: number }>; stops?: Array<{ name: string; latitude: number; longitude: number; sequence?: number }> }>>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [routeRows, setRouteRows] = useState<RouteRow[]>([]);
  const [activity, setActivity] = useState<Activity | null>(null);
  const [vehicleQ, setVehicleQ] = useState("");
  const [vehicleQDebounced, setVehicleQDebounced] = useState("");
  const [vehicleStatus, setVehicleStatus] = useState("");
  const [driverStatus, setDriverStatus] = useState("");
  const [routeQ, setRouteQ] = useState("");
  const [vehiclePage, setVehiclePage] = useState(1);
  const [driverPage, setDriverPage] = useState(1);
  const [routePage, setRoutePage] = useState(1);
  const [vehicleTotal, setVehicleTotal] = useState(0);
  const [driverTotal, setDriverTotal] = useState(0);
  const [routeTotal, setRouteTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const t = window.setTimeout(() => setVehicleQDebounced(vehicleQ), 300);
    return () => window.clearTimeout(t);
  }, [vehicleQ]);

  useEffect(() => { setVehiclePage(1); }, [vehicleQDebounced, vehicleStatus]);
  useEffect(() => { setDriverPage(1); }, [driverStatus]);
  useEffect(() => { setRoutePage(1); }, [routeQ]);

  const vehicleQuery = useMemo(() => {
    const p = new URLSearchParams({ page: String(vehiclePage), pageSize: "8", sortBy: "registrationNo" });
    if (vehicleQDebounced.trim()) p.set("q", vehicleQDebounced.trim());
    if (vehicleStatus) p.set("operationalStatus", vehicleStatus);
    return p.toString();
  }, [vehicleQDebounced, vehicleStatus, vehiclePage]);

  const driverQuery = useMemo(() => {
    const p = new URLSearchParams({ page: String(driverPage), pageSize: "8" });
    if (["PENDING", "VALID", "EXPIRED"].includes(driverStatus)) p.set("licenseStatus", driverStatus);
    else if (driverStatus) p.set("status", driverStatus);
    return p.toString();
  }, [driverStatus, driverPage]);

  const routeQuery = useMemo(() => {
    const p = new URLSearchParams({ page: String(routePage), pageSize: "8" });
    if (routeQ.trim()) p.set("q", routeQ.trim());
    return p.toString();
  }, [routeQ, routePage]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api<Overview>("/analytics/overview"),
      api<{ dailyTrips: Array<{ day: string; trips: number }>; speedViolations: Array<{ day: string; count: number }> }>("/analytics/series"),
      api<{ items: Array<Record<string, unknown>> }>("/gps/live"),
      api<Array<{ id: string; name: string; polyline: Array<{ lat: number; lng: number }>; stops?: Array<{ name: string; latitude: number; longitude: number; sequence?: number }> }>>("/routes"),
      api<{ items: VehicleRow[]; total?: number }>(`/buses?${vehicleQuery}`),
      api<{ items: DriverRow[]; total?: number }>(`/drivers?${driverQuery}`),
      api<{ items: RouteRow[]; total?: number }>(`/routes?${routeQuery}`),
      api<Activity>("/analytics/activity").catch(() => null),
    ])
      .then(([o, s, live, catalog, fleet, staff, routePageData, act]) => {
        setOverview(o);
        setSeries(s);
        setBuses((live.items ?? []).map(normalizeLive));
        setRoutes(Array.isArray(catalog) ? catalog : []);
        setVehicles(fleet.items ?? []);
        setVehicleTotal(fleet.total ?? fleet.items?.length ?? 0);
        setDrivers(staff.items ?? []);
        setDriverTotal(staff.total ?? staff.items?.length ?? 0);
        setRouteRows(routePageData.items ?? []);
        setRouteTotal(routePageData.total ?? routePageData.items?.length ?? 0);
        setActivity(act);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [vehicleQuery, driverQuery, routeQuery]);

  useEffect(() => {
    const socket = getSocket();
    const onLoc = (payload: Record<string, unknown>) => {
      const next = normalizeLive(payload);
      setBuses((prev) => [...prev.filter((b) => b.busId !== next.busId), next]);
    };
    const onRoute = (payload: Record<string, unknown>) => {
      setBuses((prev) => prev.map((b) => (
        b.busId === payload.busId
          ? { ...b, complianceStatus: String(payload.status ?? b.complianceStatus ?? ""), deviationM: payload.deviationM == null ? b.deviationM : Number(payload.deviationM) }
          : b
      )));
    };
    socket.on("bus:location", onLoc);
    socket.on("bus:location:ops", onLoc);
    socket.on("route:status", onRoute);
    return () => {
      socket.off("bus:location", onLoc);
      socket.off("bus:location:ops", onLoc);
      socket.off("route:status", onRoute);
    };
  }, []);

  const cards = overview?.cards ?? {};
  const issueIds = useMemo(() => new Set(buses.filter((b) => busHasIssue(b)).map((b) => b.busId)), [buses]);
  const showVerification = variant === "admin" || variant === "government" || variant === "brta" || variant === "owner";
  const showSos = variant === "admin" || variant === "government" || variant === "police";
  const showPassengers = variant === "admin" || variant === "government";
  const showAudit = variant === "admin" && roles.includes("SUPER_ADMIN");

  return (
    <div className="space-y-5">
      {error && <ErrorState message={error} />}
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
        {t(
          "Central monitoring uses live API counts from this deployment. GPS is SIMULATED. Route status is rule-based, not AI. Verification is MANUAL / SIMULATED.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          label="Vehicles"
          value={cards.totalBuses ?? "—"}
          hint={
            <>
              {cards.activeBuses ?? 0} {t("active")}
            </>
          }
        />
        <StatCard label="Inactive / offline" value={`${cards.inactiveBuses ?? 0} / ${cards.offlineBuses ?? 0}`} />
        {showVerification && <StatCard label="Pending verification" value={cards.pendingVehicleVerification ?? "—"} hint="Manual / simulated" />}
        {showVerification && <StatCard label="Suspended vehicles" value={cards.suspendedVehicles ?? "—"} />}
        <StatCard
          label="Drivers"
          value={cards.totalDrivers ?? "—"}
          hint={
            <>
              {cards.activeDrivers ?? 0} {t("active")}
            </>
          }
        />
        {showVerification && <StatCard label="Pending licenses" value={cards.pendingLicense ?? "—"} />}
        <StatCard label="Active routes" value={cards.activeRoutes ?? "—"} />
        <StatCard label="GPS online / stale" value={`${cards.vehiclesOnline ?? 0} / ${cards.vehiclesStale ?? 0}`} />
        <StatCard label="On route" value={cards.vehiclesOnRoute ?? "—"} hint="Rule-based" />
        <StatCard label="Off route / deviating" value={`${cards.vehiclesOffRoute ?? 0} / ${cards.vehiclesDeviating ?? 0}`} hint="Rule-based" />
        <StatCard label="Deviations today" value={cards.deviationsToday ?? cards.routeViolations ?? "—"} />
        <StatCard label="Overspeed today" value={cards.overspeedingAlerts ?? "—"} />
        {showSos && <StatCard label="Open SOS" value={cards.openSos ?? cards.emergencyAlerts ?? "—"} />}
        <StatCard label="Open complaints" value={cards.complaints ?? "—"} />
        {showPassengers && <StatCard label="Passengers" value={cards.totalPassengers ?? "—"} />}
      </div>

      {showMap && (
        <div id="live-monitoring-map">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold tracking-tight">{t("Live monitoring map")}</h2>
            <span className="text-xs text-[var(--text-muted)]">
              {t(
                "Bangladesh only · Vehicle logo = live GPS · Ring: green clear · red open issue · grey stale · SIMULATED GPS",
              )}
            </span>
          </div>
          <LiveMap buses={buses} routes={routes} activeBusId={pickedBusId} onSelect={setPickedBusId} />
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight">{t("Vehicle monitoring")}</h3>
            <div className="toolbar w-full sm:w-auto">
              <input
                className="input"
                aria-label={t("Search vehicles")}
                placeholder={t("Search registration")}
                value={vehicleQ}
                onChange={(e) => setVehicleQ(e.target.value)}
              />
              <select
                className="input"
                aria-label={t("Filter vehicle status")}
                value={vehicleStatus}
                onChange={(e) => setVehicleStatus(e.target.value)}
              >
                <option value="">{t("All statuses")}</option>
                <option value="ACTIVE">{t("ACTIVE")}</option>
                <option value="INACTIVE">{t("INACTIVE")}</option>
                <option value="MAINTENANCE">{t("MAINTENANCE")}</option>
                <option value="OFFLINE">{t("OFFLINE")}</option>
              </select>
            </div>
          </div>
          {loading && !vehicles.length ? (
            <p className="text-sm text-slate-500">{t("Loading…")}</p>
          ) : !vehicles.length ? (
            <EmptyState title="No vehicles" body="No vehicles match the current filters." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("Registration")}</th>
                    <th>{t("Type")}</th>
                    {variant !== "owner" && <th>{t("Operator")}</th>}
                    <th>{t("Driver")}</th>
                    <th>{t("Route")}</th>
                    <th>{t("GPS")}</th>
                    <th>{t("Route status")}</th>
                    <th>{t("Last update")}</th>
                    <th>{t("Vehicle")}</th>
                  </tr>
                </thead>
                <tbody>
                  {vehicles.map((v) => (
                    <tr
                      key={v.id}
                      className={vehicleRowHasIssue(v, issueIds) ? "is-issue" : undefined}
                      onClick={() => {
                        if (!vehicleRowHasIssue(v, issueIds)) return;
                        setPickedBusId(v.id);
                        document.getElementById("live-monitoring-map")?.scrollIntoView({ block: "start" });
                      }}
                    >
                      <td>{v.registrationNo}</td>
                      <td>{v.vehicleType ?? "—"}</td>
                      {variant !== "owner" && <td>{v.company?.name ?? "—"}</td>}
                      <td>{v.driver?.name ?? "—"}</td>
                      <td>{v.route?.code ?? v.route?.name ?? "—"}</td>
                      <td><Badge tone={tone(v.trackingState)}>{v.trackingState ?? "—"}</Badge></td>
                      <td><Badge tone={tone(v.complianceStatus)}>{v.complianceStatus ?? "—"}</Badge></td>
                      <td>{fmtWhen(v.latestLoc?.timestamp)}</td>
                      <td><Badge tone={tone(v.operationalStatus)}>{v.operationalStatus ?? "—"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={vehiclePage} pageSize={8} total={vehicleTotal} onPage={setVehiclePage} />
        </section>

        <section className="card p-4">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <h3 className="font-display text-base font-semibold tracking-tight">{t("Driver monitoring")}</h3>
            <select
              className="input w-full sm:w-48"
              aria-label={t("Filter drivers")}
              value={driverStatus}
              onChange={(e) => setDriverStatus(e.target.value)}
            >
              <option value="">{t("All drivers")}</option>
              <option value="ACTIVE">{t("Active")}</option>
              <option value="INACTIVE">{t("Inactive")}</option>
              <option value="SUSPENDED">{t("Suspended")}</option>
              <option value="PENDING">{t("Pending license")}</option>
              <option value="VALID">{t("Verified license")}</option>
              <option value="EXPIRED">{t("Expired license")}</option>
            </select>
          </div>
          {loading && !drivers.length ? (
            <p className="text-sm text-slate-500">{t("Loading…")}</p>
          ) : !drivers.length ? (
            <EmptyState title="No drivers" body="No drivers match the current filters." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("Name")}</th>
                    {variant !== "owner" && <th>{t("Operator")}</th>}
                    <th>{t("License")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Vehicle")}</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.id}>
                      <td>{d.fullName ?? "—"}</td>
                      {variant !== "owner" && <td>{d.company?.name ?? "—"}</td>}
                      <td><Badge tone={tone(d.licenseStatus)}>{d.licenseStatus ?? "—"}</Badge></td>
                      <td><Badge tone={tone(d.status)}>{d.status ?? "—"}</Badge></td>
                      <td>{d.buses?.[0]?.registrationNo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <Pager page={driverPage} pageSize={8} total={driverTotal} onPage={setDriverPage} />
        </section>
      </div>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <h3 className="font-display text-base font-semibold tracking-tight">{t("Route overview")}</h3>
          <input
            className="input w-full sm:w-56"
            aria-label={t("Search routes")}
            placeholder={t("Search code or name")}
            value={routeQ}
            onChange={(e) => setRouteQ(e.target.value)}
          />
        </div>
        {!routeRows.length ? <EmptyState title="No routes" body="No routes are available for this view." /> : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("Code")}</th>
                  <th>{t("Name")}</th>
                  <th>{t("Origin → Destination")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Vehicles")}</th>
                </tr>
              </thead>
              <tbody>
                {routeRows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.code}</td>
                    <td>{r.name}</td>
                    <td>{r.startName} → {r.endName}</td>
                    <td><Badge tone={tone(r.status)}>{r.status}</Badge></td>
                    <td>{r.assignedVehicleCount ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={routePage} pageSize={8} total={routeTotal} onPage={setRoutePage} />
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h3 className="font-display mb-3 text-base font-semibold tracking-tight">{t("Recent alerts / compliance")}</h3>
          {!activity?.alerts.length && !activity?.complianceEvents.length ? (
            <p className="text-sm text-slate-500">{t("No recent events.")}</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {(activity?.alerts ?? []).slice(0, 6).map((a) => (
                <li key={a.id}>
                  <Badge tone={a.severity === "HIGH" || a.severity === "CRITICAL" ? "red" : "yellow"}>{a.type}</Badge>
                  {" "}{a.registrationNo ?? ""} — {a.message}
                </li>
              ))}
              {(activity?.complianceEvents ?? []).slice(0, 4).map((e) => (
                <li key={e.id} className="text-slate-600">
                  {e.registrationNo} {e.routeCode ? `· ${e.routeCode}` : ""}: {e.fromStatus} → {e.toStatus}
                </li>
              ))}
            </ul>
          )}
        </section>
        {showAudit && (
          <section className="card p-4">
            <h3 className="font-display mb-3 text-base font-semibold tracking-tight">{t("Recent administrative activity")}</h3>
            {!activity?.audit.length ? <p className="text-sm text-slate-500">{t("No audit rows.")}</p> : (
              <ul className="space-y-2 text-sm">
                {activity.audit.map((row) => (
                  <li key={row.id}>
                    {row.action} {row.entity ? `· ${row.entity}` : ""} — {row.actor ?? t("system")}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
        <section className="card p-4">
          <h3 className="font-display mb-3 text-base font-semibold tracking-tight">{t("Daily trips (7 days)")}</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series?.dailyTrips ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area dataKey="trips" stroke="var(--brand-primary-active)" fill="var(--info-bg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="card p-4">
          <h3 className="font-display mb-3 text-base font-semibold tracking-tight">{t("Speed violations")}</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={series?.speedViolations ?? []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Area dataKey="count" stroke="var(--warning)" fill="var(--warning-bg)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <p className="text-xs text-slate-500">{overview?.dataLabel}</p>
    </div>
  );
}
