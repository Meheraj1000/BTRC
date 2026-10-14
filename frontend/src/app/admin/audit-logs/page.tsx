"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["SUPER_ADMIN"]}
      title="Audit logs"
      path="/audit-logs"
      columns={[
        { key: "action", label: "Action" },
        { key: "entity", label: "Entity" },
        { key: "actor", label: "Actor" },
        { key: "ipAddress", label: "IP" },
        { key: "createdAt", label: "When" },
      ]}
    />
  );
}
