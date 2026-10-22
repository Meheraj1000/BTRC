"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import { Badge, EmptyState, ErrorState } from "./StatCard";

export type OpsEvent = {
  id: string;
  type: string;
  severity: string;
  status: string;
  message: string;
  registrationNo?: string | null;
  driverName?: string | null;
  routeCode?: string | null;
  createdAt: string;
  latitude?: number | null;
  longitude?: number | null;
  deviationM?: number | null;
};

function tone(value?: string) {
  if (!value) return "slate" as const;
  if (["RESOLVED", "LOW", "ON_ROUTE"].includes(value)) return "green" as const;
  if (["ACKNOWLEDGED", "MEDIUM", "DEVIATING"].includes(value)) return "yellow" as const;
  if (["OPEN", "HIGH", "CRITICAL", "OFF_ROUTE"].includes(value)) return "red" as const;
  return "slate" as const;
}

const EVENT_TYPES = ["ROUTE_DEVIATION", "OVERSPEED", "SOS", "ACCIDENT", "SYSTEM"] as const;
const EVENT_TYPE_LABELS: Record<(typeof EVENT_TYPES)[number], string> = {
  ROUTE_DEVIATION: "Route deviation",
  OVERSPEED: "Overspeed",
  SOS: "SOS",
  ACCIDENT: "Accident",
  SYSTEM: "System",
};

export function EventDesk({
  canManage = false,
  path = "/alerts",
}: {
  canManage?: boolean;
  path?: string;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<OpsEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "12" });
    if (q.trim()) p.set("q", q.trim());
    if (type) p.set("type", type);
    if (severity) p.set("severity", severity);
    if (status) p.set("status", status);
    return `${path}?${p.toString()}`;
  }, [path, page, q, type, severity, status]);

  useEffect(() => { setPage(1); }, [q, type, severity, status, path]);

  function load() {
    setLoading(true);
    api<{ items: OpsEvent[]; total?: number }>(query)
      .then((data) => {
        setItems(data.items ?? []);
        setTotal(data.total ?? data.items?.length ?? 0);
        setError("");
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [query]);

  useEffect(() => {
    const socket = getSocket();
    const onAlert = (row: OpsEvent) => {
      setItems((prev) => [row, ...prev.filter((x) => x.id !== row.id)].slice(0, 12));
      setTotal((n) => n + 1);
    };
    socket.on("alert:new", onAlert);
    return () => { socket.off("alert:new", onAlert); };
  }, []);

  async function updateStatus(id: string, next: string) {
    await api(`/alerts/${id}/status`, { method: "PUT", body: JSON.stringify({ status: next }) });
    setItems((prev) => prev.map((row) => (row.id === id ? { ...row, status: next } : row)));
  }

  const pages = Math.max(1, Math.ceil(total / 12));

  return (
    <div className="space-y-3">
      {error && <ErrorState message={error} />}
      <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
        {t("Operational events use the existing Alert record. Severity is rule-based (not AI). SOS rows here are the companion alert; the emergency desk owns the SOS lifecycle. This is not a live dispatch feed.")}
      </p>
      <div className="card toolbar p-3">
        <input className="input" aria-label={t("Search events")} placeholder={t("Registration or message")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input sm:w-40" aria-label={t("Filter event type")} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">{t("All types")}</option>
          {EVENT_TYPES.map((ev) => (
            <option key={ev} value={ev}>{t(EVENT_TYPE_LABELS[ev])}</option>
          ))}
        </select>
        <select className="input sm:w-36" aria-label={t("Filter severity")} value={severity} onChange={(e) => setSeverity(e.target.value)}>
          <option value="">{t("All severity")}</option>
          {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
            <option key={s} value={s}>{t(s)}</option>
          ))}
        </select>
        <select className="input sm:w-40" aria-label={t("Filter status")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("All status")}</option>
          {["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((s) => (
            <option key={s} value={s}>{t(s)}</option>
          ))}
        </select>
      </div>
      {loading && !items.length ? <p className="text-sm text-slate-500">{t("Loading…")}</p> : !items.length ? (
        <EmptyState title="No events" body="No operational events match the current filters." />
      ) : (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>{t("Type")}</th>
                <th>{t("Severity")}</th>
                <th>{t("Vehicle")}</th>
                <th>{t("Route")}</th>
                <th>{t("Message")}</th>
                <th>{t("Status")}</th>
                {canManage && <th>{t("Action")}</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td>{t(EVENT_TYPE_LABELS[row.type as keyof typeof EVENT_TYPE_LABELS] ?? row.type)}</td>
                  <td><Badge tone={tone(row.severity)}>{row.severity}</Badge></td>
                  <td>{row.registrationNo ?? "—"}</td>
                  <td>{row.routeCode ?? "—"}</td>
                  <td className="max-w-xs truncate">{row.message}</td>
                  <td><Badge tone={tone(row.status)}>{row.status}</Badge></td>
                  {canManage && (
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {row.status === "OPEN" && <button type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={() => updateStatus(row.id, "ACKNOWLEDGED")}>{t("Ack")}</button>}
                        {row.status !== "RESOLVED" && <button type="button" className="btn btn-primary px-2 py-1 text-xs" onClick={() => updateStatus(row.id, "RESOLVED")}>{t("Resolve")}</button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pager">
        <span>{total} {t("events")}</span>
        <div className="pager-actions">
          <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("Previous")}</button>
          <span className="self-center">{t("Page")} {page} / {pages}</span>
          <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Next")}</button>
        </div>
      </div>
    </div>
  );
}
