"use client";
import { AppShell } from "@/components/AppShell";
import { EventDesk } from "@/components/EventDesk";

export default function Page() {
  return (
    <AppShell allow={["GOVERNMENT", "SUPER_ADMIN"]} title="Alerts">
      <EventDesk />
    </AppShell>
  );
}
