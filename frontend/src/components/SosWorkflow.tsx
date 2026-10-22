"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/map/LiveMap";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { getSocket } from "@/lib/socket";
import type { BusLive, RoleCode } from "@/lib/types";

export type SosRecord = {
  id: string;
  status: string;
  severity?: string;
  category?: string;
  message?: string | null;
  createdAt: string;
  updatedAt?: string;
  locationAvailable?: boolean;
  locationSource?: string;
  latitude?: number | null;
  longitude?: number | null;
  registrationNo?: string | null;
  routeCode?: string | null;
  routeName?: string | null;
  requesterName?: string | null;
  driverName?: string | null;
  internalNote?: string | null;
  vehicleLocation?: { latitude: number; longitude: number; stale?: boolean; timestamp?: string } | null;
  existing?: boolean;
  dataLabel?: string;
};

function tone(value?: string) {
  if (!value) return "slate" as const;
  if (["RESOLVED", "CLOSED", "CANCELLED"].includes(value)) return "green" as const;
  if (["ACKNOWLEDGED", "INVESTIGATING", "DISPATCHED", "RESPONDING"].includes(value)) return "yellow" as const;
  if (["OPEN", "CRITICAL"].includes(value)) return "red" as const;
  return "slate" as const;
}

function nextActions(status: string, t: (text: string) => string) {
  if (status === "OPEN") {
    return [
      { label: t("Acknowledge"), value: "ACKNOWLEDGED" },
      { label: t("False alarm"), value: "FALSE_ALARM" },
    ];
  }
  if (status === "ACKNOWLEDGED") {
    return [
      { label: t("Investigate"), value: "INVESTIGATING" },
      { label: t("Dispatch note"), value: "DISPATCHED" },
      { label: t("Respond"), value: "RESPONDING" },
      { label: t("Resolve"), value: "RESOLVED" },
      { label: t("False alarm"), value: "FALSE_ALARM" },
    ];
  }
  if (status === "INVESTIGATING") {
    return [
      { label: t("Respond"), value: "RESPONDING" },
      { label: t("Dispatch note"), value: "DISPATCHED" },
      { label: t("Resolve"), value: "RESOLVED" },
      { label: t("False alarm"), value: "FALSE_ALARM" },
    ];
  }
  if (status === "DISPATCHED") return [{ label: t("Respond"), value: "RESPONDING" }, { label: t("Resolve"), value: "RESOLVED" }];
  if (status === "RESPONDING") return [{ label: t("Resolve"), value: "RESOLVED" }];
  if (status === "RESOLVED" || status === "FALSE_ALARM" || status === "CANCELLED") {
    return [{ label: t("Close"), value: "CLOSED" }];
  }
  return [];
}

const SOS_CATEGORIES = ["SAFETY", "MEDICAL", "ACCIDENT", "OTHER"] as const;
const SOS_CATEGORY_LABELS: Record<(typeof SOS_CATEGORIES)[number], string> = {
  SAFETY: "Safety",
  MEDICAL: "Medical",
  ACCIDENT: "Accident",
  OTHER: "Other",
};

