"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BusQrCard } from "@/components/BusQrCard";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { RoleCode } from "@/lib/types";

type Mode = "admin" | "owner" | "brta" | "readonly";

type Vehicle = {
  id: string;
  registrationNo: string;
  qrToken?: string | null;
  qrUrl?: string | null;
  vehicleType?: string;
  manufacturer?: string | null;
  model?: string | null;
  capacity?: number;
  yearOfManufacture?: number | null;
  operationalStatus?: string;
  fitnessStatus?: string;
  registrationStatus?: string;
  insuranceStatus?: string;
  companyId?: string;
  routeId?: string | null;
  driverId?: string | null;
  serviceEligible?: boolean;
  verificationLabel?: string;
  company?: { id?: string; name?: string | null } | null;
  route?: { id?: string; name?: string; code?: string } | null;
  driver?: { id?: string; name?: string | null } | null;
};

type Company = { id: string; name: string };
type RouteOpt = { id: string; name: string; code: string };
type DriverOpt = { id: string; fullName?: string | null; user?: { fullName?: string } };

const VEHICLE_TYPES = ["STANDARD_BUS", "MINIBUS", "AC_BUS", "DOUBLE_DECKER", "ARTICULATED"] as const;
const OPS = ["ACTIVE", "INACTIVE", "MAINTENANCE", "OFFLINE"] as const;
const FITNESS = ["PENDING", "FIT", "UNFIT", "EXPIRED"] as const;
const REG = ["PENDING", "ACTIVE", "EXPIRED", "SUSPENDED"] as const;
const INS = ["NONE", "VALID", "EXPIRED"] as const;

function toneFor(status?: string): "green" | "yellow" | "red" | "slate" {
  if (status === "ACTIVE" || status === "FIT" || status === "VALID") return "green";
  if (status === "PENDING" || status === "MAINTENANCE") return "yellow";
  if (status === "SUSPENDED" || status === "UNFIT" || status === "EXPIRED" || status === "OFFLINE") return "red";
  return "slate";
}

