"use client";
import { ReportsPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <ReportsPage allow={["SUPER_ADMIN"]} />;
}
