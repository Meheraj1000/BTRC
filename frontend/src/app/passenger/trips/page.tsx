"use client";
import { AppShell } from "@/components/AppShell";
export default function Page() {
  return (
    <AppShell allow={["PASSENGER", "SUPER_ADMIN"]} title="Trip information">
      <div className="card p-6 text-sm text-slate-600">
        Passenger trip history is reserved for future ticketing integration. Live buses and routes are available now. This page is intentionally not fabricated.
      </div>
    </AppShell>
  );
}
