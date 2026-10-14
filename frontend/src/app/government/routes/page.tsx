"use client";
import { RouteDesk } from "@/components/pages/RouteDesk";

export default function Page() {
  return <RouteDesk allow={["GOVERNMENT", "SUPER_ADMIN"]} title="Routes" mode="readonly" />;
}
