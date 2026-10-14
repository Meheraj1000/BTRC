"use client";
import { RouteDesk } from "@/components/pages/RouteDesk";

export default function Page() {
  return <RouteDesk allow={["SUPER_ADMIN"]} title="Routes" mode="admin" />;
}
