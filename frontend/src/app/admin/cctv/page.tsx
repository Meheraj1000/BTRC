"use client";

import { CctvDesk } from "@/components/CctvDesk";

export default function Page() {
  return <CctvDesk allow={["SUPER_ADMIN"]} title="Street cameras" />;
}
