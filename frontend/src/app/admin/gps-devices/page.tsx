"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["SUPER_ADMIN"]}
      title="GPS devices"
      path="/gps-devices"
      columns={[
        { key: "serialNumber", label: "Serial" },
        { key: "vendor", label: "Vendor" },
        { key: "dataSource", label: "Source" },
        { key: "status", label: "Status" },
      ]}
    />
  );
}
