"use client";
import { MapPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <MapPage allow={["PASSENGER", "SUPER_ADMIN"]} title="Live bus map" listenOps={false} />;
}
