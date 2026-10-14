"use client";
import { DashPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <DashPage allow={["GOVERNMENT", "SUPER_ADMIN"]} title="Government dashboard" variant="government" />;
}
