"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import type { BusLive, Overview } from "@/lib/types";
import { EventDesk } from "./EventDesk";
import { LiveMap } from "./map/LiveMap";
import { Badge, EmptyState, ErrorState, StatCard } from "./StatCard";

type VehicleRow = {
  id: string;
  registrationNo: string;
  vehicleType?: string;
  operationalStatus?: string;
  trackingState?: string;
  complianceStatus?: string | null;
  company?: { name?: string | null } | null;
  route?: { name?: string; code?: string; startName?: string } | null;
  driver?: { name?: string | null } | null;
  latestLoc?: { timestamp?: string; speed?: number } | null;
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
    source: String(row.source ?? "SIMULATION"),
    dataLabel: String(row.dataLabel ?? "SIMULATED"),
    trackingState: row.trackingState === "STALE" ? "STALE" : "ONLINE",
    complianceStatus: row.complianceStatus ? String(row.complianceStatus) : undefined,
    deviationM: row.deviationM == null ? undefined : Number(row.deviationM),
    routeId: row.routeId ? String(row.routeId) : undefined,
    routeName: row.routeName ? String(row.routeName) : undefined,
  };
}

function tone(status?: string | null) {
  if (!status) return "slate" as const;
  if (["ACTIVE", "ONLINE", "ON_ROUTE", "VALID"].includes(status)) return "green" as const;
  if (["PENDING", "NEAR_ROUTE", "DEVIATING", "ACKNOWLEDGED"].includes(status)) return "yellow" as const;
  if (["OFF_ROUTE", "STALE", "SUSPENDED", "OFFLINE", "OPEN", "CRITICAL"].includes(status)) return "red" as const;
  return "slate" as const;
}

