"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["SUPER_ADMIN"]}
      title="Trips"
      path="/trips"
      columns={[
        { key: "status", label: "Status" },
        { key: "startedAt", label: "Started" },
        { key: "dataSource", label: "Data source" },
        { key: "bus", label: "Bus" },
      ]}
      pick={(raw) => (Array.isArray(raw) ? raw.map((t: Record<string, unknown>) => ({
        ...t,
        bus: (t.bus as { registrationNo?: string } | undefined)?.registrationNo,
      })) : [])}
    />
  );
}
