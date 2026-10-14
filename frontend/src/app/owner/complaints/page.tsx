"use client";
import { ComplaintDesk } from "@/components/pages/SimplePages";
export default function Page() {
  return <ComplaintDesk allow={["TRANSPORT_OWNER", "SUPER_ADMIN"]} />;
}
