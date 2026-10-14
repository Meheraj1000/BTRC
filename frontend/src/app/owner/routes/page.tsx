"use client";
import { RouteDesk } from "@/components/pages/RouteDesk";

export default function Page() {
  return <RouteDesk allow={["TRANSPORT_OWNER", "SUPER_ADMIN"]} title="Routes" mode="owner" />;
}
