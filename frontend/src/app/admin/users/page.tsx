"use client";
import { TablePage } from "@/components/pages/SimplePages";
export default function Page() {
  return (
    <TablePage
      allow={["SUPER_ADMIN"]}
      title="Users"
      path="/users"
      columns={[
        { key: "fullName", label: "Name" },
        { key: "email", label: "Email" },
        { key: "status", label: "Status" },
        { key: "roles", label: "Roles" },
      ]}
    />
  );
}
