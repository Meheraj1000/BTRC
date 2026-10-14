"use client";
import { DashPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <DashPage allow={["SUPER_ADMIN"]} title="Admin dashboard" variant="admin" />;
}
