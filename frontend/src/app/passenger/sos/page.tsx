"use client";
import { SosButtonPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <SosButtonPage allow={["PASSENGER", "SUPER_ADMIN"]} title="Emergency SOS" />;
}
