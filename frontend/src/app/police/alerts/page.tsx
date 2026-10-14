"use client";
import { AppShell } from "@/components/AppShell";
import { EventDesk } from "@/components/EventDesk";

export default function Page() {
  return (
    <AppShell allow={["POLICE", "SUPER_ADMIN"]} title="Operational alerts">
      <EventDesk canManage />
    </AppShell>
  );
}
