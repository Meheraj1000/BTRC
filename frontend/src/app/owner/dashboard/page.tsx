"use client";
import { DashPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <DashPage allow={["TRANSPORT_OWNER", "SUPER_ADMIN"]} title="Operator dashboard" variant="owner" />;
}
