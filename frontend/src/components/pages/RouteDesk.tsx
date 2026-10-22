"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/map/LiveMap";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { BusLive, RoleCode } from "@/lib/types";

type Mode = "admin" | "owner" | "readonly";

type Stop = { id?: string; name: string; sequence: number; latitude: number; longitude: number; dwellSeconds?: number };
type RouteRow = {
  id: string;
  code: string;
  name: string;
  startName: string;
  endName: string;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  city: string;
  allowedSpeed: number;
  status: string;
  companyId?: string | null;
  isDemo?: boolean;
  assignedVehicleCount?: number;
  polyline: Array<{ lat: number; lng: number }>;
  stops: Stop[];
  company?: { id?: string; name?: string } | null;
  buses?: Array<{ id: string; registrationNo: string; operationalStatus: string }>;
};

type VehicleOpt = { id: string; registrationNo: string; operationalStatus?: string };
type ComplianceSummary = {
  activeRoutes: number;
  vehiclesOnRoute: number;
  vehiclesOffRoute: number;
  vehiclesDeviating: number;
  vehiclesStale: number;
  deviationsToday: number;
};
type ComplianceEvent = {
  id: string;
  registrationNo: string;
  fromStatus: string;
  toStatus: string;
  deviationM: number | null;
  createdAt: string;
};

function toneFor(status?: string): "green" | "yellow" | "red" | "slate" {
  if (status === "ACTIVE" || status === "ON_ROUTE") return "green";
  if (status === "NEAR_ROUTE" || status === "DEVIATING") return "yellow";
  if (status === "OFF_ROUTE" || status === "INACTIVE" || status === "STALE") return "red";
  return "slate";
}

function linesToPolyline(text: string) {
  return text
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [lat, lng] = line.split(",").map((v) => Number(v.trim()));
      return { lat, lng };
    });
}

function polylineToLines(points: Array<{ lat: number; lng: number }>) {
  return points.map((p) => `${p.lat},${p.lng}`).join("\n");
}

