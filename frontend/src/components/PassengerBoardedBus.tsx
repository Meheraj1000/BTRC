"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/map/LiveMap";
import { Badge, ErrorState } from "@/components/StatCard";
import { api, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { BusLive } from "@/lib/types";

const SOS_CATEGORIES = [
  ["SAFETY", "Safety"],
  ["MEDICAL", "Medical"],
  ["ACCIDENT", "Accident"],
  ["OTHER", "Other"],
] as const;

type PublicBus = {
  id: string;
  registrationNo: string;
  vehicleType: string;
  manufacturer?: string | null;
  model?: string | null;
  capacity?: number;
  yearOfManufacture?: number | null;
  operationalStatus?: string;
  fitnessStatus?: string;
  registrationStatus?: string;
  insuranceStatus?: string;
  company?: { name?: string | null; city?: string | null } | null;
  route?: {
    id?: string;
    code?: string;
    name?: string;
    startName?: string;
    endName?: string;
    city?: string;
    allowedSpeed?: number;
  } | null;
  driver?: {
    name?: string | null;
    licenseStatus?: string;
    experienceYears?: number;
    status?: string;
  } | null;
  latestLoc?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading?: number;
    timestamp: string;
    trackingState?: string;
  } | null;
};

export function PassengerBoardedBus({ token }: { token: string }) {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const [bus, setBus] = useState<PublicBus | null>(null);
  const [error, setError] = useState("");
  const [complaintCategory, setComplaintCategory] = useState("OTHER");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [sosCategory, setSosCategory] = useState<(typeof SOS_CATEGORIES)[number][0]>("SAFETY");
  const [sosMessage, setSosMessage] = useState("");
  const [sosConfirm, setSosConfirm] = useState(false);
  const [emergencyBusy, setEmergencyBusy] = useState(false);
  const [emergencyMsg, setEmergencyMsg] = useState("");
  const [emergencyRef, setEmergencyRef] = useState("");
  const [activeSosStatus, setActiveSosStatus] = useState<string | null>(null);

  const isPassenger = Boolean(user?.roles.includes("PASSENGER") || user?.roles.includes("SUPER_ADMIN"));

  useEffect(() => {
    if (!token) return;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("nt_last_boarded_qr", token.toLowerCase());
    }
    api<PublicBus>(`/public/buses/${token}`)
      .then(setBus)
      .catch((err: Error) => setError(err.message));
  }, [token]);

  useEffect(() => {
    if (!getToken() || !isPassenger) {
      setActiveSosStatus(null);
      return;
    }
    api<{ items?: Array<{ status: string }> } | Array<{ status: string }>>("/sos?page=1&pageSize=5")
      .then((data) => {
        const items = Array.isArray(data) ? data : data.items ?? [];
        const active = items.find((s) =>
          ["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESPONDING", "DISPATCHED"].includes(s.status),
        );
        setActiveSosStatus(active?.status ?? null);
      })
      .catch(() => setActiveSosStatus(null));
  }, [isPassenger, user?.id]);

  const liveBus: BusLive | null = useMemo(() => {
    if (!bus?.latestLoc) return null;
    const loc = bus.latestLoc;
    return {
      busId: bus.id,
      registrationNo: bus.registrationNo,
      latitude: Number(loc.latitude),
      longitude: Number(loc.longitude),
      speed: Number(loc.speed ?? 0),
      heading: Number(loc.heading ?? 0),
      timestamp: String(loc.timestamp ?? ""),
      trackingState: loc.trackingState === "STALE" ? "STALE" : "ONLINE",
      dataLabel: "SIMULATED",
      routeName: bus.route?.name,
      bus: {
        id: bus.id,
        registrationNo: bus.registrationNo,
        operationalStatus: bus.operationalStatus ?? "ACTIVE",
        route: bus.route?.name
          ? {
              name: bus.route.name,
              allowedSpeed: bus.route.allowedSpeed ?? 40,
              city: bus.route.city ?? "",
            }
          : null,
      },
    };
  }, [bus]);

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();
    if (!bus) return;
    setBusy(true);
    setMsg("");
    setError("");
    try {
      await api("/complaints", {
        method: "POST",
        body: JSON.stringify({
          busId: bus.id,
          ...(bus.route?.id ? { routeId: bus.route.id } : {}),
          category: complaintCategory,
          subject: subject.trim() || (complaintCategory === "OTHER" ? "Passenger inquiry" : undefined),
          description,
        }),
      });
      setMsg(t("Submitted. Track status under Complaints."));
      setDescription("");
      setSubject("");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Unable to submit"));
    } finally {
      setBusy(false);
    }
  }

  async function sendEmergency() {
    if (!bus || !token || emergencyBusy) return;

    setEmergencyBusy(true);
    setEmergencyMsg("");
    setEmergencyRef("");
    setError("");
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (typeof navigator !== "undefined" && navigator.geolocation) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: false,
              timeout: 4000,
              maximumAge: 60_000,
            });
          });
          latitude = pos.coords.latitude;
          longitude = pos.coords.longitude;
        } catch {
          // Fall back to vehicle last-known GPS on the server.
        }
      }

      const detail = sosMessage.trim();
      const composed = [
        `QR Emergency SOS · ${sosCategory}`,
        `Vehicle ${bus.registrationNo}`,
        detail || "Immediate assistance requested.",
      ].join(" — ");

      const result = await api<{
        complaintReference: string;
        anonymous: boolean;
        sosId?: string | null;
      }>(`/public/buses/${token}/emergency`, {
        method: "POST",
        body: JSON.stringify({
          message: composed,
          category: sosCategory,
          ...(latitude != null && longitude != null ? { latitude, longitude } : {}),
        }),
      });
      setEmergencyRef(result.complaintReference);
      setEmergencyMsg(
        result.anonymous
          ? t("SOS recorded for monitoring parties (anonymous QR scan).")
          : t("SOS recorded and sent to all monitoring parties."),
      );
      setSosConfirm(false);
      setSosMessage("");
      if (!result.anonymous) setActiveSosStatus("OPEN");
    } catch (err) {
      setError(err instanceof Error ? err.message : t("Unable to send emergency"));
      setSosConfirm(false);
    } finally {
      setEmergencyBusy(false);
    }
  }

  const loginNext = `/passenger/board/${token}`;

  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Boarded bus">
      <div className="mx-auto w-full max-w-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-[var(--text-secondary)]">
            {t("Scanned bus QR · details, complaint, and emergency for this vehicle")}
          </p>
          <Link className="btn btn-ghost text-xs" href="/passenger/scan">
            {t("Scan another")}
          </Link>
        </div>

        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
          {t("GPS is SIMULATED. License numbers and phone numbers are not shown. SOS is an application workflow — not live 999 or government dispatch.")}
        </p>

        {error && <ErrorState message={error} />}
        {!bus && !error && <p className="text-sm text-[var(--text-muted)]">{t("Loading vehicle…")}</p>}

        {bus && (
          <>
            <section className="card space-y-2 border-l-4 border-l-[var(--brand-primary)] p-4 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">{bus.registrationNo}</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {(bus.vehicleType ?? t("Bus")).replaceAll("_", " ")}
                    {bus.capacity ? ` · ${bus.capacity} ${t("seats")}` : ""}
                  </p>
                </div>
                <Badge tone={bus.operationalStatus === "ACTIVE" ? "green" : "yellow"}>
                  {bus.operationalStatus ?? "—"}
                </Badge>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">{t("Operator")}</dt>
                  <dd>
                    {bus.company?.name ?? "—"}
                    {bus.company?.city ? ` · ${bus.company.city}` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">{t("Make / model")}</dt>
                  <dd>
                    {[bus.manufacturer, bus.model].filter(Boolean).join(" ") || "—"}
                    {bus.yearOfManufacture ? ` (${bus.yearOfManufacture})` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">{t("Registration")}</dt>
                  <dd>{bus.registrationStatus ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-[var(--text-muted)]">{t("Fitness / insurance")}</dt>
                  <dd>
                    {bus.fitnessStatus ?? "—"} · {bus.insuranceStatus ?? "—"}
                  </dd>
                </div>
              </dl>
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="font-display text-base font-semibold">{t("Route")}</h2>
              {!bus.route ? (
                <p className="text-sm text-[var(--text-muted)]">{t("No route assigned.")}</p>
              ) : (
                <div className="text-sm">
                  <div className="font-medium">
                    {bus.route.code} · {bus.route.name}
                  </div>
                  <div className="text-[var(--text-secondary)]">
                    {bus.route.startName} → {bus.route.endName}
                  </div>
                  <div className="text-xs text-[var(--text-muted)]">
                    {bus.route.city}
                    {bus.route.allowedSpeed ? ` · ${t("limit")} ${bus.route.allowedSpeed} ${t("km/h")}` : ""}
                  </div>
                </div>
              )}
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="font-display text-base font-semibold">{t("Driver")}</h2>
              {!bus.driver ? (
                <p className="text-sm text-[var(--text-muted)]">{t("No driver assigned.")}</p>
              ) : (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">{t("Name")}</dt>
                    <dd>{bus.driver.name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">{t("Duty status")}</dt>
                    <dd>{bus.driver.status ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">{t("License status")}</dt>
                    <dd>{bus.driver.licenseStatus ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-[var(--text-muted)]">{t("Experience")}</dt>
                    <dd>
                      {bus.driver.experienceYears != null ? `${bus.driver.experienceYears} ${t("years")}` : "—"}
                    </dd>
                  </div>
                </dl>
              )}
            </section>

            {liveBus && (
              <section className="card space-y-2 p-4">
                <h2 className="font-display text-base font-semibold">{t("Live location")}</h2>
                <p className="text-xs text-[var(--text-muted)]">
                  {liveBus.trackingState} · {liveBus.speed.toFixed(0)} {t("km/h")} ·{" "}
                  {liveBus.timestamp ? new Date(liveBus.timestamp).toLocaleString() : "—"} · {t("SIMULATED")}
                </p>
                <LiveMap buses={[liveBus]} />
              </section>
            )}

            <section className="card border-l-4 border-l-[var(--error)] p-4 sm:p-6">
              <h2 className="font-display text-lg font-semibold tracking-tight text-[var(--error)]">
                {t("Emergency SOS")}
              </h2>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {t("Records an SOS in Nirapad Transit for authorized monitors. Does")}{" "}
                <strong>{t("not")}</strong>{" "}
                {t("call 999, police, ambulance, or any government dispatch.")}
              </p>
              {activeSosStatus && (
                <p className="mt-3 rounded-xl bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
                  {t("You already have an active SOS (")}{activeSosStatus}{t("). A new press reuses that record.")}
                </p>
              )}
              <label className="mt-4 block text-sm font-medium" htmlFor="board-sos-cat">
                {t("Category")}
              </label>
              <select
                id="board-sos-cat"
                className="input mt-1"
                value={sosCategory}
                onChange={(e) => setSosCategory(e.target.value as typeof sosCategory)}
              >
                {SOS_CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {t(label)}
                  </option>
                ))}
              </select>
              <textarea
                className="input mt-3 min-h-24"
                value={sosMessage}
                onChange={(e) => setSosMessage(e.target.value)}
                placeholder={t("Optional details for monitors")}
                aria-label={t("SOS details")}
              />
              {!sosConfirm ? (
                <button
                  type="button"
                  className="btn btn-danger mt-4 w-full py-3 text-base"
                  onClick={() => setSosConfirm(true)}
                >
                  {t("Trigger SOS")}
                </button>
              ) : (
                <div className="mt-4 space-y-2 rounded-xl bg-[var(--error-bg)] p-3">
                  <p className="text-sm font-medium text-[var(--error)]">
                    {t("Confirm: record an application SOS for ")}{bus.registrationNo}{t("? Alerts monitoring desks only — not live 999.")}
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="btn btn-danger py-3"
                      disabled={emergencyBusy}
                      onClick={() => void sendEmergency()}
                    >
                      {emergencyBusy ? t("Recording…") : t("Confirm SOS")}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={emergencyBusy}
                      onClick={() => setSosConfirm(false)}
                    >
                      {t("Back")}
                    </button>
                  </div>
                </div>
              )}
              {emergencyMsg && (
                <div
                  className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm"
                  role="status"
                >
                  <div className="font-semibold text-[var(--error)]">{t("SOS recorded")}</div>
                  <div>{emergencyMsg}</div>
                  {emergencyRef && <div>{t("Reference:")} {emergencyRef}</div>}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    {t("Notified: Super Admin, Government, Police, BRTA, operator, and assigned driver (application workflow).")}
                  </p>
                  <Link className="btn btn-ghost mt-2" href="/passenger/sos">
                    {t("Open my SOS")}
                  </Link>
                </div>
              )}
            </section>

            <section className="card space-y-3 p-4 sm:p-6">
              <h2 className="font-display text-base font-semibold">{t("Lodge a complaint")}</h2>
              {authLoading ? (
                <p className="text-sm text-[var(--text-muted)]">{t("Checking session…")}</p>
              ) : !getToken() || !isPassenger ? (
                <div className="space-y-3 text-sm">
                  <p className="text-[var(--text-secondary)]">
                    {t("Sign in with a passenger account to submit a complaint about this vehicle.")}
                  </p>
                  <Link className="btn btn-primary" href={`/login?next=${encodeURIComponent(loginNext)}`}>
                    {t("Sign in")}
                  </Link>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={submitReport}>
                  <label className="block text-sm font-medium" htmlFor="board-cat">
                    {t("Type")}
                  </label>
                  <select
                    id="board-cat"
                    className="input"
                    value={complaintCategory}
                    onChange={(e) => setComplaintCategory(e.target.value)}
                  >
                    <option value="OTHER">{t("General inquiry")}</option>
                    <option value="OVERSPEEDING">{t("Overspeeding / service")}</option>
                    <option value="DRIVER_BEHAVIOR">{t("Driver behavior")}</option>
                    <option value="ROUTE">{t("Route problem")}</option>
                    <option value="BUS_CONDITION">{t("Vehicle condition")}</option>
                    <option value="HARASSMENT_SECURITY">{t("Safety issue")}</option>
                  </select>
                  <label className="block text-sm font-medium" htmlFor="board-subject">
                    {t("Subject (optional)")}
                  </label>
                  <input
                    id="board-subject"
                    className="input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t("Short summary")}
                  />
                  <label className="block text-sm font-medium" htmlFor="board-desc">
                    {t("Details")}
                  </label>
                  <textarea
                    id="board-desc"
                    className="input min-h-28"
                    required
                    minLength={8}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("Describe your complaint or inquiry.")}
                  />
                  <button className="btn btn-primary w-full" disabled={busy} type="submit">
                    {busy ? t("Submitting…") : t("Submit complaint")}
                  </button>
                  {msg && <p className="text-sm text-emerald-700">{t(msg)}</p>}
                  <Link className="btn btn-ghost w-full" href={`/passenger/complaints?busId=${bus.id}`}>
                    {t("View my complaints")}
                  </Link>
                </form>
              )}
            </section>
          </>
        )}
      </div>
    </AppShell>
  );
}