export function VehicleDesk({
  allow,
  title,
  mode,
}: {
  allow: RoleCode[];
  title: string;
  mode: Mode;
}) {
  const { user } = useAuth();
  const isAdminUser = Boolean(user?.roles.includes("SUPER_ADMIN"));
  const canManage = mode === "admin" || mode === "owner";
  const canVerify = mode === "admin" || mode === "brta" || (isAdminUser && mode !== "readonly");
  const showCompany = mode === "admin" || isAdminUser;

  const [items, setItems] = useState<Vehicle[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [operationalStatus, setOperationalStatus] = useState("");
  const [registrationStatus, setRegistrationStatus] = useState("");
  const [fitnessStatus, setFitnessStatus] = useState("");
  const [vehicleType, setVehicleType] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vehicle | null>(null);
  const [busy, setBusy] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [routes, setRoutes] = useState<RouteOpt[]>([]);
  const [drivers, setDrivers] = useState<DriverOpt[]>([]);

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "20", sortBy: "registrationNo" });
    if (q.trim()) p.set("q", q.trim());
    if (operationalStatus) p.set("operationalStatus", operationalStatus);
    if (registrationStatus) p.set("registrationStatus", registrationStatus);
    if (fitnessStatus) p.set("fitnessStatus", fitnessStatus);
    if (vehicleType) p.set("vehicleType", vehicleType);
    return p.toString();
  }, [page, q, operationalStatus, registrationStatus, fitnessStatus, vehicleType]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items: Vehicle[]; total: number }>(`/buses?${query}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setSelected((cur) => (cur ? data.items.find((b) => b.id === cur.id) ?? cur : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load vehicles");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!canManage && !canVerify) return;
    api<RouteOpt[]>("/routes").then(setRoutes).catch(() => undefined);
    if (canManage) {
      api<{ items?: DriverOpt[] } | DriverOpt[]>("/drivers?pageSize=100")
        .then((data) => setDrivers(Array.isArray(data) ? data : data.items ?? []))
        .catch(() => undefined);
    }
    if (showCompany) {
      api<Company[]>("/companies").then(setCompanies).catch(() => undefined);
    }
  }, [canManage, canVerify, mode, showCompany]);

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const registrationNo = String(fd.get("registrationNo") ?? "").trim().toUpperCase().replace(/\s+/g, "-");
    const capacity = Number(fd.get("capacity"));
    const yearRaw = String(fd.get("yearOfManufacture") ?? "").trim();
    const yearOfManufacture = yearRaw ? Number(yearRaw) : undefined;
    const companyId = showCompany ? String(fd.get("companyId") || "").trim() : "";
    const manufacturer = String(fd.get("manufacturer") || "").trim();
    const model = String(fd.get("model") || "").trim();
    const routeId = String(fd.get("routeId") || "").trim();
    const driverId = String(fd.get("driverId") || "").trim();

    if (!/^[A-Z0-9][A-Z0-9-]{3,30}[A-Z0-9]$/.test(registrationNo)) {
      setError("Invalid registration number. Use 5–32 letters, numbers, or hyphens (e.g. DHAKA-METRO-D-99).");
      return;
    }
    if (!Number.isFinite(capacity) || capacity < 8 || capacity > 80) {
      setError("Seating capacity must be between 8 and 80.");
      return;
    }
    if (showCompany && !editing && !companyId) {
      setError("Select an operator / company before registering the vehicle.");
      return;
    }
    if (yearOfManufacture != null && (!Number.isFinite(yearOfManufacture) || yearOfManufacture < 1980)) {
      setError("Year of manufacture is invalid.");
      return;
    }

    const payload: Record<string, unknown> = {
      registrationNo,
      vehicleType: String(fd.get("vehicleType") ?? "STANDARD_BUS"),
      capacity,
      routeId: routeId || null,
      driverId: driverId || null,
    };
    if (manufacturer) payload.manufacturer = manufacturer;
    if (model) payload.model = model;
    if (yearOfManufacture != null) payload.yearOfManufacture = yearOfManufacture;
    if (companyId) payload.companyId = companyId;

    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editing) {
        const updated = await api<Vehicle>(`/buses/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setSelected(updated);
        setNotice("Vehicle updated.");
      } else {
        const created = await api<Vehicle>("/buses", { method: "POST", body: JSON.stringify(payload) });
        setSelected(created);
        setNotice(
          created.qrToken
            ? "Vehicle registered with QR code. Scan or open the QR link for vehicle & driver details, complaints, and inquiries."
            : "Vehicle registered. Verification is MANUAL / SIMULATED and starts as PENDING.",
        );
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

  async function setStatus(id: string, operational: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/buses/${id}/status`, { method: "PATCH", body: JSON.stringify({ operationalStatus: operational }) });
      setNotice("Operational status updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed");
    } finally {
      setBusy(false);
    }
  }

  async function setVerification(id: string, body: Record<string, string>) {
    setBusy(true);
    setError("");
    try {
      await api(`/buses/${id}/verification`, { method: "PATCH", body: JSON.stringify(body) });
      setNotice("Manual / simulated verification updated. This is not a live BRTA API.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification update failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    if (!window.confirm("Archive this vehicle? Trips and GPS history are kept. Hard delete is not available.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/buses/${id}`, { method: "DELETE" });
      setNotice("Vehicle archived. Historical records were retained.");
      setSelected(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setBusy(false);
    }
  }

  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <AppShell allow={allow} title={title}>
      <div className="brand-banner mb-4 rounded-xl px-4 py-3 text-sm">
        Vehicle verification is <strong>MANUAL / SIMULATED</strong>. There is no live BRTA or government API in this demo.
        Every vehicle gets a QR code on registration — passengers scan it for bus &amp; driver details, complaints, and inquiries.
        {user?.company?.name ? ` Operator scope: ${user.company.name}.` : null}
      </div>

      <div className="card filter-bar mb-4">
        <input className="input sm:col-span-2" placeholder="Search registration" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select className="input" value={operationalStatus} onChange={(e) => { setPage(1); setOperationalStatus(e.target.value); }}>
          <option value="">All operational</option>
          {OPS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={registrationStatus} onChange={(e) => { setPage(1); setRegistrationStatus(e.target.value); }}>
          <option value="">All registration</option>
          {REG.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={fitnessStatus} onChange={(e) => { setPage(1); setFitnessStatus(e.target.value); }}>
          <option value="">All fitness</option>
          {FITNESS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input sm:col-span-2" value={vehicleType} onChange={(e) => { setPage(1); setVehicleType(e.target.value); }}>
          <option value="">All types</option>
          {VEHICLE_TYPES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
        </select>
        <div className="filter-bar-actions">
          {canManage && (
            <button className="btn btn-primary w-full sm:w-auto" type="button" onClick={() => { setEditing(null); setFormOpen(true); }}>
              Register vehicle
            </button>
          )}
          <span className="text-xs text-slate-500">{total} vehicles</span>
        </div>
      </div>

      {notice && <div className="mb-3 rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--success)", background: "var(--success-bg)", color: "var(--success)" }}>{notice}</div>}
      {error && <div className="mb-3"><ErrorState message={error} /></div>}

      {formOpen && canManage && (
        <form key={editing?.id ?? "new"} className="card mb-4 grid gap-3 p-4 md:grid-cols-2" onSubmit={submitForm}>
          <h2 className="md:col-span-2 text-base font-semibold">{editing ? "Edit vehicle" : "Register vehicle"}</h2>
          <label className="text-sm">Registration number
            <input
              className="input mt-1"
              name="registrationNo"
              defaultValue={editing?.registrationNo}
              required
              minLength={5}
              maxLength={32}
              placeholder="e.g. DHAKA-METRO-D-99"
              pattern="[A-Za-z0-9][A-Za-z0-9 -]{3,30}[A-Za-z0-9]"
              title="5–32 letters, numbers, spaces or hyphens"
              disabled={Boolean(editing) && mode === "owner" && !isAdminUser}
            />
          </label>
          <label className="text-sm">Vehicle type
            <select className="input mt-1" name="vehicleType" defaultValue={editing?.vehicleType ?? "STANDARD_BUS"}>
              {VEHICLE_TYPES.map((s) => <option key={s} value={s}>{s.replaceAll("_", " ")}</option>)}
            </select>
          </label>
          <label className="text-sm">Seating capacity
            <input className="input mt-1" name="capacity" type="number" min={8} max={80} defaultValue={editing?.capacity ?? 40} required />
          </label>
          <label className="text-sm">Year
            <input className="input mt-1" name="yearOfManufacture" type="number" min={1980} max={new Date().getFullYear() + 1} defaultValue={editing?.yearOfManufacture ?? ""} />
          </label>
          <label className="text-sm">Manufacturer
            <input className="input mt-1" name="manufacturer" defaultValue={editing?.manufacturer ?? ""} />
          </label>
          <label className="text-sm">Model
            <input className="input mt-1" name="model" defaultValue={editing?.model ?? ""} />
          </label>
          {showCompany && (
            <label className="text-sm">Operator
              <select className="input mt-1" name="companyId" defaultValue={editing?.companyId ?? editing?.company?.id ?? ""} required={!editing}>
                <option value="">Select operator</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <label className="text-sm">Route (optional)
            <select className="input mt-1" name="routeId" defaultValue={editing?.routeId ?? editing?.route?.id ?? ""}>
              <option value="">Unassigned</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
            </select>
          </label>
          <label className="text-sm">Current driver (optional)
            <select className="input mt-1" name="driverId" defaultValue={editing?.driverId ?? editing?.driver?.id ?? ""}>
              <option value="">Unassigned</option>
              {drivers.map((d) => <option key={d.id} value={d.id}>{d.fullName ?? d.user?.fullName ?? d.id}</option>)}
            </select>
          </label>
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <button className="btn btn-primary w-full sm:w-auto" disabled={busy} type="submit">{busy ? "Saving…" : "Save"}</button>
            <button className="btn btn-ghost w-full sm:w-auto" type="button" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading vehicles…</div>
      ) : !items.length ? (
        <EmptyState title="No vehicles" body="No vehicles match the current filters." />
      ) : (
        <div className="stack-panel">
          <div className="card table-wrap min-w-0">
            <table className="data">
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Type</th>
                  <th>QR</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th>Operator</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={selected?.id === row.id ? "bg-[var(--surface-secondary)]" : "cursor-pointer"} onClick={() => setSelected(row)}>
                    <td className="font-medium">{row.registrationNo}</td>
                    <td>{(row.vehicleType ?? "—").replaceAll("_", " ")}</td>
                    <td>
                      <Badge tone={row.qrToken ? "teal" : "yellow"}>{row.qrToken ? "Ready" : "Pending"}</Badge>
                    </td>
                    <td><Badge tone={toneFor(row.operationalStatus)}>{row.operationalStatus ?? "—"}</Badge></td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={toneFor(row.registrationStatus)}>{row.registrationStatus ?? "—"}</Badge>
                        <Badge tone={toneFor(row.fitnessStatus)}>{row.fitnessStatus ?? "—"}</Badge>
                      </div>
                    </td>
                    <td>{row.company?.name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="pager px-3 py-2">
              <span>Page {page} of {pages}</span>
              <div className="pager-actions">
                <button className="btn btn-ghost" type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
                <button className="btn btn-ghost" type="button" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
              </div>
            </div>
          </div>

          <aside className="card p-4">
            {!selected ? (
              <p className="text-sm text-slate-500">Select a vehicle to view details.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <h2 className="text-base font-semibold">{selected.registrationNo}</h2>
                <p className="text-xs text-slate-500">{selected.verificationLabel ?? "MANUAL / SIMULATED VERIFICATION"}</p>
                <div>Type: {(selected.vehicleType ?? "—").replaceAll("_", " ")}</div>
                <div>Capacity: {selected.capacity ?? "—"}</div>
                <div>Manufacturer: {selected.manufacturer ?? "—"} {selected.model ?? ""}</div>
                <div>Year: {selected.yearOfManufacture ?? "—"}</div>
                <div>Operator: {selected.company?.name ?? "—"}</div>
                <div>Route: {selected.route?.name ?? "Unassigned"}</div>
                <div>Driver: {selected.driver?.name ?? "Unassigned"}</div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={toneFor(selected.operationalStatus)}>{selected.operationalStatus}</Badge>
                  {selected.registrationStatus && <Badge tone={toneFor(selected.registrationStatus)}>Reg {selected.registrationStatus}</Badge>}
                  {selected.fitnessStatus && <Badge tone={toneFor(selected.fitnessStatus)}>Fitness {selected.fitnessStatus}</Badge>}
                  {selected.insuranceStatus && <Badge tone={toneFor(selected.insuranceStatus)}>Token {selected.insuranceStatus}</Badge>}
                </div>
                {"serviceEligible" in selected && (
                  <div className="text-xs">{selected.serviceEligible ? "Eligible for a normal trip." : "Not eligible for a normal trip."}</div>
                )}

                <BusQrCard
                  registrationNo={selected.registrationNo}
                  qrToken={selected.qrToken}
                  qrUrl={selected.qrUrl}
                  compact
                />

                {canManage && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <button className="btn btn-ghost" type="button" onClick={() => { setEditing(selected); setFormOpen(true); }}>Edit</button>
                    {OPS.map((s) => (
                      <button key={s} className="btn btn-ghost" type="button" disabled={busy} onClick={() => void setStatus(selected.id, s)}>{s}</button>
                    ))}
                    <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void archive(selected.id)}>Archive</button>
                  </div>
                )}

                {canVerify && (
                  <form
                    key={selected.id}
                    className="space-y-2 border-t border-slate-100 pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      void setVerification(selected.id, {
                        registrationStatus: String(fd.get("registrationStatus")),
                        fitnessStatus: String(fd.get("fitnessStatus")),
                        insuranceStatus: String(fd.get("insuranceStatus")),
                      });
                    }}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual / simulated verification</div>
                    <select className="input" name="registrationStatus" defaultValue={selected.registrationStatus ?? "PENDING"}>
                      {REG.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="input" name="fitnessStatus" defaultValue={selected.fitnessStatus ?? "PENDING"}>
                      {FITNESS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <select className="input" name="insuranceStatus" defaultValue={selected.insuranceStatus ?? "NONE"}>
                      {INS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="btn btn-primary w-full" disabled={busy} type="submit">Save verification</button>
                  </form>
                )}
              </div>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}
