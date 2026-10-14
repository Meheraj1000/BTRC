"use client";
import { MapPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <MapPage allow={["DRIVER", "SUPER_ADMIN"]} title="GPS sharing view" />;
}
