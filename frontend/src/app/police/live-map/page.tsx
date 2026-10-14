"use client";
import { MapPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <MapPage allow={["POLICE", "SUPER_ADMIN"]} title="Police live map" />;
}
