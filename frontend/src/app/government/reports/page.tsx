"use client";
import { ReportsPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <ReportsPage allow={["GOVERNMENT", "SUPER_ADMIN"]} />;
}
