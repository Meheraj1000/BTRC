"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["DRIVER", "SUPER_ADMIN"]}
      title="Trip history"
      path="/trips"
      columns={[
        { key: "status", label: "Status" },
        { key: "startedAt", label: "Started" },
        { key: "endedAt", label: "Ended" },
        { key: "dataSource", label: "Source" },
      ]}
    />
  );
}
