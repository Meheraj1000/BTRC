"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { RoleCode } from "@/lib/types";

type Mode = "admin" | "owner" | "brta" | "readonly";

type Assignment = {
  id: string;
  busId: string;
  registrationNo?: string | null;
  assignedAt: string;
  endedAt?: string | null;
};

type Driver = {
  id: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  licenseNumber: string;
  licenseStatus?: string;
  licenseExpiry?: string | null;
  licenseValidity?: string;
  status?: string;
  experienceYears?: number;
  companyId?: string | null;
  company?: { id?: string; name?: string | null } | null;
  buses?: Array<{ id: string; registrationNo: string }>;
  assignments?: Assignment[];
  dutyEligible?: boolean;
  verificationLabel?: string;
};

type Company = { id: string; name: string };
type BusOpt = { id: string; registrationNo: string };

const LICENSE = ["PENDING", "VALID", "EXPIRED", "SUSPENDED"] as const;
const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;

function toneFor(status?: string): "green" | "yellow" | "red" | "slate" {
  if (status === "ACTIVE" || status === "VALID" || status === "EXPIRING_SOON") return "green";
  if (status === "PENDING") return "yellow";
  if (status === "SUSPENDED" || status === "EXPIRED" || status === "INVALID" || status === "INACTIVE") return "red";
  return "slate";
}

