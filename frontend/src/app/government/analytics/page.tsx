"use client";
import { AnalyticsPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <AnalyticsPage allow={["GOVERNMENT", "SUPER_ADMIN"]} variant="government" />;
}
