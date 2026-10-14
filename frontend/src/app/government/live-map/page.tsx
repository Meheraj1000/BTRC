"use client";
import { MapPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <MapPage allow={["GOVERNMENT", "SUPER_ADMIN"]} title="Nationwide live map" />;
}
