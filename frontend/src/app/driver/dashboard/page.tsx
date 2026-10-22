"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Badge, StatCard } from "@/components/StatCard";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

export default function Page() {
  const { user } = useAuth();
  const { t } = useI18n();
  const [trips, setTrips] = useState<Array<Record<string, unknown>>>([]);
  const [alerts, setAlerts] = useState<Array<Record<string, unknown>>>([]);
  useEffect(() => {
    api<Array<Record<string, unknown>>>("/trips").then(setTrips).catch(() => undefined);
    api<{ items?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>("/alerts?page=1&pageSize=8")
      .then((data) => setAlerts(Array.isArray(data) ? data : data.items ?? []))
      .catch(() => undefined);
  }, []);
  return (
    <AppShell allow={["DRIVER", "SUPER_ADMIN"]} title="Driver dashboard">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <StatCard label="Signed in as" value={user?.fullName ?? "—"} />
        <StatCard label="My trips" value={trips.length} />
        <StatCard label="Visible alerts" value={alerts.length} />
      </div>
      <div className="mt-4 card p-4 text-sm text-slate-600">
        {t("Use")} <strong>{t("Trip")}</strong> {t("to start or end a shift,")}{" "}
        <strong>{t("GPS")}</strong> {t("to see live movement, and")} <strong>{t("SOS")}</strong> {t("for emergencies.")}{" "}
        {t("License status:")}{" "}
        <Badge tone="teal">{user?.driver?.licenseStatus ?? t("see profile")}</Badge>
      </div>
    </AppShell>
  );
}
