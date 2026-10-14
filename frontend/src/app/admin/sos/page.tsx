"use client";
import { SosDesk } from "@/components/pages/SimplePages";
export default function Page() {
  return <SosDesk allow={["SUPER_ADMIN", "GOVERNMENT", "POLICE"]} />;
}
