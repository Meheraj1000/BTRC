"use client";
import { DriverDesk } from "@/components/pages/DriverDesk";

export default function Page() {
  return <DriverDesk allow={["SUPER_ADMIN"]} title="Drivers" mode="admin" />;
}