export function SosButtonPage({ allow, title }: { allow: RoleCode[]; title: string }) {
  const { t } = useI18n();
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("SAFETY");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<SosRecord | null>(null);
  const [history, setHistory] = useState<SosRecord[]>([]);
  const [key, setKey] = useState(() => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}`));

  function newKey() {
    setKey(typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
  }

  function loadHistory() {
    api<{ items: SosRecord[] }>("/sos?page=1&pageSize=10")
      .then((data) => setHistory(data.items ?? []))
      .catch(() => undefined);
  }

  useEffect(() => {
    loadHistory();
    const socket = getSocket();
    const onUpdate = (row: SosRecord) => {
      setCreated((prev) => (prev && prev.id === row.id ? { ...prev, ...row } : prev));
      setHistory((prev) => [row, ...prev.filter((x) => x.id !== row.id)].slice(0, 10));
    };
    socket.on("sos:update", onUpdate);
    return () => { socket.off("sos:update", onUpdate); };
  }, []);

  const active = history.find((s) => ["OPEN", "ACKNOWLEDGED", "DISPATCHED", "INVESTIGATING", "RESPONDING"].includes(s.status));

  async function send() {
    setBusy(true);
    setError("");
    try {
      const pos = await new Promise<GeolocationPosition | null>((resolve) => {
        if (!navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition((p) => resolve(p), () => resolve(null), { timeout: 8000 });
      });
      const body: Record<string, unknown> = {
        message: message || undefined,
        category,
        idempotencyKey: key,
      };
      if (pos) {
        body.latitude = pos.coords.latitude;
        body.longitude = pos.coords.longitude;
      }
      const row = await api<SosRecord>("/sos", { method: "POST", body: JSON.stringify(body) });
      setCreated(row);
      setConfirm(false);
      if (!row.existing) newKey();
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("SOS could not be recorded"));
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    setBusy(true);
    try {
      const row = await api<SosRecord>(`/sos/${id}/cancel`, { method: "POST", body: JSON.stringify({}) });
      setCreated(row);
      newKey();
      loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Cancel failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell allow={allow} title={title}>
      <div className="mx-auto grid w-full max-w-lg gap-4 lg:mx-0 lg:max-w-none lg:grid-cols-2">
        <div className="card w-full max-w-lg border-l-4 border-l-[var(--error)] p-4 sm:p-6 lg:max-w-none">
          <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--error)] sm:text-xl">{t("Emergency SOS")}</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {t("This records an SOS in the Nirapad Transit application for authorized monitoring accounts.")}{" "}
            {t("It does not call 999, police, ambulance, or any government dispatch service.")}
          </p>
          {active && (
            <p className="mt-3 rounded-xl bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
              {t("You already have an active SOS")} ({t(active.status)}). {t("A new press reuses that record.")}
            </p>
          )}
          <label className="mt-4 block text-sm font-medium">{t("Category")}</label>
          <select className="input mt-1" value={category} onChange={(e) => setCategory(e.target.value)} aria-label={t("SOS category")}>
            {SOS_CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(SOS_CATEGORY_LABELS[c])}</option>
            ))}
          </select>
          <textarea className="input mt-3 min-h-24" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("Optional details for monitors")} />
          {error && <div className="mt-3"><ErrorState message={error} /></div>}
          {!confirm ? (
            <button className="btn btn-danger mt-4 w-full py-3 text-base" onClick={() => setConfirm(true)}>{t("Trigger SOS")}</button>
          ) : (
            <div className="mt-4 space-y-2 rounded-xl bg-[var(--error-bg)] p-3">
              <p className="text-sm font-medium text-[var(--error)]">{t("Confirm: record an application SOS? This is a demo workflow only.")}</p>
              <div className="flex gap-2">
                <button className="btn btn-danger py-3" disabled={busy} onClick={() => void send()}>{busy ? t("Recording…") : t("Confirm SOS")}</button>
                <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirm(false)}>{t("Back")}</button>
              </div>
            </div>
          )}
          {created && (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm">
              <div className="font-semibold">{created.existing ? t("SOS already active") : t("SOS recorded")}</div>
              <div>{t("Reference:")} {created.id}</div>
              <div>{t("Status:")} <Badge tone={tone(created.status)}>{created.status}</Badge></div>
              <div>{t("Time:")} {new Date(created.createdAt).toLocaleString()}</div>
              <div>
                {t("Location:")}{" "}
                {created.locationAvailable && created.latitude != null && created.longitude != null
                  ? `${created.latitude.toFixed(4)}, ${created.longitude.toFixed(4)} (${created.locationSource})`
                  : t("Unavailable — no device coordinates were captured")}
              </div>
              {created.registrationNo && <div>{t("Vehicle:")} {created.registrationNo}</div>}
              {created.routeName && <div>{t("Route:")} {created.routeName}</div>}
              {created.dataLabel && <p className="mt-2 text-xs text-[var(--text-muted)]">{t(created.dataLabel)}</p>}
              {created.status === "OPEN" && (
                <button className="btn btn-outline mt-3" disabled={busy} onClick={() => void cancel(created.id)}>{t("Cancel this SOS")}</button>
              )}
            </div>
          )}
        </div>
        <div className="card p-4">
          <h2 className="font-display mb-2 text-base font-semibold tracking-tight">{t("Your SOS history")}</h2>
          {!history.length ? <EmptyState title="No SOS records" body="Only your own SOS events appear here." /> : (
            <ul className="space-y-2 text-sm">
              {history.map((s) => (
                <li key={s.id} className="rounded-xl border border-[var(--border)] px-3 py-2">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{new Date(s.createdAt).toLocaleString()}</span>
                    <Badge tone={tone(s.status)}>{s.status}</Badge>
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">{s.locationAvailable ? t("Location captured") : t("Location unavailable")}</div>
                  {s.status === "OPEN" && (
                    <button className="btn btn-ghost mt-2" disabled={busy} onClick={() => void cancel(s.id)}>{t("Cancel")}</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

export function SosDesk({ allow }: { allow: RoleCode[] }) {
  const { t } = useI18n();
  const [items, setItems] = useState<SosRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SosRecord | null>(null);
  const [note, setNote] = useState("");
  const [buses, setBuses] = useState<BusLive[]>([]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "12" });
    if (q.trim()) p.set("q", q.trim());
    if (status) p.set("status", status);
    if (from) p.set("from", new Date(from).toISOString());
    return `/sos?${p.toString()}`;
  }, [page, q, status, from]);

  useEffect(() => { setPage(1); }, [q, status, from]);

  function load() {
    setLoading(true);
    api<{ items: SosRecord[]; total?: number }>(query)
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
    const onNew = (row: SosRecord) => {
      setItems((prev) => [row, ...prev.filter((x) => x.id !== row.id)].slice(0, 12));
      setTotal((n) => n + 1);
    };
    socket.on("sos:new", onNew);
    socket.on("sos:update", onNew);
    return () => {
      socket.off("sos:new", onNew);
      socket.off("sos:update", onNew);
    };
  }, []);

  useEffect(() => {
    if (!selected?.vehicleLocation) {
      setBuses([]);
      return;
    }
    setBuses([{
      busId: selected.registrationNo ?? "vehicle",
      registrationNo: selected.registrationNo ?? t("Vehicle GPS"),
      latitude: selected.vehicleLocation.latitude,
      longitude: selected.vehicleLocation.longitude,
      speed: 0,
      heading: 0,
      timestamp: selected.vehicleLocation.timestamp ?? new Date().toISOString(),
      dataLabel: selected.vehicleLocation.stale ? t("VEHICLE GPS STALE") : t("VEHICLE GPS"),
    }]);
  }, [selected]);

  async function update(id: string, next: string) {
    const row = await api<SosRecord>(`/sos/${id}/status`, { method: "PUT", body: JSON.stringify({ status: next }) });
    setItems((prev) => prev.map((x) => (x.id === id ? row : x)));
    setSelected(row);
  }

  async function saveNote() {
    if (!selected) return;
    const row = await api<SosRecord>(`/sos/${selected.id}/note`, { method: "PUT", body: JSON.stringify({ internalNote: note }) });
    setSelected(row);
    setItems((prev) => prev.map((x) => (x.id === row.id ? row : x)));
  }

  const pages = Math.max(1, Math.ceil(total / 12));
  const sosPoint = selected?.locationAvailable && selected.latitude != null && selected.longitude != null
    ? { lat: selected.latitude, lng: selected.longitude, label: t("SOS") }
    : null;

  return (
    <AppShell allow={allow} title={t("Emergency SOS")}>
      {error && <ErrorState message={error} />}
      <p className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
        {t("Application SOS desk. Status changes are recorded in this system only. No police, ambulance, or 999 dispatch is connected.")}
      </p>
      <div className="card toolbar mb-3 p-3">
        <input className="input" aria-label={t("Search SOS")} placeholder={t("Name, message, registration")} value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="input sm:w-44" aria-label={t("Filter SOS status")} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{t("All status")}</option>
          {["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESPONDING", "DISPATCHED", "RESOLVED", "CANCELLED", "CLOSED", "FALSE_ALARM"].map((s) => (
            <option key={s} value={s}>{t(s)}</option>
          ))}
        </select>
        <input className="input sm:w-44" type="date" aria-label={t("From date")} value={from} onChange={(e) => setFrom(e.target.value)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <div>
          {loading && !items.length ? <p className="text-sm text-slate-500">{t("Loading…")}</p> : !items.length ? (
            <EmptyState title="No SOS events" body="No SOS records match the current filters." />
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>{t("Time")}</th>
                    <th>{t("Requester")}</th>
                    <th>{t("Severity")}</th>
                    <th>{t("Status")}</th>
                    <th>{t("Vehicle")}</th>
                    <th>{t("Location")}</th>
                    <th>{t("Action")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((s) => (
                    <tr
                      key={s.id}
                      className={`${selected?.id === s.id ? "bg-[var(--error-bg)]" : "bg-[var(--error-bg)]/40"} cursor-pointer`}
                      onClick={() => { setSelected(s); setNote(s.internalNote ?? ""); }}
                    >
                      <td className="font-medium text-[var(--error)]">{new Date(s.createdAt).toLocaleString()}</td>
                      <td>{s.requesterName ?? "—"}</td>
                      <td><Badge tone="red">{t(s.severity ?? "CRITICAL")}</Badge></td>
                      <td><Badge tone={tone(s.status)}>{s.status}</Badge></td>
                      <td>{s.registrationNo ?? "—"}</td>
                      <td>{s.locationAvailable && s.latitude != null ? `${s.latitude.toFixed(3)}, ${s.longitude?.toFixed(3)}` : t("Unavailable")}</td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {nextActions(s.status, t).map((a) => (
                            <button key={a.value} type="button" className="btn btn-ghost px-2 py-1 text-xs" onClick={(e) => { e.stopPropagation(); void update(s.id, a.value); }}>{a.label}</button>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="pager">
            <span>{total} {t("SOS records")}</span>
            <div className="pager-actions">
              <button type="button" className="btn btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t("Previous")}</button>
              <span className="self-center">{t("Page")} {page} / {pages}</span>
              <button type="button" className="btn btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{t("Next")}</button>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <LiveMap buses={buses} sosLocation={sosPoint} />
          {selected ? (
            <div className="card p-4 text-sm">
              <div className="font-semibold">{t("SOS")} {selected.id}</div>
              <p className="mt-1">{selected.message ?? t("No passenger message")}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">
                {t("SOS marker = requester location (if captured). Bus marker = vehicle GPS when associated. These are not the same source.")}
              </p>
              <label className="mt-3 block text-xs font-semibold uppercase text-[var(--text-muted)]">{t("Internal note (not shown to the requester)")}</label>
              <textarea className="input mt-1 min-h-20" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn btn-primary mt-2" type="button" onClick={() => void saveNote()}>{t("Save note")}</button>
            </div>
          ) : (
            <EmptyState title="Select an SOS" body="Choose a row to see location context and add an internal note." />
          )}
        </div>
      </div>
    </AppShell>
  );
}
