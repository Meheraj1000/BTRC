"use client";
import { AppShell } from "@/components/AppShell";
import { PoliceMonitoring } from "@/components/PoliceMonitoring";

export default function Page() {
  return (
    <AppShell allow={["POLICE", "SUPER_ADMIN"]} title="Police & emergency monitoring">
      <PoliceMonitoring />
    </AppShell>
  );
}
