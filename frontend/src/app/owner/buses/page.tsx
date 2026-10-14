"use client";
import { VehicleDesk } from "@/components/pages/VehicleDesk";

export default function Page() {
  return <VehicleDesk allow={["TRANSPORT_OWNER", "SUPER_ADMIN"]} title="Company buses" mode="owner" />;
}
