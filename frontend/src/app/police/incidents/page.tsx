"use client";
import { AppShell } from "@/components/AppShell";
import { EventDesk } from "@/components/EventDesk";

export default function Page() {
  return (
    <AppShell allow={["POLICE", "SUPER_ADMIN"]} title="Incident foundation">
      <p className="mb-3 text-sm text-slate-600">
        These records reuse existing Alerts (including companion SOS alerts). For the full SOS lifecycle
        (acknowledge → investigate → respond → resolve), open <strong>Emergencies</strong>.
        This is an application workflow only — not live emergency dispatch.
      </p>
      <EventDesk path="/incidents" canManage />
    </AppShell>
  );
}
