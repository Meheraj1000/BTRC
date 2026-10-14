"use client";
import { DashPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <DashPage allow={["BRTA", "SUPER_ADMIN"]} title="BRTA dashboard" variant="brta" />;
}
