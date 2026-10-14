"use client";
import { RouteDesk } from "@/components/pages/RouteDesk";

export default function Page() {
  return <RouteDesk allow={["BRTA", "SUPER_ADMIN"]} title="Routes" mode="readonly" />;
}
