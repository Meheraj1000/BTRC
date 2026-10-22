"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { NoticeVehicleDetail } from "@/components/NoticeVehicleDetail";
import { Badge, EmptyState, ErrorState } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import { isEmergencyNotice } from "@/lib/inbox";
import { getSocket } from "@/lib/socket";
import type { RoleCode } from "@/lib/types";

type NoteRow = {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt?: string | null;
  createdAt: string;
  payload?: unknown;
};

function hasVehiclePayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return false;
  return typeof (payload as Record<string, unknown>).busId === "string";
}

export function NotificationsInbox({
  allow,
  title = "Notifications",
}: {
  allow: RoleCode[];
  title?: string;
}) {
  const { t } = useI18n();
  const [items, setItems] = useState<NoteRow[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "emergency">("all");
  const [openId, setOpenId] = useState<string | null>(null);

  function load() {
    api<NoteRow[]>("/notifications")
      .then((rows) => setItems(rows))
      .catch((err: Error) => setError(err.message));
  }

  useEffect(() => {
    load();
    const socket = getSocket();
    const onNew = () => load();
    socket.on("notification:new", onNew);
    return () => {
      socket.off("notification:new", onNew);
    };
  }, []);

  const visible = items.filter((n) => {
    if (filter === "unread") return !n.readAt;
    if (filter === "emergency") return isEmergencyNotice(n);
    return true;
  });

  async function openNotice(n: NoteRow) {
    setOpenId((prev) => (prev === n.id ? null : n.id));
    if (!n.readAt) {
      try {
        await api(`/notifications/${n.id}/read`, { method: "PUT" });
        setItems((prev) => prev.map((row) => (row.id === n.id ? { ...row, readAt: new Date().toISOString() } : row)));
      } catch {
        // keep panel open even if mark-read fails
      }
    }
  }

  return (
    <AppShell allow={allow} title={t(title)}>
      {error && <ErrorState message={error} />}
      <p className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs text-[var(--text-muted)]">
        {t("Click a notice to open bus and driver details with the vehicle's live location when a bus is linked.")}
      </p>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="toolbar">
          <button type="button" className={`btn ${filter === "all" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("all")}>
            {t("All notices")}
          </button>
          <button type="button" className={`btn ${filter === "unread" ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter("unread")}>
            {t("Unread")}
          </button>
          <button type="button" className={`btn ${filter === "emergency" ? "btn-danger" : "btn-ghost"}`} onClick={() => setFilter("emergency")}>
            {t("Emergencies")}
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            await api("/notifications/read-all", { method: "PUT" });
            load();
          }}
        >
          {t("Mark all read")}
        </button>
      </div>

      {!visible.length ? (
        <EmptyState title="No notices" body="No notifications match this filter." />
      ) : (
        <div className="space-y-3">
          {visible.map((n) => {
            const emergency = isEmergencyNotice(n);
            const linked = hasVehiclePayload(n.payload);
            const open = openId === n.id;
            return (
              <div
                key={n.id}
                className={`card p-4 text-sm transition ${
                  emergency
                    ? "border-[var(--error)] bg-[var(--error-bg)] ring-1 ring-[var(--error)]/30"
                    : !n.readAt
                      ? "border-[var(--brand-primary)]/30 bg-[var(--surface-secondary)]"
                      : ""
                } ${linked ? "cursor-pointer hover:shadow-md" : ""}`}
              >
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => void openNotice(n)}
                  aria-expanded={open}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className={`font-semibold ${emergency ? "text-[var(--error)]" : ""}`}>
                        {emergency ? t("Emergency · ") : ""}
                        {n.title}
                      </div>
                      <div className={`mt-0.5 text-xs ${emergency ? "text-[var(--error)]/80" : "text-[var(--text-muted)]"}`}>
                        {n.type}
                        {" · "}
                        {new Date(n.createdAt).toLocaleString()}
                        {linked ? t(" · Tap for bus, driver & live map") : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {emergency && <Badge tone="red">EMERGENCY</Badge>}
                      {linked && <Badge tone={emergency ? "red" : "teal"}>{t("Vehicle")}</Badge>}
                      <Badge tone={n.readAt ? "slate" : emergency ? "red" : "yellow"}>
                        {n.readAt ? t("Read") : t("Unread")}
                      </Badge>
                    </div>
                  </div>
                  <p className={`mt-2 ${emergency ? "text-[var(--error)]" : "text-[var(--text-secondary)]"}`}>{n.body}</p>
                </button>

                {open && (
                  <NoticeVehicleDetail
                    payload={n.payload}
                    emergency={emergency}
                    onClose={() => setOpenId(null)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </AppShell>
  );
}
