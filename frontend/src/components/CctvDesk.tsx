"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AppShell } from "@/components/AppShell";
import { CctvFeed, type CameraView, type PlateMark } from "@/components/CctvFeed";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import type { RoleCode } from "@/lib/types";

const STATUS_WORD = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  MAINTENANCE: "Maintenance",
} as const;

type Sighting = {
  registrationNo: string;
  camera: CameraView | null;
  slot: number;
  suspicious: boolean;
  reasons: string[];
  dataLabel: "SIMULATED";
};

function tone(status: CameraView["status"]) {
  if (status === "ONLINE") return "green" as const;
  if (status === "MAINTENANCE") return "yellow" as const;
  return "red" as const;
}

export function CctvDesk({ allow, title }: { allow: RoleCode[]; title: string }) {
  const { t } = useI18n();
  const { user } = useAuth();
  const policePlaces = useMemo(() => {
    if (!user?.roles.includes("POLICE") || user.roles.includes("SUPER_ADMIN") || user.roles.includes("GOVERNMENT")) return [];
    return user.areas ?? [];
  }, [user]);
  const canManage = user?.roles.includes("SUPER_ADMIN") ?? false;
  const [items, setItems] = useState<CameraView[]>([]);
  const [city, setCity] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<CameraView | null>(null);
  const [streamUrl, setStreamUrl] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [plate, setPlate] = useState("");
  const [searching, setSearching] = useState(false);
  const [match, setMatch] = useState<Sighting | null>(null);
  const [miss, setMiss] = useState("");
  const [marked, setMarked] = useState<Sighting[]>([]);
  const detailRef = useRef<HTMLElement>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (status) params.set("status", status);
    const text = params.toString();
    return text ? `?${text}` : "";
  }, [city, status]);

  useEffect(() => {
    api<{ items: Sighting[] }>("/cameras/marked")
      .then((data) => setMarked(data.items ?? []))
      .catch((err: Error) => setError(err.message));
  }, []);

  useEffect(() => {
    if (selected) detailRef.current?.scrollIntoView({ block: "start" });
  }, [selected]);

  useEffect(() => {
    api<{ items: CameraView[] }>(`/cameras${query}`)
      .then((data) => {
        setItems(data.items ?? []);
        setError("");
      })
      .catch((err: Error) => setError(err.message));
  }, [query]);

  function showSighting(row: Sighting) {
    setMatch(row);
    setMiss("");
    if (!row.camera) {
      setSelected(null);
      setError("No camera in that place can show this vehicle.");
      return;
    }
    setSelected(row.camera);
    setStreamUrl(row.camera.streamUrl ?? "");
    setError("");
  }

  async function findPlate(event: FormEvent) {
    event.preventDefault();
    setSearching(true);
    setMiss("");
    try {
      const data = await api<{ found: boolean; match: Sighting | null }>(`/cameras/locate?plate=${encodeURIComponent(plate.trim())}`);
      if (!data.found || !data.match) {
        setMatch(null);
        setMiss("No vehicle with that plate is in the places you can view.");
        return;
      }
      showSighting(data.match);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSearching(false);
    }
  }

  const plateMark: PlateMark | null = match && selected && match.camera?.id === selected.id
    ? { registration: match.registrationNo, slot: match.slot }
    : null;

  async function openCamera(id: string) {
    try {
      const camera = await api<CameraView>(`/cameras/${id}`);
      setSelected(camera);
      setStreamUrl(camera.streamUrl ?? "");
      setMatch(null);
      setMiss("");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  async function save(next: { streamUrl?: string | null; status?: CameraView["status"] }) {
    if (!selected) return;
    setSaving(true);
    try {
      const camera = await api<CameraView>(`/cameras/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify(next),
      });
      setSelected(camera);
      setStreamUrl(camera.streamUrl ?? "");
      setItems((prev) => prev.map((item) => (item.id === camera.id ? { ...item, ...camera, streamUrl: null } : item)));
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell allow={allow} title={title}>
      <div className="space-y-4">
        {error && <ErrorState message={error} />}
        <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
          {t("Demonstration pictures only. These are not cameras on the street, and they are not a live police CCTV network.")}
        </p>
        {policePlaces.length > 0 && (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
            <span className="font-semibold">{t("Your assigned place")}: </span>
            {policePlaces.join(", ")}
            <span className="mt-1 block text-xs text-[var(--text-muted)]">
              {t("You only see cameras in your assigned place. Cameras in other places stay hidden.")}
            </span>
          </p>
        )}
        {user?.roles.includes("POLICE") && !user.roles.includes("SUPER_ADMIN") && !user.roles.includes("GOVERNMENT") && policePlaces.length === 0 && (
          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm">
            {t("This police account has no assigned place yet, so no cameras are shown.")}
          </p>
        )}
        <form className="card space-y-3 p-3 sm:p-4" onSubmit={(event) => void findPlate(event)}>
          <div>
            <h2 className="font-display text-lg font-semibold">{t("Find a vehicle")}</h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {t("The search matches this registration to the vehicle's latest position, pauses the demonstration picture, and outlines that vehicle in red. It does not read a plate from a camera.")}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              <span className="mb-1 block text-xs text-[var(--text-muted)]">{t("License plate")}</span>
              <input
                className="input sm:w-72"
                value={plate}
                onChange={(event) => setPlate(event.target.value)}
                aria-label={t("License plate")}
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
              />
            </label>
            <button className="btn btn-primary" type="submit" disabled={searching || plate.trim().length < 3}>
              {searching ? t("Searching…") : t("Find vehicle")}
            </button>
          </div>
          {miss && <p className="text-sm">{t(miss)}</p>}
        </form>

        <section className="card space-y-2 p-3 sm:p-4">
          <h2 className="font-display text-lg font-semibold">{t("Vehicles marked for review")}</h2>
          <p className="text-sm text-[var(--text-muted)]">
            {t("These vehicles have an open speed, route, accident, or help alert in the places you can view. The mark comes from those records, not from a camera model.")}
          </p>
          {marked.length === 0 ? (
            <p className="text-sm">{t("No vehicles are marked for review.")}</p>
          ) : (
            <ul className="space-y-2">
              {marked.map((row) => (
                <li key={row.registrationNo} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
                  <div>
                    <p className="font-semibold">{row.registrationNo}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {row.reasons.map((reason) => t(reason)).join(" · ")}
                      {row.camera ? ` · ${row.camera.area}, ${row.camera.city}` : ""}
                    </p>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => showSighting(row)}>{t("Show on camera")}</button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-wrap gap-2">
          {policePlaces.length === 0 && (
            <select className="input sm:w-48" aria-label={t("All cities")} value={city} onChange={(e) => setCity(e.target.value)}>
              <option value="">{t("All cities")}</option>
              {["Dhaka", "Chattogram", "Sylhet", "Rajshahi", "Khulna"].map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          <select className="input sm:w-48" aria-label={t("All statuses")} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{t("All statuses")}</option>
            <option value="ONLINE">{t("Online")}</option>
            <option value="OFFLINE">{t("Offline")}</option>
            <option value="MAINTENANCE">{t("Maintenance")}</option>
          </select>
        </div>

        {selected && (
          <section ref={detailRef} className="card space-y-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-semibold">{selected.name}</h2>
                <p className="text-sm text-[var(--text-muted)]">
                  {selected.code} · {selected.area}, {selected.city}
                  {selected.facing ? ` · ${t("Facing")} ${selected.facing}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={tone(selected.status)}>{STATUS_WORD[selected.status]}</Badge>
                <Badge tone="slate">{selected.dataLabel === "EXTERNAL" ? "External stream" : "Demonstration picture"}</Badge>
                <button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>{t("Close camera")}</button>
              </div>
            </div>
            <CctvFeed camera={selected} large mark={plateMark} />
            {plateMark && (
              <p className="text-sm">
                <span className="font-semibold text-[#e10600]">{plateMark.registration}</span>
                {" · "}
                {t("Paused on this registration. The red outline is drawn on the demonstration picture.")}
                {match?.reasons.length ? ` · ${match.reasons.map((reason) => t(reason)).join(" · ")}` : ""}
              </p>
            )}
            {canManage && (
              <form
                className="grid gap-2 sm:grid-cols-[1fr_auto_auto]"
                onSubmit={(e) => {
                  e.preventDefault();
                  void save({ streamUrl: streamUrl.trim() || null });
                }}
              >
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-[var(--text-muted)]">{t("Stream address")}</span>
                  <input
                    className="input"
                    value={streamUrl}
                    onChange={(e) => setStreamUrl(e.target.value)}
                    placeholder="https://"
                    inputMode="url"
                    aria-label={t("Stream address")}
                  />
                </label>
                <button className="btn btn-primary self-end" type="submit" disabled={saving}>{t("Save stream")}</button>
                <button className="btn btn-ghost self-end" type="button" disabled={saving} onClick={() => void save({ streamUrl: null })}>
                  {t("Clear stream")}
                </button>
                <p className="text-xs text-[var(--text-muted)] sm:col-span-3">
                  {t("Only an administrator can attach a stream. Police accounts can watch, not change, cameras.")}
                </p>
                <label className="text-sm sm:col-span-3">
                  <span className="mb-1 block text-xs text-[var(--text-muted)]">{t("Camera status")}</span>
                  <select
                    className="input sm:w-52"
                    aria-label={t("Camera status")}
                    value={selected.status}
                    onChange={(e) => void save({ status: e.target.value as CameraView["status"] })}
                  >
                    <option value="ONLINE">{t("Online")}</option>
                    <option value="OFFLINE">{t("Offline")}</option>
                    <option value="MAINTENANCE">{t("Maintenance")}</option>
                  </select>
                </label>
              </form>
            )}
          </section>
        )}

        {items.length === 0 ? (
          <EmptyState title="Street cameras" body="No cameras match this view." />
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((camera) => (
              <article key={camera.id} className="card overflow-hidden">
                <CctvFeed camera={camera} />
                <div className="space-y-2 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{camera.name}</h3>
                      <p className="text-xs text-[var(--text-muted)]">{camera.area}, {camera.city}</p>
                    </div>
                    <Badge tone={tone(camera.status)}>{STATUS_WORD[camera.status]}</Badge>
                  </div>
                  <button type="button" className="btn btn-primary" onClick={() => void openCamera(camera.id)}>
                    {t("Watch")}
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
