"use client";

import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";

export default function Page() {
  const { t } = useI18n();
  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Trip information">
      <div className="card p-6 text-sm text-slate-600">
        {t(
          "Passenger trip history is reserved for future ticketing integration. Live buses and routes are available now. This page is intentionally not fabricated.",
        )}
      </div>
    </AppShell>
  );
}
