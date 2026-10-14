"use client";

import { useEffect, useState } from "react";
import { LiveMap } from "@/components/map/LiveMap";
import { Badge, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import type { BusLive } from "@/lib/types";

type BusDetail = {
  id: string;
  registrationNo: string;
  vehicleType?: string;
  manufacturer?: string | null;
  model?: string | null;
  capacity?: number;
  yearOfManufacture?: number | null;
  operationalStatus?: string;
  fitnessStatus?: string;
  registrationStatus?: string;
  insuranceStatus?: string;
  trackingState?: string;
  company?: { id?: string; name?: string | null } | null;
  route?: { id?: string; name?: string; code?: string; allowedSpeed?: number } | null;
  driver?: { id?: string; name?: string | null } | null;
  latestLoc?: {
    latitude: number;
    longitude: number;
    speed: number;
    heading?: number;
    timestamp: string;
  } | null;
};

type LocDto = {
  busId?: string;
  registrationNo?: string;
  latitude: number;
  longitude: number;
  speed: number;
  heading?: number;
  timestamp: string;
  trackingState?: string;
  routeName?: string;
  bus?: BusLive["bus"];
};

function payloadBusId(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const busId = (payload as Record<string, unknown>).busId;
  return typeof busId === "string" && busId.length > 0 ? busId : null;
}

export function NoticeVehicleDetail({
  payload,
  emergency = false,
  onClose,
}: {
  payload: unknown;
  emergency?: boolean;
  onClose: () => void;
}) {
  const busId = payloadBusId(payload);
  const [bus, setBus] = useState<BusDetail | null>(null);
  const [live, setLive] = useState<BusLive | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(Boolean(busId));

  useEffect(() => {
    if (!busId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError("");

    Promise.all([
      api<BusDetail>(`/buses/${busId}`),
      api<LocDto>(`/gps/buses/${busId}/location`).catch(() => null),
    ])
      .then(([detail, loc]) => {
        if (cancelled) return;
        setBus(detail);
        const lat = loc?.latitude ?? detail.latestLoc?.latitude;
        const lng = loc?.longitude ?? detail.latestLoc?.longitude;
        if (lat != null && lng != null) {
          setLive({
            busId: detail.id,
            registrationNo: detail.registrationNo,
            latitude: Number(lat),
            longitude: Number(lng),
            speed: Number(loc?.speed ?? detail.latestLoc?.speed ?? 0),
            heading: Number(loc?.heading ?? detail.latestLoc?.heading ?? 0),
            timestamp: String(loc?.timestamp ?? detail.latestLoc?.timestamp ?? new Date().toISOString()),
            trackingState: (loc?.trackingState ?? detail.trackingState) === "STALE" ? "STALE" : "ONLINE",
            routeName: detail.route?.name,
            dataLabel: "SIMULATED",
            bus: {
              id: detail.id,
              registrationNo: detail.registrationNo,
              operationalStatus: detail.operationalStatus ?? "ACTIVE",
              route: detail.route?.name
                ? { name: detail.route.name, allowedSpeed: detail.route.allowedSpeed ?? 40, city: "" }
                : null,
            },
          });
        } else {
          setLive(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [busId]);

  if (!busId) {
    return (
      <div className="mt-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-sm">
        <p className="text-[var(--text-muted)]">This notice is not linked to a specific vehicle.</p>
        <button type="button" className="btn btn-ghost mt-2" onClick={onClose}>Close</button>
      </div>
    );
  }

  return (
    <div
      className={`mt-3 space-y-3 rounded-xl border p-3 sm:p-4 ${
        emergency ? "border-[var(--error)] bg-white" : "border-[var(--border)] bg-[var(--surface)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={`font-display text-base font-semibold ${emergency ? "text-[var(--error)]" : ""}`}>
          Vehicle &amp; driver details
        </h3>
        <button type="button" className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>

      {loading && <p className="text-sm text-[var(--text-muted)]">Loading vehicle details…</p>}
      {error && <ErrorState message={error} />}

      {bus && !loading && (
        <>
          <section className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Bus</div>
              <div className="mt-1 font-semibold">{bus.registrationNo}</div>
              <div>{(bus.vehicleType ?? "Bus").replaceAll("_", " ")}{bus.capacity ? ` · ${bus.capacity} seats` : ""}</div>
              <div className="text-[var(--text-secondary)]">
                {[bus.manufacturer, bus.model].filter(Boolean).join(" ") || "—"}
                {bus.yearOfManufacture ? ` (${bus.yearOfManufacture})` : ""}
              </div>
              <div className="mt-1 flex flex-wrap gap-1">
                <Badge tone={bus.operationalStatus === "ACTIVE" ? "green" : "yellow"}>{bus.operationalStatus ?? "—"}</Badge>
                {bus.registrationStatus && <Badge tone="slate">Reg {bus.registrationStatus}</Badge>}
                {bus.fitnessStatus && <Badge tone="slate">Fitness {bus.fitnessStatus}</Badge>}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Operator / route</div>
              <div className="mt-1">{bus.company?.name ?? "—"}</div>
              <div className="text-[var(--text-secondary)]">
                {bus.route ? `${bus.route.code} · ${bus.route.name}` : "No route assigned"}
              </div>
              {bus.route?.allowedSpeed != null && (
                <div className="text-xs text-[var(--text-muted)]">Limit {bus.route.allowedSpeed} km/h</div>
              )}
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">Driver</div>
              <div className="mt-1 font-medium">{bus.driver?.name ?? "Unassigned"}</div>
            </div>
          </section>

          <section>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="font-display text-sm font-semibold">Live location</h4>
              {live && (
                <span className="text-xs text-[var(--text-muted)]">
                  {live.trackingState ?? "ONLINE"} · {Number(live.speed).toFixed(0)} km/h ·{" "}
                  {live.timestamp ? new Date(live.timestamp).toLocaleString() : "—"}
                </span>
              )}
            </div>
            {live ? (
              <LiveMap buses={[live]} />
            ) : (
              <p className="rounded-xl bg-[var(--surface-secondary)] px-3 py-2 text-sm text-[var(--text-muted)]">
                No live GPS sample is available for this vehicle yet.
              </p>
            )}
            <p className="mt-2 text-xs text-[var(--text-muted)]">GPS is SIMULATED unless a real device feed is configured.</p>
          </section>
        </>
      )}
    </div>
  );
}