export function PoliceMonitoring() {
  const { t } = useI18n();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [buses, setBuses] = useState<BusLive[]>([]);
  const [routes, setRoutes] = useState<Array<{ id: string; name: string; polyline: Array<{ lat: number; lng: number }>; stops?: Array<{ name: string; latitude: number; longitude: number; sequence?: number }> }>>([]);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [vehicleTotal, setVehicleTotal] = useState(0);
  const [q, setQ] = useState("");
  const [gpsFilter, setGpsFilter] = useState("");
  const [complianceFilter, setComplianceFilter] = useState("");
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");

  const vehicleQuery = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "8", sortBy: "registrationNo" });
    if (q.trim()) p.set("q", q.trim());
    if (gpsFilter) p.set("trackingState", gpsFilter);
    if (complianceFilter) p.set("complianceStatus", complianceFilter);
    return p.toString();
  }, [q, gpsFilter, complianceFilter, page]);

  useEffect(() => { setPage(1); }, [q, gpsFilter, complianceFilter]);

  useEffect(() => {
    Promise.all([
      api<Overview>("/analytics/overview"),
      api<{ items: Array<Record<string, unknown>> }>("/gps/live"),
      api<Array<{ id: string; name: string; polyline: Array<{ lat: number; lng: number }>; stops?: Array<{ name: string; latitude: number; longitude: number; sequence?: number }> }>>("/routes"),
      api<{ items: VehicleRow[]; total?: number }>(`/buses?${vehicleQuery}`),
    ])
      .then(([o, live, catalog, fleet]) => {
        setOverview(o);
        setBuses((live.items ?? []).map(normalizeLive));
        setRoutes(Array.isArray(catalog) ? catalog : []);
        setVehicles(fleet.items ?? []);
        setVehicleTotal(fleet.total ?? fleet.items?.length ?? 0);
        setError("");
      })
      .catch((err: Error) => setError(err.message));
  }, [vehicleQuery]);

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
  const pages = Math.max(1, Math.ceil(vehicleTotal / 8));

  return (
    <div className="space-y-5">
      {error && <ErrorState message={error} />}
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
        {t(
          "Police / emergency monitoring. GPS is SIMULATED. Route status is rule-based, not AI. SOS is an application workflow — not live 999, police, or ambulance dispatch. Use Emergencies for the full SOS desk.",
        )}
      </p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active vehicles"
          value={cards.activeBuses ?? "—"}
          hint={
            <>
              {cards.totalBuses ?? 0} {t("registered")}
            </>
          }
        />
        <StatCard label="GPS online / stale" value={`${cards.vehiclesOnline ?? 0} / ${cards.vehiclesStale ?? 0}`} />
        <StatCard label="Off route / deviating" value={`${cards.vehiclesOffRoute ?? 0} / ${cards.vehiclesDeviating ?? 0}`} hint="Rule-based" />
        <StatCard label="Deviations today" value={cards.deviationsToday ?? "—"} />
        <StatCard label="Suspended vehicles" value={cards.suspendedVehicles ?? "—"} />
        <StatCard label="Suspended drivers" value={cards.suspendedDrivers ?? "—"} />
        <StatCard label="Open SOS" value={cards.openSos ?? "—"} hint="Monitoring only" />
        <StatCard label="Overspeed today" value={cards.overspeedingAlerts ?? "—"} />
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-base font-semibold tracking-tight">{t("Live emergency map")}</h2>
          <span className="text-xs text-[var(--text-muted)]">
            {t(
              "Bangladesh only · Vehicle logo = live GPS · Ring: green on route · amber warning · red off route · grey stale",
            )}
          </span>
        </div>
        <LiveMap buses={buses} routes={routes} />
      </div>

      <section className="card p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="font-display text-base font-semibold tracking-tight">{t("Vehicle search")}</h3>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">
              {t("Click a registration for driver, vehicle details, and point of origin.")}
            </p>
          </div>
          <div className="toolbar w-full sm:w-auto">
            <input
              className="input"
              aria-label={t("Search registration")}
              placeholder={t("Registration")}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select className="input" aria-label={t("Filter GPS status")} value={gpsFilter} onChange={(e) => setGpsFilter(e.target.value)}>
              <option value="">{t("All GPS")}</option>
              <option value="ONLINE">{t("ONLINE")}</option>
              <option value="STALE">{t("STALE")}</option>
            </select>
            <select
              className="input"
              aria-label={t("Filter compliance")}
              value={complianceFilter}
              onChange={(e) => setComplianceFilter(e.target.value)}
            >
              <option value="">{t("All compliance")}</option>
              <option value="ON_ROUTE">{t("ON_ROUTE")}</option>
              <option value="NEAR_ROUTE">{t("NEAR_ROUTE")}</option>
              <option value="DEVIATING">{t("DEVIATING")}</option>
              <option value="OFF_ROUTE">{t("OFF_ROUTE")}</option>
              <option value="STALE">{t("STALE")}</option>
            </select>
            <Link className="btn btn-primary" href={q.trim() ? `/police/buses?q=${encodeURIComponent(q.trim())}` : "/police/buses"}>
              {t("Full vehicle lookup")}
            </Link>
          </div>
        </div>
        {!vehicles.length ? <EmptyState title="No vehicles" body="No vehicles match the current operational filters." /> : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("Registration")}</th>
                  <th>{t("Operator")}</th>
                  <th>{t("Driver")}</th>
                  <th>{t("Origin")}</th>
                  <th>{t("Route")}</th>
                  <th>{t("GPS")}</th>
                  <th>{t("Compliance")}</th>
                  <th>{t("Speed")}</th>
                  <th>{t("Vehicle")}</th>
                </tr>
              </thead>
              <tbody>
                {vehicles.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link
                        className="font-medium text-brand-700 underline"
                        href={`/police/buses?q=${encodeURIComponent(v.registrationNo)}`}
                      >
                        {v.registrationNo}
                      </Link>
                    </td>
                    <td>{v.company?.name ?? "—"}</td>
                    <td>{v.driver?.name ?? "—"}</td>
                    <td>{v.route?.startName ?? "—"}</td>
                    <td>{v.route?.code ?? v.route?.name ?? "—"}</td>
                    <td><Badge tone={tone(v.trackingState)}>{v.trackingState ?? "—"}</Badge></td>
                    <td><Badge tone={tone(v.complianceStatus)}>{v.complianceStatus ?? "—"}</Badge></td>
                    <td>{v.latestLoc?.speed != null ? `${Number(v.latestLoc.speed).toFixed(0)} km/h` : "—"}</td>
                    <td><Badge tone={tone(v.operationalStatus)}>{v.operationalStatus ?? "—"}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="pager">
          <span>
            {vehicleTotal} {t("vehicles")}
          </span>
          <div className="pager-actions">
            <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t("Previous")}
            </button>
            <span className="self-center">
              {t("Page")} {page} / {pages}
            </span>
            <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              {t("Next")}
            </button>
          </div>
        </div>
      </section>

      <section className="card p-4">
        <h3 className="font-display mb-3 text-base font-semibold tracking-tight">{t("Important events")}</h3>
        <EventDesk canManage />
      </section>
    </div>
  );
}
