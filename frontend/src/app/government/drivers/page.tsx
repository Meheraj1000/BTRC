"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["GOVERNMENT", "SUPER_ADMIN"]}
      title="Driver statistics"
      path="/analytics/drivers"
      columns={[
        { key: "name", label: "Name" },
        { key: "company", label: "Company" },
        { key: "performanceScore", label: "Score" },
        { key: "violationCount", label: "Violations" },
      ]}
    />
  );
}
