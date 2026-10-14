"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["BRTA", "SUPER_ADMIN"]}
      title="Violation history"
      path="/alerts"
      columns={[
        { key: "type", label: "Type" },
        { key: "message", label: "Detail" },
        { key: "createdAt", label: "When" },
      ]}
    />
  );
}
