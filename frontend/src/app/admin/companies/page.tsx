"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["SUPER_ADMIN"]}
      title="Transport companies"
      path="/companies"
      columns={[
        { key: "name", label: "Name" },
        { key: "registration", label: "Registration" },
        { key: "city", label: "City" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
