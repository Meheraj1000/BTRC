"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { Badge, ErrorState } from "@/components/StatCard";
import { api, getToken } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { boardedBusPath } from "@/lib/qrBus";
import { LanguageToggle, useI18n } from "@/lib/i18n";

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
    timestamp: string;
    trackingState?: string;
  } | null;
};

export default function PublicBusQrPage() {
  const params = useParams<{ token: string }>();
  const token = String(params.token ?? "");
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useI18n();
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
  const nextPath = boardedBusPath(token);

  useEffect(() => {
    if (authLoading || !token) return;
    if (getToken() && isPassenger) {
      router.replace(boardedBusPath(token));
    }
  }, [authLoading, isPassenger, router, token, user?.id]);

  useEffect(() => {
    if (!token) return;
    api<PublicBus>(`/public/buses/${token}`)      .then(setBus)
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
        const active = items.find((s) => ["OPEN", "ACKNOWLEDGED", "INVESTIGATING", "RESPONDING", "DISPATCHED"].includes(s.status));
        setActiveSosStatus(active?.status ?? null);
      })
      .catch(() => setActiveSosStatus(null));
  }, [isPassenger, user?.id]);

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
      setMsg("Submitted. Track status under Passenger → Complaints.");
      setDescription("");
      setSubject("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit");
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
          ? "SOS recorded for monitoring parties (anonymous QR scan)."
          : "SOS recorded and sent to all monitoring parties.",
      );
      setSosConfirm(false);
      setSosMessage("");
      if (!result.anonymous) setActiveSosStatus("OPEN");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to send emergency");
      setSosConfirm(false);
    } finally {
      setEmergencyBusy(false);
    }
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--background)] px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="flex items-center justify-between gap-3">
          <BrandMark subtitle={t("Scan bus QR")} href="/" />
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <Link href="/" className="btn btn-ghost text-xs">{t("Home")}</Link>
          </div>
        </div>

        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
          Public vehicle information from a bus QR code. GPS is SIMULATED. License numbers and phone numbers are not shown.
        </p>

        {error && <ErrorState message={error} />}
        {!bus && !error && <p className="text-sm text-[var(--text-muted)]">Loading vehicle…</p>}

        {bus && (
          <>
            <section className="card w-full border-l-4 border-l-[var(--error)] p-4 sm:p-6">
              <h1 className="font-display text-lg font-semibold tracking-tight text-[var(--error)] sm:text-xl">
                {t("Emergency SOS")}
              </h1>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                This records an SOS in the Nirapad Transit application for authorized monitoring accounts.
                It does <strong>not</strong> call 999, police, ambulance, or any government dispatch service.
              </p>
              <p className="mt-2 text-xs text-[var(--text-muted)]">
                Vehicle: <strong>{bus.registrationNo}</strong>
                {bus.route?.code ? ` · ${bus.route.code}` : ""}
              </p>
              {activeSosStatus && (
                <p className="mt-3 rounded-xl bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error)]">
                  You already have an active SOS ({activeSosStatus}). A new press reuses that record.
                </p>
              )}
              <label className="mt-4 block text-sm font-medium text-[var(--text-primary)]" htmlFor="qr-sos-cat">
                Category
              </label>
              <select
                id="qr-sos-cat"
                className="input mt-1"
                value={sosCategory}
                onChange={(e) => setSosCategory(e.target.value as typeof sosCategory)}
                aria-label="SOS category"
              >
                {SOS_CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <textarea
                className="input mt-3 min-h-24"
                value={sosMessage}
                onChange={(e) => setSosMessage(e.target.value)}
                placeholder="Optional details for monitors"
                aria-label="SOS details"
              />
              {!sosConfirm ? (
                <button
                  type="button"
                  className="btn btn-danger mt-4 w-full py-3 text-base"
                  onClick={() => setSosConfirm(true)}
                >
                  Trigger SOS
                </button>
              ) : (
                <div className="mt-4 space-y-2 rounded-xl bg-[var(--error-bg)] p-3">
                  <p className="text-sm font-medium text-[var(--error)]">
                    Confirm: record an application SOS for {bus.registrationNo}? This alerts monitoring desks only — not live 999.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      className="btn btn-danger py-3"
                      disabled={emergencyBusy}
                      onClick={() => void sendEmergency()}
                    >
                      {emergencyBusy ? "Recording…" : "Confirm SOS"}
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      disabled={emergencyBusy}
                      onClick={() => setSosConfirm(false)}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
              {emergencyMsg && (
                <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-secondary)] p-3 text-sm" role="status">
                  <div className="font-semibold text-[var(--error)]">SOS recorded</div>
                  <div>{emergencyMsg}</div>
                  {emergencyRef && <div>Reference: {emergencyRef}</div>}
                  <p className="mt-2 text-xs text-[var(--text-muted)]">
                    Notified: Super Admin, Government, Police, BRTA, operator, and assigned driver (application workflow).
                  </p>
                </div>
              )}
            </section>

            <section className="card space-y-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">{bus.registrationNo}</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {(bus.vehicleType ?? "Bus").replaceAll("_", " ")}
                    {bus.capacity ? ` · ${bus.capacity} seats` : ""}
                  </p>
                </div>
                <Badge tone={bus.operationalStatus === "ACTIVE" ? "green" : "yellow"}>
                  {bus.operationalStatus ?? "—"}
                </Badge>
              </div>
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-[var(--text-muted)]">Operator</dt><dd>{bus.company?.name ?? "—"}{bus.company?.city ? ` · ${bus.company.city}` : ""}</dd></div>
                <div><dt className="text-xs text-[var(--text-muted)]">Make / model</dt><dd>{[bus.manufacturer, bus.model].filter(Boolean).join(" ") || "—"}{bus.yearOfManufacture ? ` (${bus.yearOfManufacture})` : ""}</dd></div>
                <div><dt className="text-xs text-[var(--text-muted)]">Registration</dt><dd>{bus.registrationStatus ?? "—"}</dd></div>
                <div><dt className="text-xs text-[var(--text-muted)]">Fitness / insurance</dt><dd>{bus.fitnessStatus ?? "—"} · {bus.insuranceStatus ?? "—"}</dd></div>
              </dl>
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="font-display text-base font-semibold">{t("Route")}</h2>
              {!bus.route ? (
                <p className="text-sm text-[var(--text-muted)]">No route assigned.</p>
              ) : (
                <div className="text-sm">
                  <div className="font-medium">{bus.route.code} · {bus.route.name}</div>
                  <div className="text-[var(--text-secondary)]">{bus.route.startName} → {bus.route.endName}</div>
                  <div className="text-xs text-[var(--text-muted)]">{bus.route.city}{bus.route.allowedSpeed ? ` · limit ${bus.route.allowedSpeed} km/h` : ""}</div>
                </div>
              )}
            </section>

            <section className="card space-y-2 p-4">
              <h2 className="font-display text-base font-semibold">{t("Driver")}</h2>
              {!bus.driver ? (
                <p className="text-sm text-[var(--text-muted)]">No driver assigned.</p>
              ) : (
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-[var(--text-muted)]">Name</dt><dd>{bus.driver.name ?? "—"}</dd></div>
                  <div><dt className="text-xs text-[var(--text-muted)]">Duty status</dt><dd>{bus.driver.status ?? "—"}</dd></div>
                  <div><dt className="text-xs text-[var(--text-muted)]">License status</dt><dd>{bus.driver.licenseStatus ?? "—"}</dd></div>
                  <div><dt className="text-xs text-[var(--text-muted)]">Experience</dt><dd>{bus.driver.experienceYears != null ? `${bus.driver.experienceYears} years` : "—"}</dd></div>
                </dl>
              )}
            </section>

            {bus.latestLoc && (
              <section className="card space-y-1 p-4 text-sm">
                <h2 className="font-display text-base font-semibold">Last known GPS</h2>
                <div>{bus.latestLoc.trackingState ?? "ONLINE"} · {Number(bus.latestLoc.speed).toFixed(0)} km/h</div>
                <div className="text-xs text-[var(--text-muted)]">
                  {Number(bus.latestLoc.latitude).toFixed(5)}, {Number(bus.latestLoc.longitude).toFixed(5)}
                  {" · "}
                  {new Date(bus.latestLoc.timestamp).toLocaleString()}
                  {" · SIMULATED"}
                </div>
              </section>
            )}

            <section className="card space-y-3 p-4">
              <h2 className="font-display text-base font-semibold">Complaint or inquiry</h2>
              {authLoading ? (
                <p className="text-sm text-[var(--text-muted)]">Checking session…</p>
              ) : !getToken() || !isPassenger ? (
                <div className="space-y-3 text-sm">
                  <p className="text-[var(--text-secondary)]">
                    Sign in with a passenger account to submit a complaint or inquiry about this vehicle.
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Link className="btn btn-primary w-full sm:w-auto" href={`/login?next=${encodeURIComponent(nextPath)}`}>
                      Sign in
                    </Link>
                    <Link className="btn btn-ghost w-full sm:w-auto" href={`/register?next=${encodeURIComponent(nextPath)}`}>
                      Passenger register
                    </Link>
                    <Link className="btn btn-ghost w-full sm:w-auto" href={`/passenger/complaints?busId=${bus.id}`}>
                      Open complaints desk
                    </Link>
                  </div>
                </div>
              ) : (
                <form className="space-y-3" onSubmit={submitReport}>
                  <label className="block text-sm font-medium" htmlFor="qr-cat">Type</label>
                  <select id="qr-cat" className="input" value={complaintCategory} onChange={(e) => setComplaintCategory(e.target.value)}>
                    <option value="OTHER">General inquiry</option>
                    <option value="OVERSPEEDING">Overspeeding / service</option>
                    <option value="DRIVER_BEHAVIOR">Driver behavior</option>
                    <option value="ROUTE">Route problem</option>
                    <option value="BUS_CONDITION">Vehicle condition</option>
                    <option value="HARASSMENT_SECURITY">Safety issue</option>
                  </select>
                  <label className="block text-sm font-medium" htmlFor="qr-subject">Subject (optional)</label>
                  <input id="qr-subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Short summary" />
                  <label className="block text-sm font-medium" htmlFor="qr-desc">Details</label>
                  <textarea
                    id="qr-desc"
                    className="input min-h-28"
                    required
                    minLength={8}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe your complaint or inquiry. Do not include unnecessary personal data."
                  />
                  <button className="btn btn-primary w-full" disabled={busy} type="submit">
                    {busy ? "Submitting…" : "Submit"}
                  </button>
                  {msg && <p className="text-sm text-emerald-700">{msg}</p>}
                </form>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
