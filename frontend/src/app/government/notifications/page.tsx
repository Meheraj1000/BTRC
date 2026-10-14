"use client";

import { NotificationsInbox } from "@/components/NotificationsInbox";

export default function Page() {
  return <NotificationsInbox allow={["GOVERNMENT", "SUPER_ADMIN"]} />;
}
