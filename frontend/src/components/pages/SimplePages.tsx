"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { DashboardView, type DashboardVariant } from "@/components/DashboardView";
import { LiveMap } from "@/components/map/LiveMap";
import { ResourceTable } from "@/components/ResourceTable";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api, downloadReport } from "@/lib/api";
import { isEmergencyComplaint } from "@/lib/inbox";
import { getSocket } from "@/lib/socket";
import { useI18n } from "@/lib/i18n";
import type { BusLive, RoleCode } from "@/lib/types";

const REPORT_KIND_LABELS: Record<string, string> = {
  "bus-activity": "Bus activity",
  "driver-performance": "Driver performance",
  "route-violations": "Route violations",
  "speed-violations": "Speed violations",
  sos: "SOS",
  complaints: "Complaints",
  trips: "Trips",
  "vehicle-status": "Vehicle status",
};

export function DashPage({ allow, title, variant = "admin" }: { allow: RoleCode[]; title: string; variant?: DashboardVariant }) {
  return (
    <AppShell allow={allow} title={title}>
      <DashboardView variant={variant} />
    </AppShell>
  );
}

export function MapPage({ allow, title, listenOps = true }: { allow: RoleCode[]; title: string; listenOps?: boolean }) {
  const { t } = useI18n();
  const [buses, setBuses] = useState<BusLive[]>([]);
  const [routes, setRoutes] = useState<Array<{ id: string; name: string; polyline: Array<{ lat: number; lng: number }>; stops?: Array<{ name: string; latitude: number; longitude: number; sequence?: number }> }>>([]);
  useEffect(() => {
    api<Array<{ id: string; name: string; polyline: Array<{ lat: number; lng: number }>; stops?: Array<{ name: string; latitude: number; longitude: number; sequence?: number }> }>>("/routes")
      .then((rows) => setRoutes(Array.isArray(rows) ? rows : []))
      .catch(() => undefined);
    api<{ items: Array<Record<string, unknown>> }>("/gps/live").then((d) => {
      setBuses(
        (d.items ?? []).map((row) => ({
          busId: String(row.busId ?? (row.bus as { id?: string } | undefined)?.id),
          registrationNo: String(row.registrationNo ?? (row.bus as { registrationNo?: string } | undefined)?.registrationNo ?? ""),
          latitude: Number(row.latitude),
          longitude: Number(row.longitude),
          speed: Number(row.speed),
          heading: Number(row.heading ?? 0),
          timestamp: String(row.timestamp),
          statusColor: (row.statusColor as BusLive["statusColor"]) ?? (Number(row.speed) > 50 ? "YELLOW" : "GREEN"),
          hasIssue: row.hasIssue === true,
          operationalStatus: row.operationalStatus ? String(row.operationalStatus) : undefined,
          trackingState: row.trackingState === "STALE" ? "STALE" : "ONLINE",
          complianceStatus: row.complianceStatus ? String(row.complianceStatus) : undefined,
          deviationM: row.deviationM == null ? undefined : Number(row.deviationM),
          routeId: row.routeId ? String(row.routeId) : undefined,
          dataLabel: String(row.dataLabel ?? "SIMULATED"),
        })),
      );
    }).catch(() => undefined);
    const s = getSocket();
    const handler = (p: BusLive) => {
      setBuses((prev) => [...prev.filter((b) => b.busId !== p.busId), p]);
    };
    const onRoute = (payload: Record<string, unknown>) => {
      setBuses((prev) => prev.map((b) => (
        b.busId === payload.busId
          ? { ...b, complianceStatus: String(payload.status ?? b.complianceStatus ?? ""), deviationM: payload.deviationM == null ? b.deviationM : Number(payload.deviationM) }
          : b
      )));
    };
    s.on("bus:location", handler);
    if (listenOps) {
      s.on("bus:location:ops", handler);
      s.on("route:status", onRoute);
    }
    return () => {
      s.off("bus:location", handler);
      s.off("bus:location:ops", handler);
      s.off("route:status", onRoute);
    };
  }, [listenOps]);
  return (
    <AppShell allow={allow} title={title}>
      {!listenOps && (
        <p className="mb-3 text-xs text-slate-500">{t("Public map. GPS is SIMULATED. Markers update over the public Socket.IO channel only.")}</p>
      )}
      <LiveMap buses={buses} routes={routes} />
    </AppShell>
  );
}

