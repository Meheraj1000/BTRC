"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { LiveMap } from "@/components/map/LiveMap";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type RouteDetail = {
  id: string;
  code: string;
  name: string;
  startName: string;
  endName: string;
  city: string;
  allowedSpeed: number;
  polyline: Array<{ lat: number; lng: number }>;
  stops: Array<{ name: string; latitude: number; longitude: number; sequence: number }>;
};

type BusRow = { id: string; routeId?: string | null; registrationNo?: string };

export default function Page() {
  const { t } = useI18n();
  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api<{ items?: BusRow[] } | BusRow[]>("/buses?pageSize=20")
      .then(async (data) => {
        const items = Array.isArray(data) ? data : data.items ?? [];
        const assigned = items.find((b) => b.routeId);
        if (!assigned?.routeId) return;
        setRoute(await api<RouteDetail>(`/routes/${assigned.routeId}`));
      })
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <AppShell allow={["DRIVER", "SUPER_ADMIN"]} title="Assigned route">
      {error && <ErrorState message={error} />}
      {!route ? (
        <EmptyState title="No assigned route" body="Your current vehicle has no route assigned." />
      ) : (
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="min-w-0 font-semibold">
                {route.code} · {route.name}
              </h2>
              <Badge tone="teal">{route.allowedSpeed} km/h</Badge>
            </div>
            <p className="text-sm text-slate-500">
              {route.startName} → {route.endName} · {route.city}
            </p>
          </div>
          <LiveMap buses={[]} routes={[route]} />
          <ol className="card list-decimal space-y-1 p-4 pl-8 text-sm">
            {route.stops.map((s) => (
              <li key={s.sequence}>{s.name}</li>
            ))}
          </ol>
        </div>
      )}
    </AppShell>
  );
}