export function DriverDesk({
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

  const [items, setItems] = useState<Driver[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [licenseStatus, setLicenseStatus] = useState("");
  const [status, setStatus] = useState("");
  const [licenseValidity, setLicenseValidity] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<Driver | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Driver | null>(null);
  const [busy, setBusy] = useState(false);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [buses, setBuses] = useState<BusOpt[]>([]);
  const [assignBusId, setAssignBusId] = useState("");

  const query = useMemo(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (q.trim()) p.set("q", q.trim());
    if (licenseStatus) p.set("licenseStatus", licenseStatus);
    if (status) p.set("status", status);
    if (licenseValidity) p.set("licenseValidity", licenseValidity);
    return p.toString();
  }, [page, q, licenseStatus, status, licenseValidity]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<{ items: Driver[]; total: number }>(`/drivers?${query}`);
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
      setSelected((cur) => (cur ? data.items.find((d) => d.id === cur.id) ?? cur : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load drivers");
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (canManage) {
      api<{ items?: BusOpt[] }>("/buses?pageSize=100")
        .then((data) => setBuses(data.items ?? []))
        .catch(() => undefined);
    }
    if (showCompany) {
      api<Company[]>("/companies").then(setCompanies).catch(() => undefined);
    }
  }, [canManage, showCompany]);

  async function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const expiry = String(fd.get("licenseExpiry") || "");
    const payload: Record<string, unknown> = {
      fullName: String(fd.get("fullName") ?? ""),
      phone: String(fd.get("phone") || "") || undefined,
      licenseNumber: String(fd.get("licenseNumber") ?? ""),
      experienceYears: fd.get("experienceYears") ? Number(fd.get("experienceYears")) : 0,
      licenseExpiry: expiry ? new Date(expiry).toISOString() : undefined,
    };
    if (!editing) {
      payload.email = String(fd.get("email") ?? "");
      payload.password = String(fd.get("password") ?? "");
    }
    if (showCompany) payload.companyId = String(fd.get("companyId") || "") || undefined;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (editing) {
        await api(`/drivers/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setNotice("Driver updated.");
      } else {
        await api("/drivers", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Driver registered. License verification is MANUAL / SIMULATED and starts as PENDING.");
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

  async function setDriverStatus(id: string, next: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/drivers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      setNotice("Driver status updated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status change failed");
    } finally {
      setBusy(false);
    }
  }

  async function setVerification(id: string, next: string) {
    setBusy(true);
    setError("");
    try {
      await api(`/drivers/${id}/verification`, { method: "PATCH", body: JSON.stringify({ licenseStatus: next }) });
      setNotice("Manual / simulated license verification updated. This is not a live BRTA API.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification update failed");
    } finally {
      setBusy(false);
    }
  }

  async function assign(id: string, busId: string | null) {
    setBusy(true);
    setError("");
    try {
      await api(`/drivers/${id}/assignment`, { method: "PATCH", body: JSON.stringify({ busId }) });
      setNotice(busId ? "Driver assigned to vehicle." : "Driver unassigned.");
      setAssignBusId("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setBusy(false);
    }
  }

  async function archive(id: string) {
    if (!window.confirm("Archive this driver? Trips and GPS history are kept. Hard delete is not available.")) return;
    setBusy(true);
    setError("");
    try {
      await api(`/drivers/${id}`, { method: "DELETE" });
      setNotice("Driver archived. Historical records were retained.");
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
        Driver license verification is <strong>MANUAL / SIMULATED</strong>. There is no live BRTA or government API in this demo.
        {user?.company?.name ? ` Operator scope: ${user.company.name}.` : null}
      </div>

      <div className="card filter-bar mb-4">
        <input className="input sm:col-span-2" placeholder="Search name, phone, or license" value={q} onChange={(e) => { setPage(1); setQ(e.target.value); }} />
        <select className="input" value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={licenseStatus} onChange={(e) => { setPage(1); setLicenseStatus(e.target.value); }}>
          <option value="">All license states</option>
          {LICENSE.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" value={licenseValidity} onChange={(e) => { setPage(1); setLicenseValidity(e.target.value); }}>
          <option value="">All validity</option>
          <option value="VALID">Valid</option>
          <option value="EXPIRING_SOON">Expiring soon</option>
          <option value="EXPIRED">Expired</option>
          <option value="PENDING">Pending</option>
          <option value="INVALID">Suspended license</option>
        </select>
        <div className="filter-bar-actions">
          {canManage && (
            <button className="btn btn-primary w-full sm:w-auto" type="button" onClick={() => { setEditing(null); setFormOpen(true); }}>
              Register driver
            </button>
          )}
          <span className="text-xs text-slate-500">{total} drivers</span>
        </div>
      </div>

      {notice && <div className="mb-3 rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--success)", background: "var(--success-bg)", color: "var(--success)" }}>{notice}</div>}
      {error && <div className="mb-3"><ErrorState message={error} /></div>}

      {formOpen && canManage && (
        <form key={editing?.id ?? "new"} className="card mb-4 grid gap-3 p-4 md:grid-cols-2" onSubmit={submitForm}>
          <h2 className="md:col-span-2 text-base font-semibold">{editing ? "Edit driver" : "Register driver"}</h2>
          <label className="text-sm">Full name
            <input className="input mt-1" name="fullName" defaultValue={editing?.fullName ?? ""} required />
          </label>
          {!editing && (
            <>
              <label className="text-sm">Email
                <input className="input mt-1" name="email" type="email" required />
              </label>
              <label className="text-sm">Password
                <input className="input mt-1" name="password" type="password" minLength={8} required />
              </label>
            </>
          )}
          <label className="text-sm">Phone (01XXXXXXXXX)
            <input className="input mt-1" name="phone" defaultValue={editing?.phone ?? ""} />
          </label>
          <label className="text-sm">License number
            <input className="input mt-1" name="licenseNumber" defaultValue={editing?.licenseNumber} required />
          </label>
          <label className="text-sm">License expiry
            <input className="input mt-1" name="licenseExpiry" type="date" defaultValue={editing?.licenseExpiry ? editing.licenseExpiry.slice(0, 10) : ""} />
          </label>
          <label className="text-sm">Experience (years)
            <input className="input mt-1" name="experienceYears" type="number" min={0} max={60} defaultValue={editing?.experienceYears ?? 0} />
          </label>
          {showCompany && (
            <label className="text-sm">Operator
              <select className="input mt-1" name="companyId" defaultValue={editing?.companyId ?? editing?.company?.id ?? ""} required={!editing}>
                <option value="">Select operator</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </label>
          )}
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <button className="btn btn-primary w-full sm:w-auto" disabled={busy} type="submit">{busy ? "Saving…" : "Save"}</button>
            <button className="btn btn-ghost w-full sm:w-auto" type="button" onClick={() => { setFormOpen(false); setEditing(null); }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">Loading drivers…</div>
      ) : !items.length ? (
        <EmptyState title="No drivers" body="No drivers match the current filters." />
      ) : (
        <div className="stack-panel">
          <div className="card table-wrap min-w-0">
            <table className="data">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>License</th>
                  <th>Validity</th>
                  <th>Status</th>
                  <th>Vehicle</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id} className={selected?.id === row.id ? "bg-[var(--surface-secondary)]" : "cursor-pointer"} onClick={() => setSelected(row)}>
                    <td className="font-medium">{row.fullName ?? "—"}</td>
                    <td>{row.licenseNumber}</td>
                    <td><Badge tone={toneFor(row.licenseValidity)}>{row.licenseValidity ?? row.licenseStatus ?? "—"}</Badge></td>
                    <td><Badge tone={toneFor(row.status)}>{row.status ?? "—"}</Badge></td>
                    <td>{row.buses?.[0]?.registrationNo ?? "—"}</td>
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
              <p className="text-sm text-slate-500">Select a driver to view details.</p>
            ) : (
              <div className="space-y-3 text-sm">
                <h2 className="text-base font-semibold">{selected.fullName ?? selected.licenseNumber}</h2>
                <p className="text-xs text-slate-500">{selected.verificationLabel ?? "MANUAL / SIMULATED VERIFICATION"}</p>
                <div>License: {selected.licenseNumber}</div>
                <div>Expiry: {selected.licenseExpiry ? selected.licenseExpiry.slice(0, 10) : "—"}</div>
                {selected.phone && <div>Phone: {selected.phone}</div>}
                {selected.email && <div>Email: {selected.email}</div>}
                <div>Operator: {selected.company?.name ?? "—"}</div>
                <div>Experience: {selected.experienceYears ?? 0} years</div>
                <div className="flex flex-wrap gap-1">
                  <Badge tone={toneFor(selected.status)}>{selected.status}</Badge>
                  <Badge tone={toneFor(selected.licenseStatus)}>License {selected.licenseStatus}</Badge>
                  <Badge tone={toneFor(selected.licenseValidity)}>{selected.licenseValidity}</Badge>
                </div>
                <div className="text-xs">{selected.dutyEligible ? "Eligible for active assignment." : "Not eligible for active assignment."}</div>
                <div>Current vehicle: {selected.buses?.map((b) => b.registrationNo).join(", ") || "Unassigned"}</div>
                {!!selected.assignments?.length && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assignment history</div>
                    <ul className="mt-1 space-y-1 text-xs text-slate-600">
                      {selected.assignments.slice(0, 8).map((a) => (
                        <li key={a.id}>{a.registrationNo ?? a.busId} — {new Date(a.assignedAt).toLocaleDateString()}{a.endedAt ? " (ended)" : ""}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {canManage && (
                  <div className="space-y-2 border-t border-slate-100 pt-3">
                    <div className="flex flex-wrap gap-2">
                      <button className="btn btn-ghost" type="button" onClick={() => { setEditing(selected); setFormOpen(true); }}>Edit</button>
                      {STATUSES.filter((s) => s !== "SUSPENDED" || mode === "admin" || isAdminUser).map((s) => (
                        <button key={s} className="btn btn-ghost" type="button" disabled={busy} onClick={() => void setDriverStatus(selected.id, s)}>{s}</button>
                      ))}
                      <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => void archive(selected.id)}>Archive</button>
                    </div>
                    <div className="flex gap-2">
                      <select className="input" value={assignBusId} onChange={(e) => setAssignBusId(e.target.value)}>
                        <option value="">Select vehicle</option>
                        {buses.map((b) => <option key={b.id} value={b.id}>{b.registrationNo}</option>)}
                      </select>
                      <button className="btn btn-primary" type="button" disabled={busy || !assignBusId} onClick={() => void assign(selected.id, assignBusId)}>Assign</button>
                    </div>
                    <button className="btn btn-ghost w-full" type="button" disabled={busy} onClick={() => void assign(selected.id, null)}>Unassign</button>
                  </div>
                )}

                {canVerify && (
                  <form
                    key={selected.id}
                    className="space-y-2 border-t border-slate-100 pt-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      void setVerification(selected.id, String(fd.get("licenseStatus")));
                    }}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Manual / simulated verification</div>
                    <select className="input" name="licenseStatus" defaultValue={selected.licenseStatus ?? "PENDING"}>
                      {LICENSE.map((s) => <option key={s} value={s}>{s}</option>)}
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
