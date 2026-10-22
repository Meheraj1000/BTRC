"use client";

import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

export default function Page() {
  const { t } = useI18n();
  const [msg, setMsg] = useState("");
  const [trip, setTrip] = useState<Record<string, unknown> | null>(null);

  return (
    <AppShell allow={["DRIVER", "SUPER_ADMIN"]} title="Trip control">
      <div className="card max-w-lg space-y-3 p-6">
        <p className="text-sm text-slate-600">
          {t("Start and end trips for your assigned bus. GPS sharing continues through the simulator or a future device.")}
        </p>
        <div className="flex gap-2">
          <button
            className="btn btn-primary"
            onClick={async () => {
              const started = await api<Record<string, unknown>>("/trips/start", { method: "POST", body: JSON.stringify({}) });
              setTrip(started);
              setMsg("Trip started.");
            }}
          >
            {t("Start trip")}
          </button>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              const ended = await api<Record<string, unknown>>("/trips/end", { method: "POST", body: JSON.stringify({}) });
              setTrip(ended);
              setMsg("Trip ended.");
            }}
          >
            {t("End trip")}
          </button>
        </div>
        {msg && <p className="text-sm text-emerald-700">{t(msg)}</p>}
        {trip && <pre className="overflow-auto rounded-xl bg-[var(--surface-secondary)] p-3 text-xs">{JSON.stringify(trip, null, 2)}</pre>}
      </div>
    </AppShell>
  );
}
