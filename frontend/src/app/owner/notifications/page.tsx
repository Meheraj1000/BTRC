"use client";

import { NotificationsInbox } from "@/components/NotificationsInbox";

export default function Page() {
  return <NotificationsInbox allow={["TRANSPORT_OWNER", "SUPER_ADMIN"]} />;
}
