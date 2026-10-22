"use client";

import { useCallback, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Device = {
  id: string;
  serialNumber: string;
  vendor?: string | null;
  firmware?: string | null;
  status?: string;
  dataSource?: string;
  notes?: string | null;
  connection?: string;
  hasApiKey?: boolean;
  apiKeyHint?: string | null;
  connectedAt?: string | null;
  lastSeenAt?: string | null;
  bus?: { id: string; registrationNo: string } | null;
};

type BusOpt = { id: string; registrationNo: string };

type ConnectResult = Device & {
  apiKey?: string;
  ingestPath?: string;
  header?: string;
  note?: string;
};

export function GpsDeviceDesk() {
  const { t } = useI18n();
  const [items, setItems] = useState<Device[]>([]);
  const [buses, setBuses] = useState<BusOpt[]>([]);
  const [selected, setSelected] = useState<Device | null>(null);
  const [busId, setBusId] = useState("");
  const [issued, setIssued] = useState<ConnectResult | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [devices, fleet] = await Promise.all([
        api<Device[]>("/gps-devices"),
        api<{ items?: BusOpt[] }>("/buses?pageSize=100"),
      ]);
      setItems(devices ?? []);
      setBuses(fleet.items ?? []);
      setSelected((cur) => (cur ? devices.find((d) => d.id === cur.id) ?? null : null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load GPS devices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function register(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    setNotice("");
    setIssued(null);
    try {
      const created = await api<Device>("/gps-devices", {
        method: "POST",
        body: JSON.stringify({
          serialNumber: String(fd.get("serialNumber") ?? ""),
          vendor: String(fd.get("vendor") || "") || undefined,
          firmware: String(fd.get("firmware") || "") || undefined,
          notes: String(fd.get("notes") || "") || undefined,
        }),
      });
      setNotice(`Device ${created.serialNumber} registered. Connect it to a vehicle to issue a tracker key.`);
      e.currentTarget.reset();
      setSelected(created);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function connect() {
    if (!selected || !busId) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await api<ConnectResult>(`/gps-devices/${selected.id}/connect`, {
        method: "POST",
        body: JSON.stringify({ busId }),
      });
      setIssued(result);
      setNotice(`Connected to ${result.bus?.registrationNo ?? "vehicle"}. Copy the device key now.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Connect failed");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(id: string) {
    if (!window.confirm("Disconnect this GPS device? Its tracker key will stop working.")) return;
    setBusy(true);
    setError("");
    setIssued(null);
    try {
      await api(`/gps-devices/${id}/disconnect`, { method: "POST", body: JSON.stringify({}) });
      setNotice("Device disconnected. Positions from that key will be rejected.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell allow={["SUPER_ADMIN"]} title="GPS devices">
      <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
        Register a tracker, connect it to one bus, and copy the one-time key. The device posts to{" "}
        <code>POST /api/gps/location</code> with header <code>X-GPS-Device-Key</code>. Those points are labeled DEVICE.
        The demo fleet remains SIMULATED until a real tracker sends data.
      </p>

      {notice && (
        <div className="mb-3 rounded-xl border px-4 py-2 text-sm" style={{ borderColor: "var(--success)", background: "var(--success-bg)", color: "var(--success)" }}>
          {notice}
        </div>
      )}
      {error && <div className="mb-3"><ErrorState message={error} /></div>}

      <form className="card mb-4 grid gap-3 p-4 md:grid-cols-2" onSubmit={register}>
        <h2 className="md:col-span-2 font-display text-base font-semibold">{t("GPS devices")}</h2>
        <label className="text-sm">Serial number
          <input className="input mt-1" name="serialNumber" required minLength={3} placeholder="e.g. TRK-DHK-0042" />
        </label>
        <label className="text-sm">Vendor
          <input className="input mt-1" name="vendor" placeholder="Optional" />
        </label>
        <label className="text-sm">Firmware
          <input className="input mt-1" name="firmware" placeholder="Optional" />
        </label>
        <label className="text-sm">Notes
          <input className="input mt-1" name="notes" placeholder="Optional" />
        </label>
        <div className="md:col-span-2">
          <button className="btn btn-primary" disabled={busy} type="submit">{busy ? t("Saving…") : t("Register device")}</button>
        </div>
      </form>

      {issued?.apiKey && (
        <section className="card mb-4 space-y-2 border-l-4 border-l-[var(--brand-primary)] p-4">
          <h2 className="font-display text-base font-semibold">Device key — shown once</h2>
          <p className="text-sm text-[var(--text-secondary)]">{issued.note}</p>
          <p className="break-all rounded-lg bg-[var(--ink-950)] px-3 py-2 font-mono text-xs text-white">{issued.apiKey}</p>
          <p className="text-xs text-[var(--text-muted)]">
            {issued.header}: {issued.apiKey.slice(0, 12)}… · {issued.ingestPath}
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void navigator.clipboard.writeText(issued.apiKey ?? "")}
          >
            {t("Copy key")}
          </button>
        </section>
      )}

      {loading ? (
        <p className="text-sm text-[var(--text-muted)]">Loading devices…</p>
      ) : !items.length ? (
        <EmptyState title="No GPS devices" body="Register a serial number, then connect it to a bus." />
      ) : (
        <div className="stack-panel">
          <div className="card table-wrap min-w-0">
            <table className="data">
              <thead>
                <tr>
                  <th>Serial</th>
                  <th>Vendor</th>
                  <th>Vehicle</th>
                  <th>Link</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className={selected?.id === row.id ? "bg-[var(--surface-secondary)]" : "cursor-pointer"}
                    onClick={() => { setSelected(row); setIssued(null); }}
                  >
                    <td className="font-medium">{row.serialNumber}</td>
                    <td>{row.vendor ?? "—"}</td>
                    <td>{row.bus?.registrationNo ?? "—"}</td>
                    <td>
                      <Badge tone={row.connection === "CONNECTED" ? "green" : "yellow"}>{row.connection ?? "UNBOUND"}</Badge>
                    </td>
                    <td className="text-xs">{row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : "Never"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <aside className="card space-y-3 p-4 text-sm">
            {!selected ? (
              <p className="text-[var(--text-muted)]">Select a device to connect it to a bus.</p>
            ) : (
              <>
                <h2 className="font-display text-base font-semibold">{selected.serialNumber}</h2>
                <div>Source: {selected.dataSource ?? "—"}</div>
                <div>Firmware: {selected.firmware ?? "—"}</div>
                <div>Vehicle: {selected.bus?.registrationNo ?? "Not connected"}</div>
                <div>Key: {selected.hasApiKey ? `••••${selected.apiKeyHint ?? ""}` : "None"}</div>
                <div>Last seen: {selected.lastSeenAt ? new Date(selected.lastSeenAt).toLocaleString() : "Never"}</div>
                <label className="block text-sm">Connect to vehicle
                  <select className="input mt-1" value={busId} onChange={(e) => setBusId(e.target.value)}>
                    <option value="">Select bus</option>
                    {buses.map((b) => (
                      <option key={b.id} value={b.id}>{b.registrationNo}</option>
                    ))}
                  </select>
                </label>
                <button className="btn btn-primary w-full" type="button" disabled={busy || !busId} onClick={() => void connect()}>
                  {selected.connection === "CONNECTED" ? t("Connect device") : t("Connect device")}
                </button>
                {selected.connection === "CONNECTED" && (
                  <button className="btn btn-ghost w-full" type="button" disabled={busy} onClick={() => void disconnect(selected.id)}>
                    {t("Disconnect")}
                  </button>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </AppShell>
  );
}
