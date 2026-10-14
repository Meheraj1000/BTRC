"use client";
import { VehicleDesk } from "@/components/pages/VehicleDesk";

export default function Page() {
  return <VehicleDesk allow={["SUPER_ADMIN"]} title="Buses" mode="admin" />;
}
