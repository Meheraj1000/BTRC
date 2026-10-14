"use client";
import { VehicleDesk } from "@/components/pages/VehicleDesk";

export default function Page() {
  return <VehicleDesk allow={["BRTA", "SUPER_ADMIN"]} title="Vehicle fitness" mode="brta" />;
}