export function TablePage({
  allow,
  title,
  path,
  columns,
  pick,
}: {
  allow: RoleCode[];
  title: string;
  path: string;
  columns: Array<{ key: string; label: string }>;
  pick?: (raw: unknown) => Array<Record<string, unknown>>;
}) {
  return (
    <AppShell allow={allow} title={title}>
      <ResourceTable path={path} columns={columns} pick={pick} />
    </AppShell>
  );
}

export function ReportsPage({ allow }: { allow: RoleCode[] }) {
  const { t } = useI18n();
  const kinds = [
    "bus-activity",
    "driver-performance",
    "route-violations",
    "speed-violations",
    "sos",
    "complaints",
    "trips",
    "vehicle-status",
  ];
  return (
    <AppShell allow={allow} title={t("Reports")}>
      <p className="mb-4 text-sm text-slate-500">{t("Exports are generated from this deployment. Demo / simulation data is labeled in the files.")}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {kinds.map((kind) => (
          <div key={kind} className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-medium">{t(REPORT_KIND_LABELS[kind] ?? kind)}</div>
            <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap">
              <button className="btn btn-ghost w-full sm:w-auto" onClick={() => downloadReport(kind, "csv")}>{t("CSV")}</button>
              <button className="btn btn-ghost w-full sm:w-auto" onClick={() => downloadReport(kind, "xlsx")}>{t("Excel")}</button>
              <button className="btn btn-primary w-full sm:w-auto" onClick={() => downloadReport(kind, "pdf")}>{t("PDF")}</button>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}

export function AnalyticsPage({ allow, variant = "admin" }: { allow: RoleCode[]; variant?: DashboardVariant }) {
  const { t } = useI18n();
  return (
    <AppShell allow={allow} title={t("Analytics")}>
      <DashboardView showMap={false} variant={variant} />
    </AppShell>
  );
}

export { SosDesk, SosButtonPage } from "@/components/SosWorkflow";

export function ComplaintDesk({ allow, canManage }: { allow: RoleCode[]; canManage?: boolean }) {
  const { t } = useI18n();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [filter, setFilter] = useState<"all" | "emergency">("all");
  const [error, setError] = useState("");

  function load() {
    api<Array<Record<string, unknown>> | { items?: Array<Record<string, unknown>> }>("/complaints")
      .then((data) => setItems(Array.isArray(data) ? data : data.items ?? []))
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => { load(); }, []);

  async function resolve(id: string, status: string) {
    await api(`/complaints/${id}`, { method: "PUT", body: JSON.stringify({ status, resolution: "Reviewed in demo desk" }) });
    setItems((prev) => prev.map((x) => (x.id === id ? { ...x, status } : x)));
  }

  const visible = items.filter((c) => (filter === "emergency" ? isEmergencyComplaint(c as never) : true));

  return (
    <AppShell allow={allow} title={t("Complaints")}>
      {error && <ErrorState message={error} />}
      <div className="mb-4 toolbar">
        <button type="button" className={`btn ${filter === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("all")}>
          {t("All complaints")}
        </button>
        <button type="button" className={`btn ${filter === "emergency" ? "btn-danger" : "btn-ghost"}`} onClick={() => setFilter("emergency")}>
          {t("Emergencies")}
        </button>
      </div>
      {!visible.length ? (
        <EmptyState title="No complaints" body="No complaints match this filter." />
      ) : (
        <div className="space-y-3">
          {visible.map((c) => {
            const emergency = isEmergencyComplaint(c as never);
            return (
              <div
                key={String(c.id)}
                className={`card p-4 ${
                  emergency ? "border-[var(--error)] bg-[var(--error-bg)] ring-1 ring-[var(--error)]/30" : ""
                }`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <div className="min-w-0">
                    <div className={`font-semibold ${emergency ? "text-[var(--error)]" : ""}`}>
                      {emergency ? t("Emergency · ") : ""}
                      {String(c.subject ?? c.category)}
                    </div>
                    <p className={`mt-1 text-sm ${emergency ? "text-[var(--error)]" : "text-slate-600"}`}>
                      {String(c.description)}
                    </p>
                    <div className={`mt-1 text-xs ${emergency ? "text-[var(--error)]/80" : "text-slate-400"}`}>
                      {String(c.reference ?? "")}
                      {c.reference ? " · " : ""}
                      {c.category ? t(String(c.category)) : ""}
                      {" · "}
                      {String(c.passengerName ?? (c.passenger as { fullName?: string } | undefined)?.fullName ?? "—")}
                      {" · "}
                      {String(c.busRegistrationNo ?? (c.bus as { registrationNo?: string } | undefined)?.registrationNo ?? "—")}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 sm:items-end">
                    {emergency && <Badge tone="red">EMERGENCY</Badge>}
                    {c.priority != null && (
                      <Badge tone={String(c.priority) === "CRITICAL" || String(c.priority) === "HIGH" ? "red" : "slate"}>
                        {t(String(c.priority))}
                      </Badge>
                    )}
                    <Badge tone={String(c.status) === "RESOLVED" ? "green" : emergency ? "red" : "yellow"}>
                      {t(String(c.status))}
                    </Badge>
                    {canManage && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button className="btn btn-ghost" onClick={() => resolve(String(c.id), "UNDER_REVIEW")}>{t("Review")}</button>
                        <button className="btn btn-primary" onClick={() => resolve(String(c.id), "RESOLVED")}>{t("Resolve")}</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}

export function ComplaintForm({ allow }: { allow: RoleCode[] }) {
  const { t } = useI18n();
  const [category, setCategory] = useState("OVERSPEEDING");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");
  const categories = ["OVERSPEEDING", "DRIVER_BEHAVIOR", "HARASSMENT_SECURITY", "ROUTE", "BUS_CONDITION", "OTHER"] as const;
  return (
    <AppShell allow={allow} title={t("Submit complaint")}>
      <form
        className="card max-w-lg space-y-3 p-6"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/complaints", { method: "POST", body: JSON.stringify({ category, description }) });
          setMsg(t("Complaint submitted."));
          setDescription("");
        }}
      >
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("Category")}>
          {categories.map((c) => (
            <option key={c} value={c}>{t(c)}</option>
          ))}
        </select>
        <textarea className="input min-h-28" required minLength={8} value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("Describe what happened")} />
        <button className="btn btn-primary">{t("Submit")}</button>
        {msg && <p className="text-sm text-emerald-700">{t(msg)}</p>}
      </form>
    </AppShell>
  );
}

export function DriverOps() {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const [trip, setTrip] = useState<Record<string, unknown> | null>(null);
  return (
    <AppShell allow={["DRIVER", "SUPER_ADMIN"]} title={t("Trip control")}>
      <div className="card max-w-lg space-y-3 p-6">
        <p className="text-sm text-slate-600">{t("Start and end trips for your assigned bus. GPS sharing continues through the simulator or a future device.")}</p>
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            onClick={async () => {
              const row = await api<Record<string, unknown>>("/trips/start", { method: "POST", body: JSON.stringify({}) });
              setTrip(row);
              setMsg(t("Trip started."));
            }}
          >
            {t("Start trip")}
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              const row = await api<Record<string, unknown>>("/trips/end", { method: "POST", body: JSON.stringify({}) });
              setTrip(row);
              setMsg(t("Trip ended."));
            }}
          >
            {t("End trip")}
          </button>
        </div>
        {msg && <p className="text-sm text-emerald-700">{t(msg)}</p>}
        {trip && <pre className="overflow-auto rounded-xl bg-[var(--surface-secondary)] p-3 text-xs">{JSON.stringify(trip, null, 2)}</pre>}
      </div>
    </AppShell>
  );
}

export function SettingsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Array<{ key: string; value: string }>>([]);
  const [key, setKey] = useState("app.announcement");
  const [value, setValue] = useState("");
  useEffect(() => {
    api<Array<{ key: string; value: string }>>("/settings").then(setRows).catch(() => undefined);
  }, []);
  return (
    <AppShell allow={["SUPER_ADMIN"]} title={t("System settings")}>
      <form
        className="card mb-4 flex flex-wrap gap-2 p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          await api("/settings", { method: "PUT", body: JSON.stringify({ key, value }) });
          setRows((prev) => {
            const rest = prev.filter((r) => r.key !== key);
            return [...rest, { key, value }];
          });
        }}
      >
        <input className="input max-w-xs" value={key} onChange={(e) => setKey(e.target.value)} />
        <input className="input max-w-sm" value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn btn-primary">{t("Save")}</button>
      </form>
      <ResourceTable path="/settings" columns={[{ key: "key", label: "Key" }, { key: "value", label: "Value" }, { key: "groupName", label: "Group" }]} />
    </AppShell>
  );
}

export { PassengerHome } from "@/components/PassengerViews";
