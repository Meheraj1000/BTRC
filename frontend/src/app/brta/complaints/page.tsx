"use client";

import { ComplaintDesk } from "@/components/pages/SimplePages";

export default function Page() {
  return <ComplaintDesk allow={["BRTA", "SUPER_ADMIN"]} />;
}
