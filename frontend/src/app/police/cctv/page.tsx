"use client";

import { CctvDesk } from "@/components/CctvDesk";

export default function Page() {
  return <CctvDesk allow={["POLICE", "SUPER_ADMIN"]} title="Street cameras for your place" />;
}
