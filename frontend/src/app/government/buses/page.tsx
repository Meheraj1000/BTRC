"use client";
import { VehicleDesk } from "@/components/pages/VehicleDesk";

export default function Page() {
  return <VehicleDesk allow={["GOVERNMENT", "SUPER_ADMIN"]} title="Nationwide buses" mode="readonly" />;
}
