"use client";
import { DriverDesk } from "@/components/pages/DriverDesk";

export default function Page() {
  return <DriverDesk allow={["TRANSPORT_OWNER", "SUPER_ADMIN"]} title="Company drivers" mode="owner" />;
}
