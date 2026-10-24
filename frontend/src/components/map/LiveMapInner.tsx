"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CircleMarker, MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import { brand } from "@/lib/brand";
import {
  BANGLADESH_CENTER,
  BANGLADESH_MAX_ZOOM,
  BANGLADESH_MIN_ZOOM,
  BANGLADESH_NE,
  BANGLADESH_SW,
  isInBangladesh,
} from "@/lib/geo/bangladesh";
import { useI18n } from "@/lib/i18n";
import { routingWaypoints } from "@/lib/roadWaypoints";
import type { BusLive } from "@/lib/types";

type RouteLine = {
  id: string;
  name: string;
  polyline: Array<{ lat: number; lng: number }>;
  stops?: Array<{ name: string; latitude: number; longitude: number; sequence?: number }>;
};

const BD_BOUNDS = L.latLngBounds(BANGLADESH_SW, BANGLADESH_NE);

function vehicleIcon(statusColor: string, heading = 0, selected = false) {
  const size = selected ? 48 : 40;
  return L.divIcon({
    className: "vehicle-marker-wrap",
    html: `<div class="vehicle-marker ${selected ? "is-selected" : ""}" style="--status:${statusColor};--heading:${heading}deg;width:${size}px;height:${size}px">
      <span class="vehicle-marker-ring" aria-hidden="true"></span>
      <img class="vehicle-marker-logo" src="/vehicle-marker.svg" alt="" width="${size - 6}" height="${size - 6}" draggable="false" />
    </div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) + 4],
  });
}

function colorFor(bus: BusLive) {
  if (bus.trackingState === "STALE" || bus.complianceStatus === "STALE") return brand.muted;
  if (bus.complianceStatus === "OFF_ROUTE" || bus.statusColor === "RED") return brand.error;
  if (bus.complianceStatus === "DEVIATING" || bus.statusColor === "YELLOW") return brand.warning;
  return brand.success;
}

function BangladeshView({
  points,
  onReady,
}: {
  points: Array<[number, number]>;
  onReady: () => void;
}) {
  const map = useMap();
  const countryLocked = useRef(false);
  const fleetFitted = useRef(false);

  useEffect(() => {
    map.setMaxBounds(BD_BOUNDS);
    map.setMaxZoom(BANGLADESH_MAX_ZOOM);

    if (!countryLocked.current) {
      // Country-first: never open on a wider South Asia frame.
      map.fitBounds(BD_BOUNDS, { padding: [8, 8], animate: false });
      const countryZoom = map.getZoom();
      map.setMinZoom(Math.max(BANGLADESH_MIN_ZOOM, countryZoom));
      countryLocked.current = true;
      onReady();
    }

    if (fleetFitted.current) return;

    const inCountry = points.filter(([lat, lng]) => isInBangladesh(lat, lng));
    if (inCountry.length >= 2) {
      map.fitBounds(L.latLngBounds(inCountry), {
        padding: [36, 36],
        maxZoom: 13,
        animate: false,
      });
      fleetFitted.current = true;
    } else if (inCountry.length === 1) {
      map.setView(inCountry[0], 12, { animate: false });
      fleetFitted.current = true;
    }

    if (!BD_BOUNDS.contains(map.getBounds().pad(-0.01))) {
      map.fitBounds(BD_BOUNDS, { padding: [8, 8], animate: false });
    }
  }, [map, points, onReady]);

  return null;
}

function ZoomLabels() {
  const map = useMap();
  const { t } = useI18n();
  useEffect(() => {
    const root = map.getContainer();
    const zin = root.querySelector(".leaflet-control-zoom-in");
    const zout = root.querySelector(".leaflet-control-zoom-out");
    if (zin) {
      zin.setAttribute("title", t("Zoom in"));
      zin.setAttribute("aria-label", t("Zoom in"));
    }
    if (zout) {
      zout.setAttribute("title", t("Zoom out"));
      zout.setAttribute("aria-label", t("Zoom out"));
    }
  }, [map, t]);
  return null;
}

function RoadRoutes({ routes }: { routes: RouteLine[] }) {
  const map = useMap();
  const routesRef = useRef(routes);
  routesRef.current = routes;
  const [failedIds, setFailedIds] = useState<string[]>([]);

  const routeKey = useMemo(
    () =>
      routes
        .map((route) => {
          const waypoints = routingWaypoints(route.polyline);
          return `${route.id}:${waypoints.map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join(";")}`;
        })
        .join("|"),
    [routes],
  );

  useEffect(() => {
    let disposed = false;
    const controls: L.Routing.Control[] = [];
    const failed = new Set<string>();
    setFailedIds([]);

    (async () => {
      (window as unknown as { L: typeof L }).L = L;
      await import("leaflet-routing-machine");
      if (disposed || !L.Routing) return;

      for (const route of routesRef.current) {
        const waypoints = routingWaypoints(route.polyline);
        if (waypoints.length < 2) continue;
        const control = L.Routing.control({
          waypoints: waypoints.map((p) => L.latLng(p.lat, p.lng)),
          router: L.Routing.osrmv1({
            serviceUrl: "https://router.project-osrm.org/route/v1",
            profile: "driving",
            suppressDemoServerWarning: true,
            timeout: 8000,
          }),
          lineOptions: {
            styles: [
              { color: brand.primaryActive, opacity: 0.28, weight: 9 },
              { color: brand.primary, opacity: 0.9, weight: 4 },
            ],
            addWaypoints: false,
            extendToWaypoints: false,
            missingRouteTolerance: 0,
          },
          waypointMode: "snap",
          addWaypoints: false,
          fitSelectedRoutes: false,
          routeWhileDragging: false,
          showAlternatives: false,
          show: false,
          collapsible: false,
          containerClassName: "nirapad-routing-hidden",
          createMarker: () => false,
          draggableWaypoints: false,
        } as L.Routing.RoutingControlOptions & L.Routing.PlanOptions);
        control.on("routingerror", () => {
          failed.add(route.id);
          if (!disposed) setFailedIds([...failed]);
        });
        if (disposed) return;
        control.addTo(map);
        controls.push(control);
      }
    })().catch(() => {
      if (!disposed) setFailedIds(routesRef.current.map((route) => route.id));
    });

    return () => {
      disposed = true;
      controls.forEach((control) => {
        map.removeControl(control);
      });
    };
  }, [map, routeKey]);

  if (!failedIds.length) return null;
  const failed = new Set(failedIds);
  return (
    <>
      {routes
        .filter((route) => failed.has(route.id) && route.polyline.length > 1)
        .map((route) => (
          <Polyline
            key={route.id}
            positions={route.polyline.map((p) => [p.lat, p.lng]) as Array<[number, number]>}
            pathOptions={{ color: brand.primaryActive, weight: 4, opacity: 0.7 }}
          />
        ))}
    </>
  );
}

function MapResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const ro = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
    });
    ro.observe(container);
    map.invalidateSize({ animate: false });
    return () => ro.disconnect();
  }, [map]);
  return null;
}

export default function LiveMapInner({
  buses,
  routes = [],
  userLocation,
  sosLocation,
}: {
  buses: BusLive[];
  routes?: RouteLine[];
  userLocation?: { lat: number; lng: number } | null;
  sosLocation?: { lat: number; lng: number; label?: string } | null;
}) {
  const { t } = useI18n();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewReady, setViewReady] = useState(false);

  const bdBuses = useMemo(
    () => buses.filter((b) => isInBangladesh(Number(b.latitude), Number(b.longitude))),
    [buses],
  );

  const bdRoutes = useMemo(
    () =>
      routes
        .map((r) => ({
          ...r,
          polyline: (r.polyline ?? []).filter((p) => isInBangladesh(p.lat, p.lng)),
          stops: (r.stops ?? []).filter((s) => isInBangladesh(s.latitude, s.longitude)),
        }))
        .filter((r) => r.polyline.length > 0 || r.stops.length > 0),
    [routes],
  );

  const bdUser = userLocation && isInBangladesh(userLocation.lat, userLocation.lng) ? userLocation : null;
  const bdSos = sosLocation && isInBangladesh(sosLocation.lat, sosLocation.lng) ? sosLocation : null;

  const points = useMemo(() => {
    const pts: Array<[number, number]> = bdBuses.map((b) => [Number(b.latitude), Number(b.longitude)]);
    bdRoutes.forEach((r) => r.polyline.forEach((p) => pts.push([p.lat, p.lng])));
    if (bdUser) pts.push([bdUser.lat, bdUser.lng]);
    if (bdSos) pts.push([bdSos.lat, bdSos.lng]);
    return pts;
  }, [bdBuses, bdRoutes, bdUser, bdSos]);

  const selected = bdBuses.find((b) => b.busId === selectedId);

  return (
    <div className="map-frame flex flex-col">
      <div className={`min-h-0 flex-1 ${viewReady ? "map-view-ready" : "map-view-pending"}`}>
        <MapContainer
          // Seed center/zoom inside Bangladesh; bounds apply on create so neighbors never flash.
          center={BANGLADESH_CENTER}
          zoom={8}
          bounds={BD_BOUNDS}
          boundsOptions={{ padding: [8, 8], animate: false }}
          minZoom={BANGLADESH_MIN_ZOOM}
          maxZoom={BANGLADESH_MAX_ZOOM}
          maxBounds={BD_BOUNDS}
          maxBoundsViscosity={1}
          scrollWheelZoom
          worldCopyJump={false}
          style={{ height: "100%", width: "100%", background: "#e7f0eb" }}
        >
          <TileLayer
            attribution={`&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · ${t("Bangladesh")}`}
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            bounds={BD_BOUNDS}
            noWrap
          />
          <MapResize />
          <ZoomLabels />
          <BangladeshView points={points} onReady={() => setViewReady(true)} />
          <RoadRoutes routes={bdRoutes} />
          {bdRoutes.flatMap((r) =>
            (r.stops ?? []).map((stop) => (
              <CircleMarker
                key={`${r.id}-${stop.sequence ?? stop.name}`}
                center={[stop.latitude, stop.longitude]}
                radius={7}
                pathOptions={{ color: brand.primaryActive, fillColor: brand.infoBg, fillOpacity: 0.9 }}
              >
                <Popup>
                  {stop.sequence ? `${stop.sequence}. ` : ""}
                  {stop.name}
                </Popup>
              </CircleMarker>
            )),
          )}
          {bdUser && (
            <Marker
              position={[bdUser.lat, bdUser.lng]}
              icon={L.divIcon({
                className: "",
                html: `<div class="bus-marker" style="background:${brand.primary}">${t("You")}</div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
              })}
            >
              <Popup>{t("Your current location")}</Popup>
            </Marker>
          )}
          {bdSos && (
            <Marker
              position={[bdSos.lat, bdSos.lng]}
              icon={L.divIcon({
                className: "",
                html: `<div class="bus-marker" style="background:${brand.error}">${bdSos.label ?? t("SOS")}</div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
              })}
            >
              <Popup>{t("SOS requester location (device or provided). Not vehicle GPS.")}</Popup>
            </Marker>
          )}
          {bdBuses.map((b) => (
            <Marker
              key={b.busId}
              position={[Number(b.latitude), Number(b.longitude)]}
              icon={vehicleIcon(colorFor(b), Number(b.heading ?? 0), selectedId === b.busId)}
              eventHandlers={{ click: () => setSelectedId(b.busId) }}
            >
              <Popup>
                <div className="text-sm">
                  <div className="font-semibold">{b.registrationNo ?? b.bus?.registrationNo ?? b.busId}</div>
                  <div>{b.routeName ?? b.bus?.route?.name ?? t("Unassigned route")}</div>
                  <div>
                    {t("Speed")}: {Number(b.speed).toFixed(1)} km/h
                  </div>
                  <div>
                    {t("Heading")}: {Number(b.heading ?? 0).toFixed(0)}°
                  </div>
                  <div>
                    {t("GPS")}: {b.trackingState ?? t("ONLINE")}
                  </div>
                  <div>
                    {t("Route")}: {b.complianceStatus ?? "—"}
                    {b.deviationM != null ? ` · ${Math.round(b.deviationM)} m` : ""}
                  </div>
                  <div>
                    {t("Updated")}: {b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : "—"}
                  </div>
                  <div className="text-xs text-slate-500">{b.dataLabel ?? b.source ?? t("SIMULATED")}</div>
                  <div className="text-xs text-slate-500">
                    {Number(b.latitude).toFixed(5)}, {Number(b.longitude).toFixed(5)} · {t("Bangladesh")}
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {selected && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
          {t("Selected")} <strong className="break-all">{selected.registrationNo ?? selected.busId}</strong>
          {" · "}
          {selected.trackingState ?? "ONLINE"}
          {selected.complianceStatus ? ` · ${selected.complianceStatus}` : ""}
          {" · "}
          {Number(selected.speed).toFixed(1)} km/h
          {" · "}
          {selected.timestamp ? new Date(selected.timestamp).toLocaleTimeString() : "—"}
        </div>
      )}
    </div>
  );
}
