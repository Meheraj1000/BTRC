"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Owner = { id: string; fullName: string; email: string };
type Company = {
  id: string;
  name: string;
  registration: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  city?: string | null;
  status: string;
  owner?: Owner | null;
  _count?: { buses: number; drivers: number; routes: number };
};

const STATUSES = ["ACTIVE", "INACTIVE", "SUSPENDED"] as const;
const REGISTRATION = /^[A-Za-z0-9][A-Za-z0-9-]{1,38}[A-Za-z0-9]$/;

const emptyForm = {
  name: "",
  registration: "",
  phone: "",
  email: "",
  address: "",
  city: "",
  ownerUserId: "",
  status: "ACTIVE",
};

function toneFor(status?: string): "green" | "yellow" | "red" | "slate" {
  if (status === "ACTIVE") return "green";
  if (status === "SUSPENDED") return "red";
  if (status === "INACTIVE") return "yellow";
  return "slate";
}

export function CompanyDesk() {
  const { t } = useI18n();
  const [items, setItems] = useState<Company[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [selected, setSelected] = useState<Company | null>(null);
  const [editing, setEditing] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await api<Company[]>("/companies");
      setItems(data);
      setSelected((current) => data.find((row) => row.id === current?.id) ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load companies");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api<{ items?: Owner[] }>("/users?role=TRANSPORT_OWNER&pageSize=100")
      .then((data) => setOwners(data.items ?? []))
      .catch(() => setOwners([]));
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormOpen(true);
    setNotice("");
    setError("");
  }

  function openEdit(row: Company) {
    setEditing(row);
    setSelected(row);
    setForm({
      name: row.name,
      registration: row.registration,
      phone: row.phone ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      city: row.city ?? "",
      ownerUserId: row.owner?.id ?? "",
      status: row.status,
    });
    setFormOpen(true);
    setNotice("");
    setError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const registration = form.registration.trim().toUpperCase();
    if (!REGISTRATION.test(registration)) {
      setError("Company registration must be 3–40 letters, numbers, or hyphens (e.g. DHAKA-COACH-01).");
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    const payload = {
      name: form.name.trim(),
      registration,
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      ownerUserId: form.ownerUserId || (editing ? null : ""),
      ...(editing ? { status: form.status } : {}),
    };
    try {
      if (editing) {
        const updated = await api<Company>(`/companies/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
        setNotice("Company updated.");
        setSelected(updated);
      } else {
        const created = await api<Company>("/companies", { method: "POST", body: JSON.stringify(payload) });
        setNotice("Company added. It can now be chosen when registering vehicles and drivers.");
        setSelected(created);
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

  const needle = q.trim().toLowerCase();
  const visible = items.filter((row) => {
    if (!needle) return true;
    return [row.name, row.registration, row.city, row.owner?.fullName].some((value) => value?.toLowerCase().includes(needle));
  });
  const ownerChoices = owners.filter((owner) => {
    const owned = items.find((row) => row.owner?.id === owner.id);
    return !owned || owned.id === editing?.id;
  });

  return (
    <AppShell allow={["SUPER_ADMIN"]} title="Transport companies">
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        {t("Add an operator here before assigning buses, drivers, or routes to them.")}
      </p>

      <div className="card filter-bar mb-4">
        <input
          className="input sm:col-span-2"
          placeholder={t("Search name or registration")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="filter-bar-actions">
          <button className="btn btn-primary w-full sm:w-auto" type="button" onClick={openCreate}>
            {t("Add company")}
          </button>
          <span className="text-xs text-slate-500">{visible.length} {t("companies")}</span>
        </div>
      </div>

      {notice && (
        <div className="mb-3 rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--success)", background: "var(--success-bg)", color: "var(--success)" }}>
          {t(notice)}
        </div>
      )}
      {error && <div className="mb-3"><ErrorState message={error} /></div>}

      {formOpen && (
        <form className="card mb-4 grid gap-3 p-4 md:grid-cols-2" onSubmit={submit}>
          <h2 className="md:col-span-2 text-base font-semibold">{editing ? t("Edit company") : t("Add company")}</h2>
          <label className="text-sm">{t("Company name")}
            <input className="input mt-1" value={form.name} required minLength={2} maxLength={120} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </label>
          <label className="text-sm">{t("Company registration")}
            <input
              className="input mt-1"
              value={form.registration}
              required
              minLength={3}
              maxLength={40}
              placeholder={t("e.g. DHAKA-COACH-01")}
              pattern="[A-Za-z0-9][A-Za-z0-9-]{1,38}[A-Za-z0-9]"
              title={t("3–40 letters, numbers, or hyphens")}
              onChange={(e) => setForm({ ...form, registration: e.target.value.toUpperCase() })}
            />
          </label>
          <label className="text-sm">{t("Phone")}
            <input className="input mt-1" value={form.phone} maxLength={20} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </label>
          <label className="text-sm">{t("Email")}
            <input className="input mt-1" type="email" value={form.email} maxLength={120} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="text-sm">{t("City")}
            <input className="input mt-1" value={form.city} maxLength={80} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </label>
          <label className="text-sm">{t("Owner (optional)")}
            <select className="input mt-1" value={form.ownerUserId} onChange={(e) => setForm({ ...form, ownerUserId: e.target.value })}>
              <option value="">{t("No owner")}</option>
              {ownerChoices.map((owner) => (
                <option key={owner.id} value={owner.id}>{owner.fullName}</option>
              ))}
            </select>
          </label>
          <label className="text-sm md:col-span-2">{t("Address")}
            <input className="input mt-1" value={form.address} maxLength={200} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </label>
          {editing && (
            <label className="text-sm">{t("Status")}
              <select className="input mt-1" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                {STATUSES.map((status) => <option key={status} value={status}>{t(status)}</option>)}
              </select>
            </label>
          )}
          <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
            <button className="btn btn-primary w-full sm:w-auto" disabled={busy} type="submit">{busy ? t("Saving…") : t("Save")}</button>
            <button className="btn btn-ghost w-full sm:w-auto" type="button" onClick={() => { setFormOpen(false); setEditing(null); }}>{t("Cancel")}</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-sm text-slate-500">{t("Loading companies…")}</div>
      ) : !visible.length ? (
        <EmptyState title="No companies" body="No transport companies match this view. Add one to assign buses and drivers." />
      ) : (
        <div className="stack-panel">
          <div className="card table-wrap min-w-0">
            <table className="data">
              <thead>
                <tr>
                  <th>{t("Name")}</th>
                  <th>{t("Registration")}</th>
                  <th>{t("City")}</th>
                  <th>{t("Owner")}</th>
                  <th>{t("Status")}</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => (
                  <tr key={row.id} className={selected?.id === row.id ? "bg-[var(--surface-secondary)]" : "cursor-pointer"} onClick={() => setSelected(row)}>
                    <td className="font-medium">{row.name}</td>
                    <td>{row.registration}</td>
                    <td>{row.city ?? "—"}</td>
                    <td>{row.owner?.fullName ?? "—"}</td>
                    <td><Badge tone={toneFor(row.status)}>{row.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="card p-4 text-sm">
            {!selected ? (
              <p className="text-slate-500">{t("Select a company to view details.")}</p>
            ) : (
              <div className="space-y-2">
                <h2 className="text-base font-semibold">{selected.name}</h2>
                <div>{t("Registration:")} {selected.registration}</div>
                <div>{t("City:")} {selected.city ?? "—"}</div>
                <div>{t("Phone:")} {selected.phone ?? "—"}</div>
                <div>{t("Email:")} {selected.email ?? "—"}</div>
                <div>{t("Address:")} {selected.address ?? "—"}</div>
                <div>{t("Owner:")} {selected.owner?.fullName ?? t("No owner")}</div>
                <div>{t("Buses:")} {selected._count?.buses ?? 0}</div>
                <div>{t("Drivers:")} {selected._count?.drivers ?? 0}</div>
                <div>{t("Routes:")} {selected._count?.routes ?? 0}</div>
                <Badge tone={toneFor(selected.status)}>{selected.status}</Badge>
                <div className="pt-2">
                  <button className="btn btn-ghost" type="button" onClick={() => openEdit(selected)}>{t("Edit")}</button>
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}
