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
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Bangladesh'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            bounds={BD_BOUNDS}
            noWrap
          />
          <MapResize />
          <BangladeshView points={points} onReady={() => setViewReady(true)} />
          {bdRoutes.map((r) => (
            <Polyline
              key={r.id}
              positions={r.polyline.map((p) => [p.lat, p.lng]) as Array<[number, number]>}
              pathOptions={{ color: brand.primaryActive, weight: 4, opacity: 0.7 }}
            />
          ))}
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
                html: `<div class="bus-marker" style="background:${brand.primary}">You</div>`,
                iconSize: [34, 34],
                iconAnchor: [17, 17],
              })}
            >
              <Popup>Your current location</Popup>
            </Marker>
          )}
          {bdSos && (
            <Marker
              position={[bdSos.lat, bdSos.lng]}
              icon={L.divIcon({
                className: "",
                html: `<div class="bus-marker" style="background:${brand.error}">${bdSos.label ?? "SOS"}</div>`,
                iconSize: [40, 40],
                iconAnchor: [20, 20],
              })}
            >
              <Popup>SOS requester location (device or provided). Not vehicle GPS.</Popup>
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
                  <div>{b.routeName ?? b.bus?.route?.name ?? "Unassigned route"}</div>
                  <div>Speed: {Number(b.speed).toFixed(1)} km/h</div>
                  <div>Heading: {Number(b.heading ?? 0).toFixed(0)}°</div>
                  <div>GPS: {b.trackingState ?? "ONLINE"}</div>
                  <div>
                    Route: {b.complianceStatus ?? "—"}
                    {b.deviationM != null ? ` · ${Math.round(b.deviationM)} m` : ""}
                  </div>
                  <div>Updated: {b.timestamp ? new Date(b.timestamp).toLocaleTimeString() : "—"}</div>
                  <div className="text-xs text-slate-500">{b.dataLabel ?? b.source ?? "SIMULATED"}</div>
                  <div className="text-xs text-slate-500">
                    {Number(b.latitude).toFixed(5)}, {Number(b.longitude).toFixed(5)} · Bangladesh
                  </div>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
      {selected && (
        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed text-slate-600">
          Selected <strong className="break-all">{selected.registrationNo ?? selected.busId}</strong>
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
