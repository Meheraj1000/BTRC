"use client";
import { AnalyticsPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <AnalyticsPage allow={["TRANSPORT_OWNER", "SUPER_ADMIN"]} variant="owner" />;
}
