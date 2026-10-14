"use client";
import { SosButtonPage } from "@/components/pages/SimplePages";
export default function Page() {
  return <SosButtonPage allow={["DRIVER", "SUPER_ADMIN"]} title="Driver SOS" />;
}
