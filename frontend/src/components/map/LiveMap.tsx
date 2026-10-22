"use client";

import dynamic from "next/dynamic";
import "leaflet/dist/leaflet.css";
import { useI18n } from "@/lib/i18n";
import type { BusLive } from "@/lib/types";

function MapLoading() {
  const { t } = useI18n();
  return (
    <div className="map-frame grid place-items-center bg-[var(--surface-secondary)] text-sm text-[var(--text-muted)]">
      {t("Loading map…")}
    </div>
  );
}

const Inner = dynamic(() => import("./LiveMapInner"), { ssr: false, loading: () => <MapLoading /> });

export function LiveMap(props: {
  buses: BusLive[];
  routes?: Array<{
    id: string;
    name: string;
    polyline: Array<{ lat: number; lng: number }>;
    stops?: Array<{ name: string; latitude: number; longitude: number; sequence?: number }>;
  }>;
  userLocation?: { lat: number; lng: number } | null;
  sosLocation?: { lat: number; lng: number; label?: string } | null;
}) {
  return <Inner {...props} />;
}