export function RouteDesk({
  allow,
  title,
  mode,
}: {
  allow: RoleCode[];
  title: string;
  mode: Mode;
}) {
  const { t } = useI18n();
  const { user } = useAuth();
  const canManage = mode === "admin" || mode === "owner";
  const showCompany = mode === "admin" || Boolean(user?.roles.includes("SUPER_ADMIN"));

  const [items, setItems] = useState<RouteRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<RouteRow | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RouteRow | null>(null);
  const [busy, setBusy] = useState(false);
  const [vehicles, setVehicles] = useState<VehicleOpt[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [events, setEvents] = useState<ComplianceEvent[]>([]);
  const [live, setLive] = useState<BusLive[]>([]);
  const [assignBusId, setAssignBusId] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    return p.toString();
  }, [page, q, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items: RouteRow[]; total: number }>(`/routes?${query}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setSelected((cur) => (cur ? data.items.find((r) => r.id === cur.id) ?? cur : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load routes");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    api<ComplianceSummary>("/routes/compliance/summary").then(setSummary).catch(() => undefined);
    if (canManage) {
      api<{ items?: VehicleOpt[] } | VehicleOpt[]>("/buses?pageSize=100")
        .then((data) => setVehicles(Array.isArray(data) ? data : data.items ?? []))
        .catch(() => undefined);
    }
  }, [canManage]);

  useEffect(() => {
    if (!selected) {
      setEvents([]);
      return;
    }
    api<{ items: ComplianceEvent[] }>(`/routes/${selected.id}/events?pageSize=20`)
      .then((data) => setEvents(data.items ?? []))
      .catch(() => setEvents([]));
    api<RouteRow>(`/routes/${selected.id}`)
      .then((row) => setSelected(row))
      .catch(() => undefined);
  }, [selected?.id]);

  useEffect(() => {
    api<{ items: Array<Record<string, unknown>> }>("/gps/live")
      .then((d) => setLive((d.items ?? []).map(toLive)))
      .catch(() => undefined);
    const socket = getSocket();
    const onLoc = (row: Record<string, unknown>) => {
      const next = toLive(row);
      setLive((prev) => [...prev.filter((b) => b.busId !== next.busId), next]);
    };
    const onRoute = (row: Record<string, unknown>) => {
      setLive((prev) => prev.map((b) => (
        b.busId === row.busId
          ? { ...b, complianceStatus: String(row.status), deviationM: row.deviationM == null ? undefined : Number(row.deviationM) }
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

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const polyline = linesToPolyline(String(fd.get("polyline") ?? ""));
    const stopNames = String(fd.get("stopNames") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    const stopCoords = String(fd.get("stopCoords") ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
    const stops = stopNames.map((name, i) => {
      const [lat, lng] = (stopCoords[i] ?? "").split(",").map((v) => Number(v.trim()));
      return { name, sequence: i + 1, latitude: lat, longitude: lng, dwellSeconds: 30 };
    });
    const payload = {
      code: String(fd.get("code") ?? ""),
      name: String(fd.get("name") ?? ""),
      city: String(fd.get("city") ?? ""),
      startName: String(fd.get("startName") ?? ""),
      endName: String(fd.get("endName") ?? ""),
      startLat: Number(fd.get("startLat")),
      startLng: Number(fd.get("startLng")),
      endLat: Number(fd.get("endLat")),
      endLng: Number(fd.get("endLng")),
      allowedSpeed: Number(fd.get("allowedSpeed") || 40),
      polyline,
      stops: stops.length ? stops : undefined,
    };
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editing) {
        await api(`/routes/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setNotice("Route updated.");
      } else {
        await api("/routes", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Route created. This is an operator catalog entry, not an official BRTA permit.");
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  async function setRouteStatus(id: string, next: "ACTIVE" | "INACTIVE") {
    setBusy(true);
    try {
      await api(`/routes/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setNotice(next === "ACTIVE" ? "Route activated." : "Route deactivated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    if (!window.confirm(t("Archive this route? Assigned history is kept."))) return;
    setBusy(true);
    try {
      await api(`/routes/${id}`, { method: "DELETE" });
      setNotice("Route archived.");
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!selected || !assignBusId) return;
    setBusy(true);
    try {
      const row = await api<RouteRow>(`/routes/${selected.id}/assign`, { method: "POST", body: JSON.stringify({ busId: assignBusId }) });
      setSelected(row);
      setAssignBusId("");
      setNotice("Vehicle assigned to route.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  }

  async function unassign(busId: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const row = await api<RouteRow>(`/routes/${selected.id}/assignments/${busId}`, { method: "DELETE" });
      setSelected(row);
      setNotice("Vehicle removed from route.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unassign failed");
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / 20));
  const selectedLive = live.filter((b) => selected && (b.routeId === selected.id || selected.buses?.some((x) => x.id === b.busId)));

  return (
    <AppShell allow={allow} title={title}>
      {error && <ErrorState message={t(error)} />}
      {notice && <p className="mb-3 text-sm text-[var(--success)]">{t(notice)}</p>}
      {summary && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Summary label={t("Active routes")} value={summary.activeRoutes} />
          <Summary label={t("On route")} value={summary.vehiclesOnRoute} />
          <Summary label={t("Off route")} value={summary.vehiclesOffRoute} />
          <Summary label={t("Deviating")} value={summary.vehiclesDeviating} />
          <Summary label={t("Stale GPS")} value={summary.vehiclesStale} />
        </div>
      )}
      <div className="toolbar card mb-4 p-3 sm:p-4">
        <input className="input" placeholder={t("Search code, name, city")} value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select className="input sm:w-40" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">{t("All statuses")}</option>
          <option value="ACTIVE">{t("ACTIVE")}</option>
          <option value="INACTIVE">{t("INACTIVE")}</option>
        </select>
        {canManage && (
          <button className="btn btn-primary" onClick={() => { setEditing(null); setFormOpen(true); }}>{t("New route")}</button>
        )}
      </div>
      {loading ? <p className="text-sm text-slate-500">{t("Loading…")}</p> : !items.length ? (
        <EmptyState title={t("No routes")} body={t("No routes match the current filters.")} />
      ) : (
        <div className="card table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("Code")}</th>
                <th>{t("Name")}</th>
                <th>{t("Origin → Destination")}</th>
                <th>{t("Status")}</th>
                <th>{t("Vehicles")}</th>
                {showCompany && <th>{t("Operator")}</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id} className={selected?.id === row.id ? "bg-[var(--surface-secondary)]" : undefined} onClick={() => setSelected(row)}>
                  <td>{row.code}</td>
                  <td>{row.name}</td>
                  <td>{row.startName} → {row.endName}</td>
                  <td><Badge tone={toneFor(row.status)}>{t(row.status)}</Badge></td>
                  <td>{row.assignedVehicleCount ?? 0}</td>
                  {showCompany && <td>{row.company?.name ?? t("Shared / demo")}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pager">
        <div className="pager-actions">
          <button className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{t("Previous")}</button>
          <span className="self-center">{t("Page")} {page} / {pages}</span>
          <button className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>{t("Next")}</button>
        </div>
      </div>

      {selected && (
        <div className="mt-6 grid gap-4 lg:grid-cols-2">
          <div className="card p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="min-w-0 font-semibold">{selected.code} · {selected.name}</h2>
              <Badge tone={toneFor(selected.status)}>{t(selected.status)}</Badge>
            </div>
            <p className="text-sm text-slate-500">{selected.startName} → {selected.endName} · {selected.city} · {selected.allowedSpeed} {t("km/h")}</p>
            <p className="mt-1 text-xs text-slate-400">{t("Rule-based corridor only. Not an official BRTA route permit.")}</p>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm">
              {selected.stops.map((s) => (
                <li key={`${s.sequence}-${s.name}`}>{s.name} ({s.latitude.toFixed(4)}, {s.longitude.toFixed(4)})</li>
              ))}
            </ol>
            {canManage && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn btn-ghost" onClick={() => { setEditing(selected); setFormOpen(true); }}>{t("Edit")}</button>
                <button className="btn btn-ghost" onClick={() => void setRouteStatus(selected.id, selected.status === "ACTIVE" ? "INACTIVE" : "ACTIVE")}>
                  {selected.status === "ACTIVE" ? t("Deactivate") : t("Activate")}
                </button>
                <button className="btn btn-ghost" onClick={() => void archive(selected.id)}>{t("Archive")}</button>
              </div>
            )}
            {canManage && (
              <div className="mt-4 flex flex-wrap gap-2">
                <select className="input max-w-xs" value={assignBusId} onChange={(e) => setAssignBusId(e.target.value)}>
                  <option value="">{t("Assign vehicle…")}</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNo}</option>)}
                </select>
                <button className="btn btn-primary" disabled={!assignBusId || busy} onClick={() => void assign()}>{t("Assign")}</button>
              </div>
            )}
            <ul className="mt-3 space-y-1 text-sm">
              {(selected.buses ?? []).map((b) => (
                <li key={b.id} className="flex items-center justify-between">
                  <span>{b.registrationNo} · {t(b.operationalStatus)}</span>
                  {canManage && <button className="btn btn-ghost" onClick={() => void unassign(b.id)}>{t("Remove")}</button>}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <LiveMap
              buses={selectedLive}
              routes={[{ id: selected.id, name: selected.name, polyline: selected.polyline, stops: selected.stops }]}
            />
            <div className="card mt-3 p-4">
              <h3 className="mb-2 text-sm font-semibold">{t("Compliance events")}</h3>
              {!events.length ? <p className="text-sm text-slate-500">{t("No status transitions yet.")}</p> : (
                <ul className="space-y-1 text-sm">
                  {events.map((ev) => (
                    <li key={ev.id}>
                      {ev.registrationNo}: {t(ev.fromStatus)} → {t(ev.toStatus)}
                      {ev.deviationM != null ? ` (${Math.round(ev.deviationM)} m)` : ""} · {new Date(ev.createdAt).toLocaleString()}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {formOpen && canManage && (
        <form className="card mt-6 grid gap-3 p-4 md:grid-cols-2" onSubmit={(e) => void submitForm(e)}>
          <h2 className="md:col-span-2 font-semibold">{editing ? t("Edit route") : t("Create route")}</h2>
          <label className="text-sm">{t("Code")}<input className="input mt-1" name="code" defaultValue={editing?.code} required /></label>
          <label className="text-sm">{t("Name")}<input className="input mt-1" name="name" defaultValue={editing?.name} required /></label>
          <label className="text-sm">{t("City")}<input className="input mt-1" name="city" defaultValue={editing?.city} required /></label>
          <label className="text-sm">{t("Speed limit")}<input className="input mt-1" name="allowedSpeed" type="number" defaultValue={editing?.allowedSpeed ?? 40} /></label>
          <label className="text-sm">{t("Origin name")}<input className="input mt-1" name="startName" defaultValue={editing?.startName} required /></label>
          <label className="text-sm">{t("Destination name")}<input className="input mt-1" name="endName" defaultValue={editing?.endName} required /></label>
          <label className="text-sm">{t("Origin lat")}<input className="input mt-1" name="startLat" type="number" step="any" defaultValue={editing?.startLat} required /></label>
          <label className="text-sm">{t("Origin lng")}<input className="input mt-1" name="startLng" type="number" step="any" defaultValue={editing?.startLng} required /></label>
          <label className="text-sm">{t("Destination lat")}<input className="input mt-1" name="endLat" type="number" step="any" defaultValue={editing?.endLat} required /></label>
          <label className="text-sm">{t("Destination lng")}<input className="input mt-1" name="endLng" type="number" step="any" defaultValue={editing?.endLng} required /></label>
          <label className="text-sm md:col-span-2">{t("Path (one lat,lng per line)")}
            <textarea className="input mt-1 min-h-28" name="polyline" defaultValue={polylineToLines(editing?.polyline ?? [])} required />
          </label>
          <label className="text-sm">{t("Stop names (one per line)")}
            <textarea className="input mt-1 min-h-24" name="stopNames" defaultValue={(editing?.stops ?? []).map((s) => s.name).join("\n")} />
          </label>
          <label className="text-sm">{t("Stop coordinates (lat,lng per line)")}
            <textarea className="input mt-1 min-h-24" name="stopCoords" defaultValue={(editing?.stops ?? []).map((s) => `${s.latitude},${s.longitude}`).join("\n")} />
          </label>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <button className="btn btn-primary w-full sm:w-auto" disabled={busy}>{editing ? t("Save") : t("Create")}</button>
            <button type="button" className="btn btn-ghost w-full sm:w-auto" onClick={() => { setFormOpen(false); setEditing(null); }}>{t("Cancel")}</button>
          </div>
        </form>
      )}
    </AppShell>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function toLive(row: Record<string, unknown>): BusLive {
  return {
    busId: String(row.busId ?? ""),
    registrationNo: String(row.registrationNo ?? ""),
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    speed: Number(row.speed),
    heading: Number(row.heading ?? 0),
    timestamp: String(row.timestamp ?? ""),
    statusColor: (row.statusColor as BusLive["statusColor"]) ?? "GREEN",
    trackingState: row.trackingState === "STALE" ? "STALE" : "ONLINE",
    complianceStatus: row.complianceStatus ? String(row.complianceStatus) : undefined,
    deviationM: row.deviationM == null ? undefined : Number(row.deviationM),
    routeId: row.routeId ? String(row.routeId) : undefined,
    dataLabel: String(row.dataLabel ?? "SIMULATED"),
  };
}
