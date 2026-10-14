"use client";
import { DriverDesk } from "@/components/pages/DriverDesk";

export default function Page() {
  return <DriverDesk allow={["BRTA", "SUPER_ADMIN"]} title="License verification" mode="brta" />;
}
