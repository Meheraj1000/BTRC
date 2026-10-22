"use client";
import { AppShell } from "@/components/AppShell";
import { EventDesk } from "@/components/EventDesk";
import { useI18n } from "@/lib/i18n";

export default function Page() {
  const { t } = useI18n();
  return (
    <AppShell allow={["POLICE", "SUPER_ADMIN"]} title="Incident foundation">
      <p className="mb-3 text-sm text-slate-600">
        {t("These records reuse existing Alerts (including companion SOS alerts). For the full SOS lifecycle (acknowledge → investigate → respond → resolve), open Emergencies. This is an application workflow only — not live emergency dispatch.")}
      </p>
      <EventDesk path="/incidents" canManage />
    </AppShell>
  );
}
