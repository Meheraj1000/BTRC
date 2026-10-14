"use client";
import { ComplaintDesk } from "@/components/pages/SimplePages";
export default function Page() {
  return <ComplaintDesk allow={["GOVERNMENT", "SUPER_ADMIN"]} />;
}
