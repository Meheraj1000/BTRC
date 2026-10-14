"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["DRIVER", "SUPER_ADMIN"]}
      title="Assigned bus"
      path="/buses"
      columns={[
        { key: "registrationNo", label: "Registration" },
        { key: "operationalStatus", label: "Status" },
        { key: "vehicleType", label: "Type" },
      ]}
      pick={(raw) => (raw as { items?: Array<Record<string, unknown>> }).items ?? []}
    />
  );
}
