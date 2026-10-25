"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { CctvFeed, type CameraView } from "@/components/CctvFeed";
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

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (city) params.set("city", city);
    if (status) params.set("status", status);
    const text = params.toString();
    return text ? `?${text}` : "";
  }, [city, status]);

  useEffect(() => {
    api<{ items: CameraView[] }>(`/cameras${query}`)
      .then((data) => {
        setItems(data.items ?? []);
        setError("");
      })
      .catch((err: Error) => setError(err.message));
  }, [query]);

  async function openCamera(id: string) {
    try {
      const camera = await api<CameraView>(`/cameras/${id}`);
      setSelected(camera);
      setStreamUrl(camera.streamUrl ?? "");
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
          <section className="card space-y-3 p-3 sm:p-4">
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
            <CctvFeed camera={selected} large />
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
